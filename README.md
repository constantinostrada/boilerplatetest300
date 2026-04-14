# boilerplatetest300

![Built with Chiron](https://img.shields.io/badge/Built%20with-Chiron-blue)

A basic HTML, CSS, and JavaScript boilerplate project.

## Setup

1.  Open `index.html` in your browser.

## Scripts

*   `npm start`: Opens the `index.html` file in your default browser.
*   `npm run docs`: Serves the project locally and opens the interactive API docs (`api-docs.html`) in your browser.
*   `npm run lint`: Runs ESLint on the project.
*   `npm run format`: Runs Prettier to format the project.

---

## API Reference

The full machine-readable spec lives in [`openapi.json`](./openapi.json).  
For an interactive UI open [`api-docs.html`](./api-docs.html) directly in your browser, or run:

```bash
npm run docs
```

All endpoints are prefixed with `/api` and return `application/json`.

---

### `GET /api/counter`

Returns the current counter value.

**Request body:** none

**Responses**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ "value": 400 }` | Current counter value |
| `500` | `{ "error": "..." }` | Unexpected server error |

---

### `POST /api/counter/increment`

Adds `amount` to the counter and returns the updated value.

**Request body** *(optional)*

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `amount` | `integer` | `200` | How much to add |

```json
{ "amount": 200 }
```

**Responses**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ "value": 600 }` | Updated counter value |
| `400` | `{ "error": "amount must be a number" }` | Invalid body |
| `500` | `{ "error": "..." }` | Unexpected server error |

---

### `POST /api/counter/decrement`

Subtracts `amount` from the counter and returns the updated value.

**Request body** *(optional)*

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `amount` | `integer` | `200` | How much to subtract |

```json
{ "amount": 200 }
```

**Responses**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ "value": 200 }` | Updated counter value |
| `400` | `{ "error": "amount must be a number" }` | Invalid body |
| `500` | `{ "error": "..." }` | Unexpected server error |

---

### `POST /api/counter/multiply`

Multiplies the counter by `factor` and returns the updated value.

**Request body** *(optional)*

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `factor` | `number` | `10` | Multiplier to apply |

```json
{ "factor": 10 }
```

**Responses**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ "value": 4000 }` | Updated counter value |
| `400` | `{ "error": "factor must be a number" }` | Invalid body |
| `500` | `{ "error": "..." }` | Unexpected server error |

---

### `POST /api/counter/reset`

Resets the counter to `value` (defaults to `0`) and returns the updated value.

**Request body** *(optional)*

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `value` | `integer` | `0` | Value to reset the counter to |

```json
{ "value": 0 }
```

**Responses**

| Status | Body | Description |
|--------|------|-------------|
| `200` | `{ "value": 0 }` | Updated counter value |
| `400` | `{ "error": "value must be a number" }` | Invalid body |
| `500` | `{ "error": "..." }` | Unexpected server error |

---

### Shared schemas

**`CounterResponse`**
```json
{ "value": 400 }
```
`value` — `integer` — the counter value after the operation.

**`ErrorResponse`**
```json
{ "error": "Internal server error" }
```
`error` — `string` — human-readable description of what went wrong.
