'use strict'

/**
 * Integration tests for GET /projects.
 *
 * Firestore (firebase-admin) is fully mocked so no real GCP credentials are
 * needed.  The mock is set up before the modules under test are required so
 * that when projectsService.js calls `require('../firebase')` it receives the
 * mock instead of the real SDK.
 */

// ── Firestore mock ────────────────────────────────────────────────────────────

/**
 * Build a lightweight Firestore query-chain mock.
 *
 * The factory accepts an array of "raw" document objects and returns a mock
 * `db` whose `.collection().where().orderBy().limit().get()` chain resolves
 * with those docs.
 *
 * We re-create the mock for each test via `mockFirestore()` so tests are
 * isolated.
 */
function buildDocSnap(data) {
  return {
    id: data.uid,
    exists: true,
    data: () => {
      // eslint-disable-next-line no-unused-vars
      const { uid: _uid, ...rest } = data // uid is exposed as doc.id; strip it from data()
      return rest
    },
  }
}

let _mockDocs = []
let _mockCursorDoc = null // the snapshot returned for a cursor look-up

function mockFirestore(docs, cursorDoc = null) {
  _mockDocs = docs.map(buildDocSnap)
  _mockCursorDoc = cursorDoc ? buildDocSnap(cursorDoc) : null
}

// Capture the query chain so we can assert on filters applied.
const queryChainCalls = {
  where: [],
  orderBy: [],
  limit: null,
  startAfter: null,
}

function resetQueryChainCalls() {
  queryChainCalls.where = []
  queryChainCalls.orderBy = []
  queryChainCalls.limit = null
  queryChainCalls.startAfter = null
}

// The mock db object – mutated by `mockFirestore`.
const mockDb = {
  collection: jest.fn(() => {
    const chain = {
      doc: jest.fn((id) => ({
        get: jest.fn(async () => {
          if (_mockCursorDoc && _mockCursorDoc.id === id) return _mockCursorDoc
          return { id, exists: false, data: () => null }
        }),
      })),
      where: jest.fn((...args) => {
        queryChainCalls.where.push(args)
        return chain
      }),
      orderBy: jest.fn((...args) => {
        queryChainCalls.orderBy.push(args)
        return chain
      }),
      limit: jest.fn((n) => {
        queryChainCalls.limit = n
        return chain
      }),
      startAfter: jest.fn((snap) => {
        queryChainCalls.startAfter = snap
        return chain
      }),
      get: jest.fn(async () => ({ docs: _mockDocs })),
    }
    return chain
  }),
}

// Stub firebase-admin BEFORE any application module is required.
jest.mock('../firebase', () => ({ db: mockDb }))

// ── Application under test ────────────────────────────────────────────────────

const request = require('supertest')
const app = require('../app')
const { encodeCursor } = require('../services/projectsService')

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeProjects(n, overrides = {}) {
  return Array.from({ length: n }, (_, i) => ({
    uid: `proj-${i + 1}`,
    name: `Project ${i + 1}`,
    status: 'active',
    member_uids: ['user-1'],
    created_at: new Date(Date.now() + i * 1000).toISOString(),
    ...overrides,
  }))
}

beforeEach(() => {
  resetQueryChainCalls()
  mockDb.collection.mockClear()
})

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /projects', () => {
  // ── Default / backwards-compatible behaviour ────────────────────────────────

  describe('default behaviour (no query params)', () => {
    it('returns 200 with projects array and null next_cursor when results fit in one page', async () => {
      const projects = makeProjects(3)
      mockFirestore(projects)

      const res = await request(app).get('/projects')

      expect(res.status).toBe(200)
      expect(res.body.next_cursor).toBeNull()
      expect(res.body.projects).toHaveLength(3)
      expect(res.body.projects[0].uid).toBe('proj-1')
    })

    it('uses default limit of 20', async () => {
      mockFirestore([])

      await request(app).get('/projects')

      // Service requests limit + 1 to detect next page
      expect(queryChainCalls.limit).toBe(21)
    })

    it('orders by created_at ascending', async () => {
      mockFirestore([])

      await request(app).get('/projects')

      expect(queryChainCalls.orderBy).toContainEqual(['created_at', 'asc'])
    })

    it('returns an empty projects array when collection is empty', async () => {
      mockFirestore([])

      const res = await request(app).get('/projects')

      expect(res.status).toBe(200)
      expect(res.body.projects).toEqual([])
      expect(res.body.next_cursor).toBeNull()
    })
  })

  // ── Pagination ──────────────────────────────────────────────────────────────

  describe('pagination', () => {
    it('returns next_cursor when more documents exist', async () => {
      // Request limit=3 → service fetches 4 docs; if 4 come back there is a next page
      const projects = makeProjects(4)
      mockFirestore(projects)

      const res = await request(app).get('/projects?limit=3')

      expect(res.status).toBe(200)
      expect(res.body.projects).toHaveLength(3)
      expect(res.body.next_cursor).not.toBeNull()
      expect(typeof res.body.next_cursor).toBe('string')
    })

    it('next_cursor decodes to the id of the last document on the page', async () => {
      const projects = makeProjects(4)
      mockFirestore(projects)

      const res = await request(app).get('/projects?limit=3')

      const expected = encodeCursor('proj-3')
      expect(res.body.next_cursor).toBe(expected)
    })

    it('returns null next_cursor on the last page', async () => {
      const projects = makeProjects(3)
      mockFirestore(projects)

      const res = await request(app).get('/projects?limit=3')

      expect(res.body.next_cursor).toBeNull()
    })

    it('passes cursor to Firestore startAfter', async () => {
      const cursorDoc = makeProjects(1)[0] // proj-1
      const nextProjects = makeProjects(2, { uid: 'proj-2' }) // next page
      mockFirestore(nextProjects, cursorDoc)

      const cursor = encodeCursor('proj-1')
      await request(app).get(`/projects?cursor=${cursor}`)

      expect(queryChainCalls.startAfter).not.toBeNull()
      expect(queryChainCalls.startAfter.id).toBe('proj-1')
    })

    it('falls back to page 1 gracefully when cursor doc no longer exists', async () => {
      mockFirestore(makeProjects(2))
      // _mockCursorDoc stays null – cursor doc look-up returns exists:false

      const cursor = encodeCursor('deleted-doc-id')
      const res = await request(app).get(`/projects?cursor=${cursor}`)

      expect(res.status).toBe(200)
      // startAfter should NOT have been called
      expect(queryChainCalls.startAfter).toBeNull()
    })

    it('respects a custom limit', async () => {
      mockFirestore(makeProjects(5))

      await request(app).get('/projects?limit=5')

      expect(queryChainCalls.limit).toBe(6) // limit + 1
    })
  })

  // ── Filtering ───────────────────────────────────────────────────────────────

  describe('filtering', () => {
    it('applies status filter when status param is provided', async () => {
      mockFirestore(makeProjects(2, { status: 'active' }))

      await request(app).get('/projects?status=active')

      expect(queryChainCalls.where).toContainEqual(['status', '==', 'active'])
    })

    it('applies status=archived filter', async () => {
      mockFirestore(makeProjects(1, { status: 'archived' }))

      await request(app).get('/projects?status=archived')

      expect(queryChainCalls.where).toContainEqual(['status', '==', 'archived'])
    })

    it('applies member_uid filter when member_uid param is provided', async () => {
      mockFirestore(makeProjects(2))

      await request(app).get('/projects?member_uid=user-abc')

      expect(queryChainCalls.where).toContainEqual(['member_uids', 'array-contains', 'user-abc'])
    })

    it('applies both status and member_uid filters together', async () => {
      mockFirestore(makeProjects(1))

      await request(app).get('/projects?status=active&member_uid=user-abc')

      expect(queryChainCalls.where).toContainEqual(['status', '==', 'active'])
      expect(queryChainCalls.where).toContainEqual(['member_uids', 'array-contains', 'user-abc'])
    })

    it('does NOT add where clauses when no filters are supplied', async () => {
      mockFirestore(makeProjects(2))

      await request(app).get('/projects')

      expect(queryChainCalls.where).toHaveLength(0)
    })
  })

  // ── Validation ──────────────────────────────────────────────────────────────

  describe('query param validation', () => {
    it('returns 400 when limit is not a number', async () => {
      const res = await request(app).get('/projects?limit=abc')

      expect(res.status).toBe(400)
      expect(res.body.error).toBe('Invalid query parameters')
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining('limit')]))
    })

    it('returns 400 when limit is zero', async () => {
      const res = await request(app).get('/projects?limit=0')

      expect(res.status).toBe(400)
    })

    it('returns 400 when limit exceeds 100', async () => {
      const res = await request(app).get('/projects?limit=101')

      expect(res.status).toBe(400)
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining('100')]))
    })

    it('accepts limit=100 (boundary)', async () => {
      mockFirestore(makeProjects(5))

      const res = await request(app).get('/projects?limit=100')

      expect(res.status).toBe(200)
    })

    it('accepts limit=1 (boundary)', async () => {
      mockFirestore(makeProjects(1))

      const res = await request(app).get('/projects?limit=1')

      expect(res.status).toBe(200)
    })

    it('returns 400 when status is invalid', async () => {
      const res = await request(app).get('/projects?status=pending')

      expect(res.status).toBe(400)
      expect(res.body.details).toEqual(expect.arrayContaining([expect.stringContaining('status')]))
    })

    it('returns 400 with multiple error messages when both limit and status are invalid', async () => {
      const res = await request(app).get('/projects?limit=abc&status=unknown')

      expect(res.status).toBe(400)
      expect(res.body.details).toHaveLength(2)
    })

    it('ignores empty string cursor (treated as no cursor)', async () => {
      mockFirestore(makeProjects(2))

      const res = await request(app).get('/projects?cursor=')

      expect(res.status).toBe(200)
      expect(queryChainCalls.startAfter).toBeNull()
    })
  })

  // ── Response shape ──────────────────────────────────────────────────────────

  describe('response shape', () => {
    it('always includes projects array and next_cursor fields', async () => {
      mockFirestore(makeProjects(1))

      const res = await request(app).get('/projects')

      expect(res.body).toHaveProperty('projects')
      expect(res.body).toHaveProperty('next_cursor')
      expect(Array.isArray(res.body.projects)).toBe(true)
    })

    it('maps Firestore doc id to uid field on each project', async () => {
      mockFirestore(makeProjects(2))

      const res = await request(app).get('/projects')

      expect(res.body.projects[0].uid).toBe('proj-1')
      expect(res.body.projects[1].uid).toBe('proj-2')
    })

    it('includes all document fields alongside uid', async () => {
      mockFirestore([
        {
          uid: 'proj-1',
          name: 'Alpha',
          status: 'active',
          member_uids: ['u1'],
          created_at: '2024-01-01T00:00:00.000Z',
        },
      ])

      const res = await request(app).get('/projects')

      const proj = res.body.projects[0]
      expect(proj.uid).toBe('proj-1')
      expect(proj.name).toBe('Alpha')
      expect(proj.status).toBe('active')
      expect(proj.member_uids).toEqual(['u1'])
      expect(proj.created_at).toBe('2024-01-01T00:00:00.000Z')
    })
  })
})
