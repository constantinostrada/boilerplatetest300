'use strict'

const VALID_STATUSES = new Set(['active', 'archived'])
const DEFAULT_LIMIT = 20
const MAX_LIMIT = 100

/**
 * Validates and normalises query parameters for the GET /projects endpoint.
 *
 * Parsed values are attached to `req.projectsQuery` so the route handler
 * stays clean and free of parsing logic.
 *
 * Query params accepted:
 *   limit      {number}  1–100, default 20
 *   cursor     {string}  opaque base-64 cursor returned by a previous response
 *   status     {string}  "active" | "archived"
 *   member_uid {string}  UID of a project member to filter by
 */
function validateProjectsQuery(req, res, next) {
  const errors = []

  // ── limit ────────────────────────────────────────────────────────────────
  let limit = DEFAULT_LIMIT
  if (req.query.limit !== undefined) {
    const parsed = parseInt(req.query.limit, 10)
    if (isNaN(parsed) || parsed < 1) {
      errors.push('limit must be a positive integer')
    } else if (parsed > MAX_LIMIT) {
      errors.push(`limit must not exceed ${MAX_LIMIT}`)
    } else {
      limit = parsed
    }
  }

  // ── cursor ───────────────────────────────────────────────────────────────
  let cursor = null
  if (req.query.cursor !== undefined && req.query.cursor !== '') {
    cursor = req.query.cursor
  }

  // ── status ───────────────────────────────────────────────────────────────
  let status = null
  if (req.query.status !== undefined && req.query.status !== '') {
    if (!VALID_STATUSES.has(req.query.status)) {
      errors.push(`status must be one of: ${[...VALID_STATUSES].join(', ')}`)
    } else {
      status = req.query.status
    }
  }

  // ── member_uid ───────────────────────────────────────────────────────────
  let memberUid = null
  if (req.query.member_uid !== undefined && req.query.member_uid !== '') {
    memberUid = req.query.member_uid
  }

  if (errors.length > 0) {
    return res.status(400).json({ error: 'Invalid query parameters', details: errors })
  }

  req.projectsQuery = { limit, cursor, status, memberUid }
  return next()
}

module.exports = { validateProjectsQuery }
