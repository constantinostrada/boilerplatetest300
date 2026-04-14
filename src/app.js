'use strict'

const express = require('express')
const projectsRouter = require('./routes/projects')

const app = express()

app.use(express.json())

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/projects', projectsRouter)

// ── Global error handler ──────────────────────────────────────────────────────
// Must be defined with four parameters so Express recognises it as an error
// handler and routes uncaught errors here.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, _next) => {
  console.error(err)
  const status = err.status || err.statusCode || 500
  const message = err.message || 'Internal Server Error'
  return res.status(status).json({ error: message })
})

// ── Start ─────────────────────────────────────────────────────────────────────
if (require.main === module) {
  const PORT = process.env.PORT || 3000
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`)
  })
}

module.exports = app
