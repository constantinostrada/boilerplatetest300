/**
 * Firebase Admin SDK initialisation.
 *
 * The module exports a ready-to-use Firestore instance so that the rest of
 * the application never has to worry about initialisation order.
 *
 * Environment variables (set via your deployment platform or a .env loader):
 *   GOOGLE_APPLICATION_CREDENTIALS – path to a service-account JSON file, OR
 *   FIREBASE_PROJECT_ID / FIREBASE_CLIENT_EMAIL / FIREBASE_PRIVATE_KEY –
 *     individual credential fields (useful for secret managers / CI).
 */

'use strict'

const admin = require('firebase-admin')

if (!admin.apps.length) {
  const { FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY } = process.env

  const credential =
    FIREBASE_PROJECT_ID && FIREBASE_CLIENT_EMAIL && FIREBASE_PRIVATE_KEY
      ? admin.credential.cert({
          projectId: FIREBASE_PROJECT_ID,
          clientEmail: FIREBASE_CLIENT_EMAIL,
          // Cloud Run / Kubernetes encode the key with literal \n – decode it.
          privateKey: FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        })
      : admin.credential.applicationDefault()

  admin.initializeApp({ credential })
}

const db = admin.firestore()

module.exports = { db }
