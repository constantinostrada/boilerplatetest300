// Data layer for fun facts, backed by SQLite (node:sqlite, no native deps).
// The database handle is created lazily and re-attempted on each access so a
// broken DB file turns into a DatabaseUnavailableError (-> HTTP 503) instead
// of crashing the process at startup.
const { DatabaseSync } = require('node:sqlite');
const fs = require('node:fs');
const path = require('node:path');

const DATA_DIR = process.env.FUN_FACTS_DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = process.env.FUN_FACTS_DB_PATH || path.join(DATA_DIR, 'fun-facts.db');

const SEED_FACTS = [
  'Nací siendo un index.html vacío y hoy tengo un contador que suma de a 200. El crecimiento personal existe.',
  'Mi terapeuta dice que tengo complejo de framework, pero yo sé que soy feliz siendo vanilla JS.',
  'No tengo build step. Cuando los otros proyectos hablan de webpack en las fiestas, yo asiento y sonrío.',
  'Una vez un desarrollador me corrió con npm start y simplemente... abrió un archivo. Ese soy yo. Sin magia, sin mentiras.',
  'Mi contador multiplica por 10 porque soñar en grande es gratis y no requiere dependencias.',
  'Dicen que soy un boilerplate "básico". Prefiero el término "minimalista de nacimiento".',
  'Sobreviví a tres tareas de desarrollo sin un solo test. No me juzguen, júzguenme en producción.',
  'Hoy me agregaron un backend. Después de toda una vida estático, por fin siento que me muevo.',
];

class DatabaseUnavailableError extends Error {
  constructor(message, cause) {
    super(message);
    this.name = 'DatabaseUnavailableError';
    this.cause = cause;
  }
}

let db = null;

function open() {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
  const handle = new DatabaseSync(DB_PATH);
  // WAL keeps readers and the (serialized) writer from blocking each other.
  handle.exec('PRAGMA journal_mode = WAL;');
  handle.exec(`
    CREATE TABLE IF NOT EXISTS fun_facts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
    );
  `);
  const { count } = handle.prepare('SELECT COUNT(*) AS count FROM fun_facts').get();
  if (count === 0) {
    const insert = handle.prepare('INSERT INTO fun_facts (text) VALUES (?)');
    for (const text of SEED_FACTS) insert.run(text);
  }
  return handle;
}

function getDb() {
  if (db) return db;
  try {
    db = open();
    return db;
  } catch (cause) {
    db = null;
    throw new DatabaseUnavailableError('No se pudo abrir la base de datos de fun facts', cause);
  }
}

// Wraps a DB operation so any SQLite failure (file deleted, disk full,
// permissions) surfaces as DatabaseUnavailableError and forces a reopen
// attempt on the next call.
function withDb(fn) {
  const handle = getDb();
  try {
    return fn(handle);
  } catch (cause) {
    if (cause instanceof DatabaseUnavailableError) throw cause;
    try {
      handle.close();
    } catch {
      // already unusable
    }
    db = null;
    throw new DatabaseUnavailableError('Falló la operación sobre la base de datos de fun facts', cause);
  }
}

function listFacts() {
  return withDb((handle) =>
    handle.prepare('SELECT id, text, created_at AS createdAt FROM fun_facts ORDER BY id').all()
  );
}

function addFact(text) {
  return withDb((handle) => {
    const { lastInsertRowid } = handle.prepare('INSERT INTO fun_facts (text) VALUES (?)').run(text);
    return handle
      .prepare('SELECT id, text, created_at AS createdAt FROM fun_facts WHERE id = ?')
      .get(lastInsertRowid);
  });
}

module.exports = { listFacts, addFact, DatabaseUnavailableError, DB_PATH };
