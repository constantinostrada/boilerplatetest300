/**
 * InviteToProjectUseCase
 *
 * Encapsulates all business logic required to invite a user to a project.
 *
 * ─── Security controls (OWASP-aligned) ───────────────────────────────────────
 *
 *  1. AUTHENTICATION CHECK
 *     The caller must supply a fully authenticated `currentUser` object.
 *     If the object is absent or lacks a verified `id`, execution stops
 *     immediately with `UnauthenticatedError` — preventing anonymous callers
 *     from triggering any downstream logic.
 *
 *  2. INPUT SANITIZATION & VALIDATION
 *     • `inviteeEmail`   – trimmed, lower-cased, validated against RFC 5321
 *                          constraints (local-part + domain), max 254 chars
 *                          (OWASP input validation, prevents injection).
 *     • `role`           – validated against a strict allow-list (`ALLOWED_ROLES`).
 *                          Rejects anything outside the list; prevents privilege
 *                          escalation via unknown roles (e.g. "superadmin").
 *     • `projectId`      – validated as a non-empty, alphanumeric-plus-hyphen
 *                          string ≤ 128 chars; prevents path traversal / IDOR
 *                          via crafted IDs.
 *     All validation is pure and synchronous — it runs before any I/O so
 *     invalid payloads never reach the data layer.
 *
 *  3. AUTHORIZATION — PROJECT MEMBERSHIP
 *     After input validation the use-case checks that `currentUser` is an
 *     active member of the target project.  Non-members receive `ForbiddenError`
 *     with a generic message that does not reveal project existence to
 *     unauthorised callers (information-disclosure mitigation).
 *
 *  4. AUTHORIZATION — ROLE HIERARCHY / PRIVILEGE ESCALATION PREVENTION
 *     • Only project members with role `admin` may invite others.
 *     • An `admin` may invite users with roles `viewer`, `editor`, or `admin`.
 *       However, a non-owner `admin` CANNOT elevate an invitee ABOVE their own
 *       current role in the hierarchy.  The role hierarchy is:
 *         viewer (0) < editor (1) < admin (2)
 *       Attempting to grant a role higher than your own rank results in
 *       `ForbiddenError`, closing the privilege escalation vector.
 *
 *  5. SELF-INVITATION PREVENTION
 *     The actor cannot invite themselves (their own email), preventing
 *     role manipulation through circular invitation flows.
 *
 *  6. DUPLICATE INVITATION PREVENTION
 *     If a `pending` invitation for the same (project, email) pair already
 *     exists, the use-case returns `ConflictError` rather than silently
 *     creating a second token — prevents token-flooding / enumeration attacks.
 *
 *  7. RATE LIMITING
 *     The use-case delegates rate-limit enforcement to an injected
 *     `rateLimiter` port.  The limiter is keyed on `(actorId, projectId)` to
 *     prevent one user from spamming invitations on a single project.
 *     Exceeding the threshold raises `RateLimitError`.
 *
 *  8. INVITATION EXPIRY
 *     Every invitation is created with a bounded TTL (`invitationTtlMs`,
 *     default 72 h).  Expired invitations cannot be re-used; a fixed expiry
 *     limits the window in which a leaked token can be abused.
 *
 *  9. DEPENDENCY INJECTION / NO IMPLICIT GLOBALS
 *     All I/O (repositories, ID generation, clock, mailer, rate limiter) is
 *     injected via the constructor.  This makes the use-case trivially
 *     testable, ensures the security surface is explicit, and prevents
 *     accidental reliance on ambient globals.
 *
 * ─── Ports (interfaces expected by the constructor) ──────────────────────────
 *
 *  projectRepository
 *    .findById(projectId)            → Project | null
 *    .getMembership(projectId, userId) → { role: string } | null
 *
 *  invitationRepository
 *    .findPendingByProjectAndEmail(projectId, email) → Invitation | null
 *    .save(invitation)               → Invitation
 *
 *  userRepository
 *    .findByEmail(email)             → { id, email } | null
 *
 *  mailer
 *    .sendInvitation(invitation)     → Promise<void>
 *
 *  rateLimiter
 *    .check(key)                     → Promise<void>  (throws RateLimitError on breach)
 *
 *  idGenerator
 *    ()                              → string   (unique ID, e.g. UUID v4)
 *
 *  clock
 *    ()                              → Date     (injectable for deterministic tests)
 */

import { Invitation, ALLOWED_ROLES } from '../domain/entities/invitation.js'
import {
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
} from '../domain/errors.js'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Numeric rank for each role.  Higher number = more privilege.
 * Used to enforce the role-hierarchy rule (§4 above).
 */
const ROLE_RANK = Object.freeze({
  viewer: 0,
  editor: 1,
  admin: 2,
})

/** Default invitation TTL: 72 hours in milliseconds. */
const DEFAULT_INVITATION_TTL_MS = 72 * 60 * 60 * 1000

/**
 * RFC 5321 – local part ≤ 64 chars, domain ≤ 255 chars, total ≤ 254 chars.
 * This regex deliberately avoids catastrophic backtracking (no nested
 * quantifiers) while covering the common-case email format.
 *
 * Security note: server-side validation is the authoritative check; any
 * client-side validation is defence-in-depth only.
 *
 * The character class [^\s@\x00-\x1F\x7F] excludes:
 *  – whitespace (covers newlines, tabs — header-injection prevention)
 *  – the @ sign (so only one @ is present)
 *  – C0 control characters including null byte (\x00–\x1F) and DEL (\x7F)
 */
const EMAIL_REGEX = /^[^\s@\x00-\x1F\x7F]{1,64}@[^\s@\x00-\x1F\x7F]{1,255}$/

/** Project IDs: alphanumeric + hyphens/underscores, max 128 chars. */
const PROJECT_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/

// ─── Use-case ─────────────────────────────────────────────────────────────────

export class InviteToProjectUseCase {
  /**
   * @param {{
   *   projectRepository: object,
   *   invitationRepository: object,
   *   userRepository: object,
   *   mailer: object,
   *   rateLimiter: object,
   *   idGenerator: function,
   *   clock?: function,
   *   invitationTtlMs?: number,
   * }} deps
   */
  constructor({
    projectRepository,
    invitationRepository,
    userRepository,
    mailer,
    rateLimiter,
    idGenerator,
    clock = () => new Date(),
    invitationTtlMs = DEFAULT_INVITATION_TTL_MS,
  }) {
    // Guard against missing required dependencies — fail fast at construction
    // time so misconfiguration is caught immediately rather than at runtime.
    const required = { projectRepository, invitationRepository, userRepository, mailer, rateLimiter, idGenerator }
    for (const [key, value] of Object.entries(required)) {
      if (!value) throw new Error(`InviteToProjectUseCase: missing required dependency "${key}"`)
    }

    this._projectRepo = projectRepository
    this._invitationRepo = invitationRepository
    this._userRepo = userRepository
    this._mailer = mailer
    this._rateLimiter = rateLimiter
    this._idGenerator = idGenerator
    this._clock = clock
    this._invitationTtlMs = invitationTtlMs
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Invite a user to a project.
   *
   * @param {{
   *   currentUser: { id: string, email: string } | null | undefined,
   *   projectId: string,
   *   inviteeEmail: string,
   *   role: string,
   * }} command
   *
   * @returns {Promise<Invitation>}
   *
   * @throws {UnauthenticatedError} – no authenticated actor
   * @throws {ValidationError}      – invalid input data
   * @throws {ForbiddenError}       – actor lacks permission
   * @throws {NotFoundError}        – project does not exist
   * @throws {ConflictError}        – pending invitation already exists
   * @throws {RateLimitError}       – actor exceeded invitation rate limit
   */
  async execute({ currentUser, projectId, inviteeEmail, role }) {
    // ── 1. Authentication ────────────────────────────────────────────────────
    this._assertAuthenticated(currentUser)

    // ── 2. Input sanitization & validation ──────────────────────────────────
    const sanitizedEmail = this._sanitizeAndValidateEmail(inviteeEmail)
    const sanitizedRole = this._validateRole(role)
    const sanitizedProjectId = this._validateProjectId(projectId)

    // ── 3. Self-invitation prevention ────────────────────────────────────────
    // Compare lower-cased values — both have already been normalised above.
    if (currentUser.email.trim().toLowerCase() === sanitizedEmail) {
      throw new ForbiddenError('You cannot invite yourself to a project.')
    }

    // ── 4. Rate limiting ─────────────────────────────────────────────────────
    // Key combines actor + project so limits are scoped appropriately.
    await this._rateLimiter.check(`invite:${currentUser.id}:${sanitizedProjectId}`)

    // ── 5. Project existence ─────────────────────────────────────────────────
    const project = await this._projectRepo.findById(sanitizedProjectId)
    if (!project) {
      // Use the same generic message for both "not found" and "forbidden"
      // to avoid disclosing project existence to non-members (IDOR mitigation).
      throw new NotFoundError('Project not found.')
    }

    // ── 6. Actor membership & permission check ───────────────────────────────
    const actorMembership = await this._projectRepo.getMembership(sanitizedProjectId, currentUser.id)
    if (!actorMembership) {
      // Return generic "not found" rather than "forbidden" to avoid confirming
      // project existence to non-members.
      throw new NotFoundError('Project not found.')
    }

    // Only admins may invite others.
    if (actorMembership.role !== 'admin') {
      throw new ForbiddenError('Only project admins can invite members.')
    }

    // ── 7. Privilege escalation guard ────────────────────────────────────────
    // An admin may not grant a role with higher rank than their own.
    // In this schema all admins share the same rank, so the check is symmetric;
    // it becomes important if finer-grained tiers (e.g. owner > admin) are added.
    const actorRank = ROLE_RANK[actorMembership.role]
    const requestedRank = ROLE_RANK[sanitizedRole]
    if (requestedRank > actorRank) {
      throw new ForbiddenError('You cannot grant a role that exceeds your own permission level.')
    }

    // ── 8. Duplicate invitation check ────────────────────────────────────────
    const existingInvitation = await this._invitationRepo.findPendingByProjectAndEmail(
      sanitizedProjectId,
      sanitizedEmail,
    )
    if (existingInvitation) {
      throw new ConflictError(`A pending invitation for ${sanitizedEmail} already exists on this project.`)
    }

    // ── 9. Persist invitation ────────────────────────────────────────────────
    const now = this._clock()
    const invitation = new Invitation({
      id: this._idGenerator(),
      projectId: sanitizedProjectId,
      invitedByUserId: currentUser.id,
      inviteeEmail: sanitizedEmail,
      role: sanitizedRole,
      createdAt: now,
      expiresAt: new Date(now.getTime() + this._invitationTtlMs),
      status: 'pending',
    })

    const savedInvitation = await this._invitationRepo.save(invitation)

    // ── 10. Dispatch notification (non-blocking on failure) ──────────────────
    // Mailer errors must NOT leak back to the caller or roll back the saved
    // record — the invitation exists regardless of email delivery.
    try {
      await this._mailer.sendInvitation(savedInvitation)
    } catch (mailerError) {
      // In production, forward to an observability/logging service here.
      // We intentionally swallow the error so a transient SMTP outage does
      // not cause the entire flow to fail.
      console.error('[InviteToProjectUseCase] Mailer error (non-fatal):', mailerError?.message)
    }

    return savedInvitation
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Ensures a non-null, authenticated user object is present.
   * Validates that the `id` field is a non-empty string so a partially
   * constructed user object (e.g. `{ id: '' }`) cannot sneak through.
   *
   * @param {unknown} currentUser
   */
  _assertAuthenticated(currentUser) {
    if (!currentUser || typeof currentUser.id !== 'string' || currentUser.id.trim() === '') {
      throw new UnauthenticatedError('You must be logged in to invite members.')
    }
  }

  /**
   * Trims, lower-cases, length-checks, and regex-validates an email address.
   * Returns the normalised email on success; throws `ValidationError` on failure.
   *
   * Security notes:
   *  – Normalisation (trim + lowercase) prevents homoglyph/whitespace bypasses.
   *  – Length cap (254) matches RFC 5321 and prevents DoS via extremely long strings.
   *  – The regex rejects values containing `@`-less strings, IP literals with
   *    crafted chars, and multi-line payloads (no newlines match `[^\s@]`).
   *
   * @param {unknown} email
   * @returns {string} normalised email
   */
  _sanitizeAndValidateEmail(email) {
    if (typeof email !== 'string') {
      throw new ValidationError('inviteeEmail must be a string.', 'inviteeEmail')
    }

    const normalised = email.trim().toLowerCase()

    if (normalised.length === 0) {
      throw new ValidationError('inviteeEmail is required.', 'inviteeEmail')
    }

    if (normalised.length > 254) {
      throw new ValidationError('inviteeEmail exceeds maximum length of 254 characters.', 'inviteeEmail')
    }

    if (!EMAIL_REGEX.test(normalised)) {
      throw new ValidationError('inviteeEmail is not a valid email address.', 'inviteeEmail')
    }

    return normalised
  }

  /**
   * Validates `role` against the strict allow-list.
   * Any value outside `ALLOWED_ROLES` is rejected, preventing privilege
   * escalation via unknown role strings (e.g. "superadmin", "owner", "__proto__").
   *
   * @param {unknown} role
   * @returns {string} validated role
   */
  _validateRole(role) {
    if (typeof role !== 'string') {
      throw new ValidationError('role must be a string.', 'role')
    }

    // Normalise before allow-list check to prevent case-sensitivity bypasses
    // (e.g. "Admin" or "ADMIN" sneaking through).
    const normalised = role.trim().toLowerCase()

    if (!ALLOWED_ROLES.includes(normalised)) {
      throw new ValidationError(
        `role must be one of: ${ALLOWED_ROLES.join(', ')}. Received: "${role}"`,
        'role',
      )
    }

    return normalised
  }

  /**
   * Validates `projectId` against the allowed character set.
   * Prevents path traversal sequences (e.g. `../../secret`), null-byte
   * injection, and oversized strings that could cause downstream issues.
   *
   * @param {unknown} projectId
   * @returns {string} validated projectId
   */
  _validateProjectId(projectId) {
    if (typeof projectId !== 'string') {
      throw new ValidationError('projectId must be a string.', 'projectId')
    }

    const trimmed = projectId.trim()

    if (trimmed.length === 0) {
      throw new ValidationError('projectId is required.', 'projectId')
    }

    if (!PROJECT_ID_REGEX.test(trimmed)) {
      throw new ValidationError(
        'projectId may only contain letters, numbers, hyphens, and underscores (max 128 characters).',
        'projectId',
      )
    }

    return trimmed
  }
}
