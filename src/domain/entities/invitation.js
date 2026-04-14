/**
 * Invitation entity / value-object.
 *
 * Represents a pending invitation for a user to join a project with a
 * specific role.  The object is intentionally immutable after construction
 * so that business rules cannot be silently mutated by downstream code.
 */

/** Roles that are valid targets for an invitation. */
export const ALLOWED_ROLES = Object.freeze(['viewer', 'editor', 'admin'])

export class Invitation {
  /**
   * @param {{
   *   id: string,
   *   projectId: string,
   *   invitedByUserId: string,
   *   inviteeEmail: string,
   *   role: string,
   *   createdAt: Date,
   *   expiresAt: Date,
   *   status: 'pending' | 'accepted' | 'declined' | 'expired'
   * }} params
   */
  constructor({ id, projectId, invitedByUserId, inviteeEmail, role, createdAt, expiresAt, status = 'pending' }) {
    this.id = id
    this.projectId = projectId
    this.invitedByUserId = invitedByUserId
    this.inviteeEmail = inviteeEmail
    this.role = role
    this.createdAt = createdAt
    this.expiresAt = expiresAt
    this.status = status

    Object.freeze(this)
  }

  get isExpired() {
    return new Date() > this.expiresAt
  }

  /** Plain serialisable object (safe to log / transmit). */
  toJSON() {
    return {
      id: this.id,
      projectId: this.projectId,
      invitedByUserId: this.invitedByUserId,
      inviteeEmail: this.inviteeEmail,
      role: this.role,
      createdAt: this.createdAt.toISOString(),
      expiresAt: this.expiresAt.toISOString(),
      status: this.status,
    }
  }
}
