'use strict'

/**
 * Data-access layer for the "projects" Firestore collection.
 *
 * Cursor strategy
 * ───────────────
 * The cursor is the base-64 encoded Firestore document ID of the last document
 * returned in the previous page.  On each request we:
 *   1. Resolve the cursor document snapshot (startAfter requires a snapshot).
 *   2. Apply filters + ordering.
 *   3. Fetch limit + 1 documents.  If we get limit + 1 back we know there is a
 *      next page and we slice the extra item off before returning.
 *
 * Composite index required (see firestore.indexes.json):
 *   Collection : projects
 *   Fields     : status ASC, created_at ASC
 *
 * That index also satisfies queries that filter only by status (Firestore can
 * use a prefix of a composite index).  The member_uid filter uses an
 * array-contains query on a `member_uids` array field – no extra index is
 * needed beyond the default single-field ones, but if combined with status it
 * will need a composite index (also declared in firestore.indexes.json).
 */

const { db } = require('../firebase')

const COLLECTION = 'projects'

/**
 * Encode a Firestore document ID into an opaque cursor string.
 * @param {string} docId
 * @returns {string}
 */
function encodeCursor(docId) {
  return Buffer.from(docId, 'utf8').toString('base64url')
}

/**
 * Decode a cursor string back to a Firestore document ID.
 * @param {string} cursor
 * @returns {string}
 */
function decodeCursor(cursor) {
  return Buffer.from(cursor, 'base64url').toString('utf8')
}

/**
 * Fetch a page of projects from Firestore.
 *
 * @param {object} options
 * @param {number}       options.limit     – max documents to return (1–100)
 * @param {string|null}  options.cursor    – opaque pagination cursor
 * @param {string|null}  options.status    – filter: "active" | "archived"
 * @param {string|null}  options.memberUid – filter: member UID
 * @returns {Promise<{ projects: object[], next_cursor: string|null }>}
 */
async function listProjects({ limit, cursor, status, memberUid }) {
  let query = db.collection(COLLECTION)

  // ── filters ───────────────────────────────────────────────────────────────
  if (status) {
    query = query.where('status', '==', status)
  }

  if (memberUid) {
    // Assumes the document stores members as: member_uids: string[]
    query = query.where('member_uids', 'array-contains', memberUid)
  }

  // ── ordering (required for stable cursor pagination) ─────────────────────
  query = query.orderBy('created_at', 'asc')

  // ── cursor ────────────────────────────────────────────────────────────────
  if (cursor) {
    const docId = decodeCursor(cursor)
    const cursorSnap = await db.collection(COLLECTION).doc(docId).get()

    if (!cursorSnap.exists) {
      // Cursor document was deleted – treat as first page rather than erroring
      // so the client gracefully falls back to page 1.
    } else {
      query = query.startAfter(cursorSnap)
    }
  }

  // ── fetch limit + 1 to detect next page ──────────────────────────────────
  query = query.limit(limit + 1)

  const snapshot = await query.get()
  const docs = snapshot.docs

  const hasNextPage = docs.length > limit
  const pageDocs = hasNextPage ? docs.slice(0, limit) : docs

  const projects = pageDocs.map((doc) => ({
    uid: doc.id,
    ...doc.data(),
  }))

  const nextCursor = hasNextPage ? encodeCursor(pageDocs[pageDocs.length - 1].id) : null

  return { projects, next_cursor: nextCursor }
}

module.exports = { listProjects, encodeCursor, decodeCursor }
