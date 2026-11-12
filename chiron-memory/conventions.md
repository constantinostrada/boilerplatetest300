# convention

A rule the codebase follows — naming, patterns, and where things live.

## API error responses use { error: { message, field? } }

What: Every non-2xx response from the fun-facts API has the shape { error: { message, field? } }, with field present on validation errors · Why: the front end can show error.message directly and highlight the failing field without parsing strings · Where: server/index.js, docs/api-fun-facts.md
