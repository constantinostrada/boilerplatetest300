// Fun Facts API — HTTP contract documented in docs/api-fun-facts.md
const express = require('express');
const cors = require('cors');
const { listFacts, addFact, DatabaseUnavailableError } = require('./db');

const PORT = process.env.FUN_FACTS_PORT || 4100;
const MAX_TEXT_LENGTH = 500;

const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/api/fun-facts', (req, res, next) => {
  try {
    res.json({ facts: listFacts() });
  } catch (err) {
    next(err);
  }
});

app.post('/api/fun-facts', (req, res, next) => {
  try {
    const raw = req.body?.text;
    if (typeof raw !== 'string' || raw.trim() === '') {
      return res.status(400).json({
        error: { field: 'text', message: 'El campo "text" es obligatorio y no puede estar vacío.' },
      });
    }
    const text = raw.trim();
    if (text.length > MAX_TEXT_LENGTH) {
      return res.status(400).json({
        error: {
          field: 'text',
          message: `El campo "text" supera el máximo de ${MAX_TEXT_LENGTH} caracteres (tiene ${text.length}).`,
        },
      });
    }
    res.status(201).json({ fact: addFact(text) });
  } catch (err) {
    next(err);
  }
});

app.use((req, res) => {
  res.status(404).json({ error: { message: `No existe ${req.method} ${req.path}` } });
});

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof DatabaseUnavailableError) {
    console.error('DB unavailable:', err.cause?.message || err.message);
    return res.status(503).json({
      error: { message: 'La base de datos no está disponible en este momento. Intentá de nuevo más tarde.' },
    });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: { message: 'El cuerpo de la petición no es JSON válido.' } });
  }
  console.error('Unexpected error:', err);
  res.status(500).json({ error: { message: 'Error interno del servidor.' } });
});

app.listen(PORT, () => {
  console.log(`Fun Facts API escuchando en http://localhost:${PORT}`);
});
