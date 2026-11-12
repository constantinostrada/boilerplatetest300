# boilerplatetest300

![Built with Chiron](https://img.shields.io/badge/Built%20with-Chiron-blue)

A basic HTML, CSS, and JavaScript boilerplate project.

## Setup

1.  Open `index.html` in your browser.

## Scripts

*   `npm start`: Opens the `index.html` file in your default browser.
*   `npm run start:api`: Starts the Fun Facts API server (Express + SQLite) on `http://localhost:4100`.
*   `npm run lint`: Runs ESLint on the project.
*   `npm run format`: Runs Prettier to format the project.

## Fun Facts API

The project includes a small backend (`server/`) that persists fun facts in a
SQLite database. The HTTP contract is documented in
[`docs/api-fun-facts.md`](docs/api-fun-facts.md). Requires Node.js >= 22.13.
