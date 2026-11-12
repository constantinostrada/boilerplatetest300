# architecture

How the system is put together — layers, boundaries, and how data flows.

## First backend: Express API in server/, static front unchanged

What: The project now has a backend (server/index.js HTTP layer + server/db.js data layer, SQLite file in server/data/, gitignored) while the front end stays static and buildless; they talk only via the HTTP API · Why: fun facts need persistence shared across users, and front and back are built as parallel work orders against a documented contract · Where: server/, docs/api-fun-facts.md
