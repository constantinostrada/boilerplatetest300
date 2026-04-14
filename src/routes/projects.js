'use strict'

const { Router } = require('express')
const { validateProjectsQuery } = require('../middleware/validate')
const { listProjects } = require('../services/projectsService')

const router = Router()

/**
 * GET /projects
 *
 * Returns a paginated, optionally-filtered list of projects.
 *
 * Query parameters:
 *   limit      {number}  Max results per page. Default: 20. Max: 100.
 *   cursor     {string}  Opaque cursor from a previous response's next_cursor.
 *   status     {string}  Filter by project status: "active" | "archived".
 *   member_uid {string}  Filter to projects where this UID is a member.
 *
 * Response 200:
 * {
 *   "projects": [ { "uid": "...", ...projectFields } ],
 *   "next_cursor": "<string>" | null
 * }
 *
 * Response 400 – invalid query parameters:
 * {
 *   "error": "Invalid query parameters",
 *   "details": [ "<message>", ... ]
 * }
 */
router.get('/', validateProjectsQuery, async (req, res, next) => {
  try {
    const { limit, cursor, status, memberUid } = req.projectsQuery
    const result = await listProjects({ limit, cursor, status, memberUid })
    return res.status(200).json(result)
  } catch (err) {
    return next(err)
  }
})

module.exports = router
