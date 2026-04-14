/**
 * Security audit test suite for InviteToProjectUseCase
 *
 * Coverage matrix
 * ───────────────────────────────────────────────────────────────────────────
 * §1  Authentication bypass
 * §2  Input sanitization (email, role, projectId)
 * §3  Authorization – project membership
 * §4  Authorization – role hierarchy / privilege escalation
 * §5  Self-invitation prevention
 * §6  Duplicate invitation (token flooding / enumeration)
 * §7  Rate limiting
 * §8  Happy path
 * §9  Mailer fault isolation
 * §10 Dependency injection guard
 * ───────────────────────────────────────────────────────────────────────────
 */

import { describe, test, expect, jest } from '@jest/globals'
import { InviteToProjectUseCase } from './InviteToProjectUseCase.js'
import {
  UnauthenticatedError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
  ConflictError,
  RateLimitError,
} from '../domain/errors.js'

// ─── Test helpers / factories ─────────────────────────────────────────────────

const FIXED_NOW = new Date('2024-06-01T12:00:00.000Z')
const FIXED_ID = 'inv-fixed-id-001'

/**
 * Builds a minimal, fully-wired use-case with sensible defaults.
 * Individual tests override only what they need.
 */
function buildUseCase(overrides = {}) {
  const defaults = {
    projectRepository: {
      findById: jest.fn().mockResolvedValue({ id: 'proj-1', name: 'Test Project' }),
      getMembership: jest.fn().mockResolvedValue({ role: 'admin' }),
    },
    invitationRepository: {
      findPendingByProjectAndEmail: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((inv) => Promise.resolve(inv)),
    },
    userRepository: {
      findByEmail: jest.fn().mockResolvedValue(null),
    },
    mailer: {
      sendInvitation: jest.fn().mockResolvedValue(undefined),
    },
    rateLimiter: {
      check: jest.fn().mockResolvedValue(undefined),
    },
    idGenerator: jest.fn().mockReturnValue(FIXED_ID),
    clock: () => FIXED_NOW,
    invitationTtlMs: 72 * 60 * 60 * 1000,
  }

  return new InviteToProjectUseCase({ ...defaults, ...overrides })
}

/** Base valid command used across tests. */
const validCommand = {
  currentUser: { id: 'user-admin-1', email: 'admin@example.com' },
  projectId: 'proj-1',
  inviteeEmail: 'newmember@example.com',
  role: 'editor',
}

// ─── §1  Authentication bypass ────────────────────────────────────────────────

describe('§1 Authentication bypass', () => {
  test('throws UnauthenticatedError when currentUser is null', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, currentUser: null })).rejects.toThrow(UnauthenticatedError)
  })

  test('throws UnauthenticatedError when currentUser is undefined', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, currentUser: undefined })).rejects.toThrow(UnauthenticatedError)
  })

  test('throws UnauthenticatedError when currentUser is an empty object', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, currentUser: {} })).rejects.toThrow(UnauthenticatedError)
  })

  test('throws UnauthenticatedError when currentUser.id is an empty string', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({ ...validCommand, currentUser: { id: '', email: 'a@b.com' } }),
    ).rejects.toThrow(UnauthenticatedError)
  })

  test('throws UnauthenticatedError when currentUser.id is whitespace only', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({ ...validCommand, currentUser: { id: '   ', email: 'a@b.com' } }),
    ).rejects.toThrow(UnauthenticatedError)
  })

  test('throws UnauthenticatedError when currentUser.id is a non-string type', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({ ...validCommand, currentUser: { id: 12345, email: 'a@b.com' } }),
    ).rejects.toThrow(UnauthenticatedError)
  })

  test('does NOT call any repository before auth check', async () => {
    const projectRepo = { findById: jest.fn(), getMembership: jest.fn() }
    const useCase = buildUseCase({ projectRepository: projectRepo })
    await expect(useCase.execute({ ...validCommand, currentUser: null })).rejects.toThrow(UnauthenticatedError)
    expect(projectRepo.findById).not.toHaveBeenCalled()
    expect(projectRepo.getMembership).not.toHaveBeenCalled()
  })
})

// ─── §2  Input sanitization ───────────────────────────────────────────────────

describe('§2a Input sanitization — email', () => {
  test('accepts a valid email address', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute(validCommand)
    expect(result.inviteeEmail).toBe('newmember@example.com')
  })

  test('normalises email to lowercase', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute({ ...validCommand, inviteeEmail: 'NewMember@Example.COM' })
    expect(result.inviteeEmail).toBe('newmember@example.com')
  })

  test('trims leading/trailing whitespace from email', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute({ ...validCommand, inviteeEmail: '  newmember@example.com  ' })
    expect(result.inviteeEmail).toBe('newmember@example.com')
  })

  test('throws ValidationError for non-string email (number)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: 42 })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for non-string email (object)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: { email: 'a@b.com' } })).rejects.toThrow(
      ValidationError,
    )
  })

  test('throws ValidationError for empty email string', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: '' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for whitespace-only email', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: '   ' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for email without @', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: 'notanemail' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for email exceeding 254 chars', async () => {
    const useCase = buildUseCase()
    const longEmail = 'a'.repeat(245) + '@b.com' // 251 chars
    await expect(useCase.execute({ ...validCommand, inviteeEmail: longEmail })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for email with embedded newline (header injection attempt)', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({ ...validCommand, inviteeEmail: 'a@b.com\nBCC:evil@evil.com' }),
    ).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for email with embedded null byte', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, inviteeEmail: 'a\x00@b.com' })).rejects.toThrow(ValidationError)
  })

  test('ValidationError carries field name "inviteeEmail"', async () => {
    const useCase = buildUseCase()
    let caughtError
    try {
      await useCase.execute({ ...validCommand, inviteeEmail: 'bad' })
      throw new Error('Expected ValidationError to be thrown but it was not')
    } catch (err) {
      caughtError = err
    }
    expect(caughtError).toBeInstanceOf(ValidationError)
    expect(caughtError.field).toBe('inviteeEmail')
  })
})

describe('§2b Input sanitization — role', () => {
  test.each([['viewer'], ['editor'], ['admin']])('accepts valid role "%s"', async (role) => {
    const useCase = buildUseCase()
    const result = await useCase.execute({ ...validCommand, role })
    expect(result.role).toBe(role)
  })

  test('normalises role to lowercase (case-insensitivity bypass attempt)', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute({ ...validCommand, role: 'EDITOR' })
    expect(result.role).toBe('editor')
  })

  test('throws ValidationError for unknown role "superadmin"', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 'superadmin' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for unknown role "owner"', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 'owner' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for prototype-pollution role "__proto__"', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: '__proto__' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for empty role string', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: '' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for non-string role (number)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 1 })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for non-string role (null)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: null })).rejects.toThrow(ValidationError)
  })

  test('ValidationError carries field name "role"', async () => {
    const useCase = buildUseCase()
    let caughtError
    try {
      await useCase.execute({ ...validCommand, role: 'superadmin' })
      throw new Error('Expected ValidationError to be thrown but it was not')
    } catch (err) {
      caughtError = err
    }
    expect(caughtError).toBeInstanceOf(ValidationError)
    expect(caughtError.field).toBe('role')
  })
})

describe('§2c Input sanitization — projectId', () => {
  test('accepts valid alphanumeric projectId', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute(validCommand)).resolves.toBeDefined()
  })

  test('accepts projectId with hyphens and underscores', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: 'my-project_01' })).resolves.toBeDefined()
  })

  test('throws ValidationError for empty projectId', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: '' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for path traversal "../../etc/passwd"', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: '../../etc/passwd' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for projectId with slash', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: 'proj/secret' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for projectId with null byte', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: 'proj\x00id' })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for projectId exceeding 128 chars', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: 'a'.repeat(129) })).rejects.toThrow(ValidationError)
  })

  test('throws ValidationError for non-string projectId (number)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, projectId: 123 })).rejects.toThrow(ValidationError)
  })

  test('ValidationError carries field name "projectId"', async () => {
    const useCase = buildUseCase()
    let caughtError
    try {
      await useCase.execute({ ...validCommand, projectId: '../../bad' })
      throw new Error('Expected ValidationError to be thrown but it was not')
    } catch (err) {
      caughtError = err
    }
    expect(caughtError).toBeInstanceOf(ValidationError)
    expect(caughtError.field).toBe('projectId')
  })
})

// ─── §3  Authorization — project membership ───────────────────────────────────

describe('§3 Authorization — project membership', () => {
  test('throws NotFoundError (generic) when project does not exist', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue(null),
        getMembership: jest.fn(),
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(NotFoundError)
  })

  test('returns same NotFoundError shape for non-member as for non-existent project (IDOR mitigation)', async () => {
    const nonExistentErr = await buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue(null),
        getMembership: jest.fn(),
      },
    })
      .execute(validCommand)
      .catch((e) => e)

    const nonMemberErr = await buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue(null),
      },
    })
      .execute(validCommand)
      .catch((e) => e)

    expect(nonExistentErr).toBeInstanceOf(NotFoundError)
    expect(nonMemberErr).toBeInstanceOf(NotFoundError)
    // Both expose the same generic message — project existence is not leaked
    expect(nonExistentErr.message).toBe(nonMemberErr.message)
  })

  test('throws ForbiddenError when actor is a member but not admin (viewer)', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue({ role: 'viewer' }),
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(ForbiddenError)
  })

  test('throws ForbiddenError when actor is a member but not admin (editor)', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue({ role: 'editor' }),
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(ForbiddenError)
  })

  test('getMembership is NOT called when project does not exist', async () => {
    const getMembership = jest.fn()
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue(null),
        getMembership,
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(NotFoundError)
    expect(getMembership).not.toHaveBeenCalled()
  })
})

// ─── §4  Privilege escalation ─────────────────────────────────────────────────

describe('§4 Privilege escalation prevention', () => {
  // In the current three-tier model admin == highest rank, so we verify that
  // an admin CAN invite another admin (same rank is allowed).
  test('admin can invite another admin (same rank)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 'admin' })).resolves.toBeDefined()
  })

  test('admin can invite editor (lower rank)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 'editor' })).resolves.toBeDefined()
  })

  test('admin can invite viewer (lowest rank)', async () => {
    const useCase = buildUseCase()
    await expect(useCase.execute({ ...validCommand, role: 'viewer' })).resolves.toBeDefined()
  })

  // Future-proofing: if a higher tier (e.g. "owner") is introduced, the rank
  // comparison will block admins from granting it.  We simulate this by
  // manually injecting a scenario where requestedRank > actorRank.
  // For now, since admin is max rank, we test the boundary from editor-level.
  test('editor cannot invite anyone (blocked at permission check, not rank check)', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue({ role: 'editor' }),
      },
    })
    await expect(useCase.execute({ ...validCommand, role: 'viewer' })).rejects.toThrow(ForbiddenError)
  })

  test('viewer cannot invite anyone', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue({ role: 'viewer' }),
      },
    })
    await expect(useCase.execute({ ...validCommand, role: 'viewer' })).rejects.toThrow(ForbiddenError)
  })

  test('ForbiddenError message does not expose internal role values', async () => {
    const useCase = buildUseCase({
      projectRepository: {
        findById: jest.fn().mockResolvedValue({ id: 'proj-1' }),
        getMembership: jest.fn().mockResolvedValue({ role: 'editor' }),
      },
    })
    const err = await useCase.execute({ ...validCommand, role: 'viewer' }).catch((e) => e)
    // Message should not contain raw numeric rank values or internal field paths
    expect(err.message).not.toMatch(/ROLE_RANK/i)
    expect(err.message).not.toMatch(/\d+\s*>\s*\d+/)
  })
})

// ─── §5  Self-invitation prevention ──────────────────────────────────────────

describe('§5 Self-invitation prevention', () => {
  test('throws ForbiddenError when actor invites their own email', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({
        ...validCommand,
        currentUser: { id: 'user-1', email: 'admin@example.com' },
        inviteeEmail: 'admin@example.com',
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  test('self-invite blocked even with different casing', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({
        ...validCommand,
        currentUser: { id: 'user-1', email: 'Admin@Example.COM' },
        inviteeEmail: 'admin@example.com',
      }),
    ).rejects.toThrow(ForbiddenError)
  })

  test('self-invite blocked even with leading/trailing spaces', async () => {
    const useCase = buildUseCase()
    await expect(
      useCase.execute({
        ...validCommand,
        currentUser: { id: 'user-1', email: 'admin@example.com' },
        inviteeEmail: '  admin@example.com  ',
      }),
    ).rejects.toThrow(ForbiddenError)
  })
})

// ─── §6  Duplicate invitation / token flooding ────────────────────────────────

describe('§6 Duplicate invitation prevention', () => {
  test('throws ConflictError when a pending invitation already exists', async () => {
    const existingInvitation = { id: 'inv-old', status: 'pending' }
    const useCase = buildUseCase({
      invitationRepository: {
        findPendingByProjectAndEmail: jest.fn().mockResolvedValue(existingInvitation),
        save: jest.fn(),
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(ConflictError)
  })

  test('does NOT persist a new invitation when duplicate exists', async () => {
    const save = jest.fn()
    const useCase = buildUseCase({
      invitationRepository: {
        findPendingByProjectAndEmail: jest.fn().mockResolvedValue({ id: 'inv-old' }),
        save,
      },
    })
    await useCase.execute(validCommand).catch(() => {})
    expect(save).not.toHaveBeenCalled()
  })

  test('allows invitation when previous one is not pending (e.g. declined)', async () => {
    // findPendingByProjectAndEmail returns null → no conflict
    const useCase = buildUseCase({
      invitationRepository: {
        findPendingByProjectAndEmail: jest.fn().mockResolvedValue(null),
        save: jest.fn().mockImplementation((inv) => Promise.resolve(inv)),
      },
    })
    await expect(useCase.execute(validCommand)).resolves.toBeDefined()
  })
})

// ─── §7  Rate limiting ────────────────────────────────────────────────────────

describe('§7 Rate limiting', () => {
  test('throws RateLimitError when limiter signals threshold exceeded', async () => {
    const useCase = buildUseCase({
      rateLimiter: {
        check: jest.fn().mockRejectedValue(new RateLimitError('Too many invitations. Please wait.')),
      },
    })
    await expect(useCase.execute(validCommand)).rejects.toThrow(RateLimitError)
  })

  test('rate limiter is keyed with actorId and projectId', async () => {
    const check = jest.fn().mockResolvedValue(undefined)
    const useCase = buildUseCase({ rateLimiter: { check } })
    await useCase.execute(validCommand)
    expect(check).toHaveBeenCalledWith(`invite:${validCommand.currentUser.id}:${validCommand.projectId}`)
  })

  test('rate limiter is NOT called when authentication fails', async () => {
    const check = jest.fn()
    const useCase = buildUseCase({ rateLimiter: { check } })
    await useCase.execute({ ...validCommand, currentUser: null }).catch(() => {})
    expect(check).not.toHaveBeenCalled()
  })

  test('rate limiter is NOT called when input validation fails', async () => {
    const check = jest.fn()
    const useCase = buildUseCase({ rateLimiter: { check } })
    await useCase.execute({ ...validCommand, inviteeEmail: 'not-an-email' }).catch(() => {})
    expect(check).not.toHaveBeenCalled()
  })
})

// ─── §8  Happy path ───────────────────────────────────────────────────────────

describe('§8 Happy path', () => {
  test('returns a saved Invitation with all expected fields', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute(validCommand)

    expect(result.id).toBe(FIXED_ID)
    expect(result.projectId).toBe(validCommand.projectId)
    expect(result.invitedByUserId).toBe(validCommand.currentUser.id)
    expect(result.inviteeEmail).toBe(validCommand.inviteeEmail)
    expect(result.role).toBe(validCommand.role)
    expect(result.status).toBe('pending')
    expect(result.createdAt).toEqual(FIXED_NOW)
    expect(result.expiresAt).toEqual(new Date(FIXED_NOW.getTime() + 72 * 60 * 60 * 1000))
  })

  test('persists the invitation via the repository', async () => {
    const save = jest.fn().mockImplementation((inv) => Promise.resolve(inv))
    const useCase = buildUseCase({ invitationRepository: { findPendingByProjectAndEmail: jest.fn().mockResolvedValue(null), save } })
    await useCase.execute(validCommand)
    expect(save).toHaveBeenCalledTimes(1)
  })

  test('dispatches email notification via mailer', async () => {
    const sendInvitation = jest.fn().mockResolvedValue(undefined)
    const useCase = buildUseCase({ mailer: { sendInvitation } })
    await useCase.execute(validCommand)
    expect(sendInvitation).toHaveBeenCalledTimes(1)
  })

  test('respects custom invitationTtlMs', async () => {
    const ONE_HOUR_MS = 60 * 60 * 1000
    const useCase = buildUseCase({ invitationTtlMs: ONE_HOUR_MS })
    const result = await useCase.execute(validCommand)
    expect(result.expiresAt).toEqual(new Date(FIXED_NOW.getTime() + ONE_HOUR_MS))
  })

  test('invitation is immutable (Object.freeze)', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute(validCommand)
    expect(Object.isFrozen(result)).toBe(true)
  })

  test('invitation.toJSON() returns a plain serialisable object', async () => {
    const useCase = buildUseCase()
    const result = await useCase.execute(validCommand)
    const json = result.toJSON()
    expect(json).toMatchObject({
      id: FIXED_ID,
      projectId: validCommand.projectId,
      invitedByUserId: validCommand.currentUser.id,
      inviteeEmail: validCommand.inviteeEmail,
      role: validCommand.role,
      status: 'pending',
    })
    expect(typeof json.createdAt).toBe('string') // ISO string
    expect(typeof json.expiresAt).toBe('string')
  })
})

// ─── §9  Mailer fault isolation ───────────────────────────────────────────────

describe('§9 Mailer fault isolation', () => {
  test('does NOT throw when mailer fails — invitation is still returned', async () => {
    const useCase = buildUseCase({
      mailer: {
        sendInvitation: jest.fn().mockRejectedValue(new Error('SMTP timeout')),
      },
    })
    await expect(useCase.execute(validCommand)).resolves.toBeDefined()
  })

  test('invitation is persisted even if mailer throws', async () => {
    const save = jest.fn().mockImplementation((inv) => Promise.resolve(inv))
    const useCase = buildUseCase({
      invitationRepository: { findPendingByProjectAndEmail: jest.fn().mockResolvedValue(null), save },
      mailer: { sendInvitation: jest.fn().mockRejectedValue(new Error('network error')) },
    })
    await useCase.execute(validCommand).catch(() => {})
    expect(save).toHaveBeenCalledTimes(1)
  })
})

// ─── §10 Dependency injection guard ──────────────────────────────────────────

describe('§10 Dependency injection guard', () => {
  const deps = {
    projectRepository: {},
    invitationRepository: {},
    userRepository: {},
    mailer: {},
    rateLimiter: {},
    idGenerator: jest.fn(),
  }

  test.each(Object.keys(deps))('throws at construction when "%s" is missing', (missing) => {
    const incomplete = { ...deps }
    delete incomplete[missing]
    expect(() => new InviteToProjectUseCase(incomplete)).toThrow(
      `InviteToProjectUseCase: missing required dependency "${missing}"`,
    )
  })
})
