# HU-9: Sugerencia de Película Incompleta (Autocomplete)

Como usuario de la API,  
quiero recibir sugerencias automáticas mientras escribo en un campo de búsqueda de título, director o género,  
para encontrar resultados más rápido sin necesidad de escribir el término completo.

---

## Endpoint

`GET /movies/suggest?q={prefix}&field={title|director|genre}&limit={n}`

### Respuesta exitosa (200 OK)

```json
["Inception", "Inception 2"]
```

---

## Criterios de Aceptación

* **CA-01 — Búsqueda por prefijo en título**  
  `GET /movies/suggest?q=Incep&field=title` → `["Inception", "Inception 2"]`  
  Solo devuelve títulos que empiecen con `"Incep"` (case-insensitive).

* **CA-02 — Búsqueda por prefijo en director**  
  `GET /movies/suggest?q=Christ&field=director` → `["Christopher Nolan"]`  
  Busca en `directors.director_name` con `LIKE 'Christ%'`.

* **CA-03 — Búsqueda por prefijo en género**  
  `GET /movies/suggest?q=Act&field=genre` → `["Action", "Action Adventure"]`  
  Busca en `genres.genre_name` con `LIKE 'Act%'`.

* **CA-04 — Respuesta plana y liviana**  
  Devuelve un array de strings, no objetos `Movie`. Sin paginación, sin metadatos.

* **CA-05 — Límite configurable por query**  
  `?limit=3` → máximo 3 sugerencias. Por defecto: `8`. Máximo permitido: `20`.

* **CA-06 — Case-insensitive**  
  `?q=incep` y `?q=Incep` devuelven el mismo resultado.

* **CA-07 — Sin resultados**  
  `?q=Zzzzz&field=title` → `[]` (array vacío, no error 404).

* **CA-08 — Distinct automático**  
  Si hay títulos duplicados (no debería, pero por seguridad), se devuelven sin repetir.

* **CA-09 — Validación de field**  
  `?q=foo&field=invalid` → `400` con error `"field debe ser uno de: title, director, genre"`.

* **CA-10 — Validación de q**  
  `?q=&field=title` (vacío) → `400`.  
  `?q=ab&field=title` (menos de 3 caracteres) → `400`.  
  Mínimo 3 caracteres para evitar consultas demasiado amplias.

---


## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `?q=Inc&field=title` | ✅ 200 → `["Inception"]` — prefijo normal, 1 resultado |
| H2 | `?q=Incep&field=title` | ✅ 200 → `["Inception", "Inception 2"]` — prefijo, múltiples resultados |
| H3 | `?q=Christ&field=director` | ✅ 200 → `["Christopher Nolan"]` — prefijo en director |
| H4 | `?q=act&field=genre` | ✅ 200 → `["action"]` — prefijo en género (case-insensitive) |
| H5 | `?q=The&field=title` | ✅ 200 → hasta 8 títulos (default limit) — muchos resultados |
| H6 | `?q=The&field=title&limit=3` | ✅ 200 → máximo 3 resultados — limit explícito |
| H7 | `?q=ZZZ&field=title` | ✅ 200 → `[]` — sin resultados |
| H8 | `?q=INCEP&field=title` | ✅ 200 → `["Inception"]` — case-insensitive (mayúsculas) |
| H9 | `?q=incep&field=title` | ✅ 200 → `["Inception"]` — case-insensitive (minúsculas) |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | `?q=abc&field=title` | ✅ 200 — justo en el mínimo de 3 caracteres |
| B2 | `?q=ab&field=title` | ❌ 400 — 1 char por debajo del mínimo |
| B3 | `?q=&field=title` | ❌ 400 — q vacío |
| B4 | `?limit=1&q=The&field=title` | ✅ 200 — mínimo de limit (1) |
| B5 | `?limit=20&q=The&field=title` | ✅ 200 — máximo de limit (20) |
| B6 | `?limit=21&q=The&field=title` | ❌ 400 — 1 por encima del máximo |
| B7 | `?q=In&limit=0&field=title` | ❌ 400 — limit=0 no es positivo |
| B8 | `?q=In&limit=-1&field=title` | ❌ 400 — limit negativo |
| B9 | `?q=In&limit=8.5&field=title` | ❌ 400 — limit decimal (Zod espera int) |
| B10 | `?q=In&field=title&limit=` | ❌ 400 — limit vacío (Zod falla coerce) |
| B11 | `?q=` + 100 caracteres + `&field=title` | ✅ 200 — justo en el máximo de 100 caracteres |
| B12 | `?q=` + 101 caracteres + `&field=title` | ❌ 400 — 1 por encima del máximo |

---

## Corner Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| C1 | Sin query params (`GET /movies/suggest`) | ❌ 400 — q y field requeridos |
| C2 | `?q=Inc` (sin field) | ❌ 400 — field requerido |
| C3 | `?field=title` (sin q) | ❌ 400 — q requerido |
| C4 | `?q=Inc&field=actor` | ❌ 400 — field inválido (solo title/director/genre) |
| C5 | `?q=%20%20Inc&field=title` | ❌ 400 — q son solo espacios (trim → "Inc") → ✅ 200 (después de trimear > 3 chars) |
| C6 | `?q=%20ab&field=title` | ❌ 400 — q con espacios al inicio, después de trimear queda "ab" < 3 |
| C7 | `?q=';DROP TABLE movies;--&field=title` | ✅ 200 → `[]` — SQL injection prevenido por parámetros preparados |
| C8 | `?q=The&field=title&limit=abc` | ❌ 400 — limit no es número |
| C9 | `?q=The&field=title&limit=999` | ❌ 400 — limit excede máximo 20 |
| C10 | `?q=The&field=title&limit=-5` | ❌ 400 — limit negativo |
| C11 | `?q=The%20Dark&field=title` | ✅ 200 → `["The Dark Knight", "The Dark Knight Rises"]` — prefijo con espacios |
| C12 | `?q=José&field=director` | ✅ 200 — caracteres acentuados (collation utf8mb4_general_ci) |
| C13 | `?q=Jose&field=director` | ✅ 200 — busca sin acento vs dato con acento (collation lo considera igual) |
| C14 | `?q=Incep&field=title&limit=8` (request duplicado) | ✅ 200 — idempotente, mismo resultado siempre |
| C15 | `?q=Th&field=title` | ❌ 400 — 2 caracteres (abajo del mínimo) pero es un prefijo válido de muchos títulos |```
## Edge Cases

| # | Caso | Entrada | Comportamiento esperado |
|---|---|---|---|
| **EC1** | `q` demasiado corto | `?q=In&field=title` | `400` — mínimo 3 caracteres |
| **EC2** | `q` con espacios al inicio | `?q= Incep&field=title` | `400` o trim → `"Incep"` |
| **EC3** | `field` inválido | `?q=Foo&field=actor` | `400` — field inválido |
| **EC4** | Sin `field` | `?q=Foo` | `400` — field requerido |
| **EC5** | Sin `q` | `?field=title` | `400` — q requerido |
| **EC6** | Sin parámetros | `GET /movies/suggest` | `400` |
| **EC7** | `limit` negativo o cero | `?q=Inc&field=title&limit=-1` | `400` — limit debe ser positivo |
| **EC8** | `limit > 20` | `?q=Inc&field=title&limit=100` | `400` o clamped a 20 |
| **EC9** | Case insensitive | `?q=incep` vs `?q=INCEP` vs `?q=Incep` | Mismos resultados |
| **EC10** | Caracteres especiales (SQL injection) | `?q='; DROP TABLE movies;--&field=title` | Escapado por parámetros preparados → `[]` |
| **EC11** | Acentos y Unicode | `?q=José&field=director` | Busca correctamente José |
| **EC12** | Títulos muy largos | `?q=The Lord of the Rings: The Return of the King&field=title` | Match por prefijo normal |
| **EC13** | Muchos matches | `?q=The&field=title&limit=5` | Solo 5 resultados (top N) |
| **EC14** | Director sin películas asociadas | Query en directors | No aplica porque el repo solo tiene directores con películas |
| **EC15** | Género con `&` en el nombre (`R&B`) | `?q=R%26B&field=genre` | URL-decode correcto, busca R&B |

---

## Notas de implementación

Capa de datos: 3 queries simples y separadas (una por tabla):
* **title:** `SELECT DISTINCT title FROM movies WHERE title LIKE ? COLLATE utf8mb4_general_ci LIMIT ?`
* **director:** `SELECT DISTINCT director_name FROM directors WHERE director_name LIKE ? COLLATE utf8mb4_general_ci LIMIT ?`
* **genre:** `SELECT DISTINCT genre_name FROM genres WHERE genre_name LIKE ? COLLATE utf8mb4_general_ci LIMIT ?`

> **Nota:** Sin `JOIN`s, sin `GROUP BY`, sin `ORDER BY` (el orden natural está bien para top-N). Sin caché por ahora (fácil de agregar después si es necesario). Se puede agregar al `MovieRepository` (para title) y a `DirectorRepository`/`GenreRepository` (para sus respectivos campos), o crear un `SuggestService` que orqueste los 3 repos.

---

## Archivos a crear (Estructura de árbol)

```text
source/
├── schemas/
│   └── suggestQuery.ts                  ★ NUEVO
├── repositories/
│   ├── MovieRepository.ts               ✎ + suggestTitle()
│   ├── DirectorRepository.ts            ✎ + suggestDirector()
│   └── GenreRepository.ts               ✎ + suggestGenre()
├── services/
│   └── movieService.ts                  ✎ + suggest()
├── controllers/
│   └── movieController.ts               ✎ + suggest handler
├── routes/
│   └── movieRoutes.ts                   ✎ + GET /suggest
├── __tests__/
│   ├── unit/
│   │   └── movies.suggest.test.ts       ★ NUEVO
│   └── integration/
│       └── movies.suggest.integration.test.ts ★ NUEVO
└── docs/
    └── features/
        └── feature-suggest.md           ✎ poblar
```

---

## Notas técnicas

1. **Orden de rutas (crítico)**  
   `GET /suggest` debe declararse antes de `GET /:id` en `movieRoutes.ts`. Si `/:id` está primero, Express interpreta `suggest` como un `:id` y falla.

2. **SQL único por repositorio, sin lógica compartida**  
   Cada repo tiene su propio método `suggestX(prefix, limit)` con `SELECT DISTINCT ... WHERE col LIKE ? COLLATE utf8mb4_general_ci LIMIT ?`. Sin `JOIN`s, sin subqueries, sin `ORDER BY`. Tres queries independientes y optimizadas.

3. **Collation para case/accent insensitive**  
   `COLLATE utf8mb4_general_ci` en el `LIKE`. Alternativa portable: `LOWER(col) LIKE LOWER(?)` — pero la DB ya usa MySQL, collation es más performante.

4. **Mínimo 3 caracteres en q**  
   `z.string().min(3)` en el schema. Los espacios se trimean automáticamente porque Zod trimea strings por defecto. Si después de trimear queda `< 3 chars` → `ZodError` → `400`.

5. **Sin paginación, sin metadatos**  
   El endpoint devuelve `string[]` plano. No `{ data, meta }`. El frontend recibe `["Inception", "Inception 2"]` directamente.

6. **Validación en schema, no en controller**  
   `controller.suggest` solo llama a `suggestQuerySchema.parse(req.query)`. Si falla, el error handler global de Express (`api.ts:57`) captura el `ZodError` y devuelve `400` automáticamente. No hay `try/catch` manual.

7. **Mock del service en tests unitarios**  
   Sigue el patrón de `movies.search.test.ts`: crear objeto con `jest.fn()` para todos los métodos + `suggest` y pasarlo a `createApp(mockService as any)`.

8. **Seed data existente ya cubre los casos**  
   El `seedTestData()` en `__tests__/helpers/db.ts` ya incluye:
   * **Títulos:** `"Inception"`, `"Interstellar"`, `"Interstellar 2"`, `"The Dark Knight"`, etc.
   * **Directores:** `"Christopher Nolan"`, `"Frank Darabont"`, etc.
   * **Géneros:** `"action"`, `"sci-fi"`, `"drama"`, `"crime"`, `"horror"`, `"noir"`.  
   Esto alcanza para todos los tests de integración.

---

## Diagrama de flujo (textual)

```text
Request: GET /movies/suggest?q=Incep&field=title&limit=5
  │
  ├─ movieRoutes.ts → router.get('/suggest', controller.suggest)
  │
  ├─ movieController.ts → suggestQuerySchema.parse(req.query)
  │    └─ valida: q (min 3), field (enum), limit (default 8, max 20)
  │    └─ si falla → ZodError → error handler → 400
  │
  ├─ movieService.ts → suggest({ q: 'Incep', field: 'title', limit: 5 })
  │    └─ field = 'title'    → movieRepo.suggestTitle('Incep', 5)
  │    └─ field = 'director' → directorRepo.suggestDirector('Incep', 5)
  │    └─ field = 'genre'    → genreRepo.suggestGenre('Incep', 5)
  │
  ├─ MovieRepository.suggestTitle()
  │    └─ SQL: SELECT DISTINCT title FROM movies WHERE title LIKE 'Incep%' LIMIT 5
  │
  └─ Response: 200 OK → ["Inception", "Inception 2"]
```

## Preguntas y Respuesta con chat IA

a medida que el usuario escribe va haciendo peticiones a la db luego de >3 de longitud?

Buena observación. Esa decisión es del **frontend**, no del backend. La API solo define la regla:

- **Backend**: rechaza con `400` si `q` < 3 caracteres
- **Frontend**: debería **no llamar al endpoint** hasta que el input tenga ≥ 3 caracteres

El comportamiento ideal del frontend sería:

```
Input: ""       → no request (inactivo)
Input: "I"      → no request (< 3)
Input: "In"     → no request (< 3)
Input: "Inc"    → request GET /movies/suggest?q=Inc&field=title   ← primer request
Input: "Ince"   → request GET /movies/suggest?q=Ince&field=title  ← con debounce 300ms
Input: "Incep"  → request GET /movies/suggest?q=Incep&field=title ← con debounce 300ms
```

El **debounce de ~300ms** evita saturar la DB mientras el usuario escribe rápido. Sin debounce, tipear "Inception" (9 caracteres) dispararía 7 requests en ~~500ms. Con debounce, solo 2~~3 requests.

**¿Quieres incluir una recomendación de debounce (300ms) en la documentación del endpoint?**

## Notas de implementación

### Debounce (frontend)
El frontend debe implementar un debounce de mínimo 300ms antes de llamar
al endpoint, para evitar saturar la DB mientras el usuario escribe rápido.
No se debe llamar al endpoint si q.length < 3.

### Frontend de prueba
Ver `frontend/suggest-test.html` — HTML auto-contenido para validar
la API manualmente. Apunta a http://localhost:8089.