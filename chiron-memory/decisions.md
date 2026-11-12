# decision

A choice made and the reasoning behind it — the path taken over the alternatives.

## node:sqlite chosen as the SQLite driver

What: The fun-facts backend uses Node's built-in node:sqlite (DatabaseSync) instead of better-sqlite3 or sqlite3 · Why: zero extra dependencies and no native compilation step — the project runs Node 24 where node:sqlite is available (requires >= 22.13); better-sqlite3 was the discarded alternative · Where: server/db.js · Learned: check the runtime's built-ins before adding a native dependency

## Fun Facts API defaults to port 4100

What: The API listens on 4100 by default (overridable with FUN_FACTS_PORT) · Why: port 3000 is occupied by Docker on the dev machine, which silently answered requests meant for the API · Where: server/index.js

## DB failures return 503 instead of crashing

What: All SQLite failures are wrapped into DatabaseUnavailableError and mapped to HTTP 503; the handle is reset so the next request retries opening · Why: the work order requires the process to survive an unopenable/unwritable DB file and answer with a clear 5xx · Where: server/db.js (withDb/getDb), server/index.js (error middleware)
