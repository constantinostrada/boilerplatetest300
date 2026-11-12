# Fun Facts API — contrato

API HTTP para listar y agregar los chistes/datos curiosos ("fun facts") del
boilerplate. Pensada para ser consumida desde la página estática
`fun-facts.html` vía `fetch` desde el navegador.

## Cómo levantar el servidor

```bash
npm install
npm run start:api
```

- Requiere **Node.js >= 22.13** (usa el módulo nativo `node:sqlite`).
- Escucha en `http://localhost:4100` (configurable con `FUN_FACTS_PORT`).
- La base de datos SQLite se crea sola en `server/data/fun-facts.db`
  (configurable con `FUN_FACTS_DB_PATH`). En el primer arranque se siembran
  8 fun facts iniciales; el seed no se repite si ya hay datos.
- CORS está habilitado para **cualquier origen** (`Access-Control-Allow-Origin: *`),
  así que la página estática puede consumirla sirviéndose desde `file://`,
  `http://localhost:*` o cualquier otro origen.

## Modelo

Un **fun fact**:

```json
{
  "id": 7,
  "text": "Sobreviví a tres tareas de desarrollo sin un solo test.",
  "createdAt": "2026-11-12T21:35:44.823Z"
}
```

| Campo       | Tipo   | Notas                                      |
| ----------- | ------ | ------------------------------------------ |
| `id`        | number | Autoincremental, único.                    |
| `text`      | string | 1–500 caracteres (ya normalizado con trim).|
| `createdAt` | string | Timestamp ISO 8601 UTC, asignado por la DB.|

## Endpoints

### `GET /api/fun-facts` — listar todos

Devuelve todos los fun facts persistidos, ordenados por `id` ascendente
(los más viejos primero; el seed son los ids más bajos).

**Respuesta `200`:**

```json
{
  "facts": [
    { "id": 1, "text": "…", "createdAt": "2026-11-12T21:35:44.823Z" },
    { "id": 2, "text": "…", "createdAt": "2026-11-12T21:35:44.823Z" }
  ]
}
```

```bash
curl http://localhost:4100/api/fun-facts
```

### `POST /api/fun-facts` — agregar uno

**Petición:** `Content-Type: application/json`

```json
{ "text": "Mi chiste nuevo sobre el boilerplate" }
```

Reglas de validación sobre `text`:

- Obligatorio, tipo string.
- No puede ser vacío ni solo espacios (se aplica `trim` antes de guardar).
- Máximo **500** caracteres después del trim.

**Respuesta `201`** — el fact creado, con su `id` y `createdAt`:

```json
{ "fact": { "id": 9, "text": "Mi chiste nuevo sobre el boilerplate", "createdAt": "…" } }
```

**Respuesta `400`** — validación fallida; `error.field` indica qué campo falló:

```json
{ "error": { "field": "text", "message": "El campo \"text\" es obligatorio y no puede estar vacío." } }
```

```json
{ "error": { "field": "text", "message": "El campo \"text\" supera el máximo de 500 caracteres (tiene 512)." } }
```

Un body que no es JSON válido también devuelve `400` (sin `field`).

```bash
curl -X POST http://localhost:4100/api/fun-facts \
  -H 'Content-Type: application/json' \
  -d '{"text": "Mi chiste nuevo sobre el boilerplate"}'
```

### `GET /api/health` — health check

**Respuesta `200`:** `{ "status": "ok" }`

## Errores

Todas las respuestas de error tienen la forma:

```json
{ "error": { "message": "…", "field": "text (solo en errores de validación)" } }
```

| Código | Cuándo                                                              |
| ------ | ------------------------------------------------------------------- |
| `400`  | Validación de entrada fallida o JSON malformado.                    |
| `404`  | Ruta/método inexistente.                                            |
| `503`  | La base de datos no puede abrirse o escribirse. Reintentar después. |
| `500`  | Error interno inesperado.                                           |

El servidor no crashea ante fallos de la DB: responde `503` y reintenta abrir
la base en la próxima petición.

## Ejemplo de consumo desde el navegador

```js
const API = 'http://localhost:4100';

const { facts } = await (await fetch(`${API}/api/fun-facts`)).json();

const res = await fetch(`${API}/api/fun-facts`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text: 'Nuevo fun fact' }),
});
if (res.status === 201) {
  const { fact } = await res.json();
} else {
  const { error } = await res.json(); // error.message es mostrable al usuario
}
```
