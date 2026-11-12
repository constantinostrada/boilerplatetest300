# gotcha

A non-obvious pitfall or trap, learned the hard way.

## Port 3000 is silently hijacked by Docker on this machine

What: Docker listens on *:3000 (IPv6); a node server can bind 3000 on IPv4 and log "listening" while curl/localhost requests actually reach Docker's proxy · Why: produces baffling "Cannot GET" responses from the wrong server with no error anywhere · Where: server/index.js (hence default port 4100) · Learned: when a freshly started server gives alien responses, lsof the port before debugging the code

## ESLint env is browser-only at the root

What: The root .eslintrc.js sets env browser; server-side files need the overrides block with env node or require/module/process fail no-undef · Why: the project was purely static before the backend existed · Where: .eslintrc.js (overrides for server/**)

## node:sqlite prints an ExperimentalWarning on Node 24

What: Every process that loads node:sqlite emits "SQLite is an experimental feature" on stderr · Why: the module is stable enough for this use but still flagged; the warning is noise, not an error — don't chase it · Where: server/db.js
