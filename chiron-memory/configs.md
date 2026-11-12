# config

Setup and configuration — env vars, flags, how to run the project.

## Fun Facts API runtime configuration

What: npm run start:api starts the server; FUN_FACTS_PORT (default 4100) and FUN_FACTS_DB_PATH (default server/data/fun-facts.db, auto-created and auto-seeded, gitignored) configure it; requires Node >= 22.13 · Why: the SQLite file must stay out of git and tests need to point the DB at throwaway paths · Where: server/index.js, server/db.js
