/**
 * Typed domain errors used across use-cases.
 * Using distinct classes lets callers do `err instanceof ForbiddenError`
 * without relying on string matching, which is fragile and error-prone.
 */

export class DomainError extends Error {
  constructor(message) {
    super(message)
    this.name = this.constructor.name
    // Maintains proper prototype chain in transpiled environments
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

/** Caller is not authenticated. */
export class UnauthenticatedError extends DomainError {}

/** Caller is authenticated but lacks the required permission. */
export class ForbiddenError extends DomainError {}

/** Requested resource was not found. */
export class NotFoundError extends DomainError {}

/** Input data failed validation / sanitization rules. */
export class ValidationError extends DomainError {
  /** @param {string} field - The name of the failing field */
  constructor(message, field) {
    super(message)
    this.field = field
  }
}

/** A conflicting state already exists (e.g. duplicate invitation). */
export class ConflictError extends DomainError {}

/** The caller has exceeded the allowed rate of operations. */
export class RateLimitError extends DomainError {}
