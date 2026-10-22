# HU-10: User Profiles & Preferences

> **Tipo:** Feature · **HU:** HU-10 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario de la API,
quiero que la API conozca mis gustos (géneros, directores, actores favoritos),
para personalizar mi experiencia.

---

## Endpoints

### `GET /users/me/preferences`

Retorna las preferencias del usuario autenticado.

**Respuesta exitosa (200 OK)**

```json
{
  "favoriteGenres": [1, 3, 5],
  "favoriteDirectors": [2, 7],
  "favoriteActors": [10, 15],
  "genreAffinity": { "1": 8.5, "3": 5.0, "5": 3.0 },
  "updatedAt": "2026-10-13T10:00:00Z"
}
```

### `PUT /users/me/preferences`

Actualiza manualmente las preferencias.

**Body**

```json
{
  "favoriteGenres": [1, 3],
  "favoriteDirectors": [2],
  "favoriteActors": [10]
}
```

**Respuesta exitosa (200 OK)**

```json
{
  "favoriteGenres": [1, 3],
  "favoriteDirectors": [2],
  "favoriteActors": [10],
  "genreAffinity": {},
  "updatedAt": "2026-10-13T10:00:00Z"
}
```

### `GET /users/me/preferences/stats`

Estadísticas derivadas de reviews y watchlist.

**Respuesta exitosa (200 OK)**

```json
{
  "topGenres": [
    { "genreId": 1, "genreName": "Drama", "count": 12 },
    { "genreId": 3, "genreName": "Crimen", "count": 8 }
  ],
  "topDirectors": [
    { "directorId": 2, "directorName": "Christopher Nolan", "count": 5 }
  ],
  "totalReviews": 20,
  "totalWatchlist": 15
}
```

---

## Criterios de Aceptación

* **CA-01 — Auth requerido**
  Todos los endpoints requieren JWT. Sin token → 401.

* **CA-02 — PUT acepta arrays vacíos**
  `{ "favoriteGenres": [] }` → limpia géneros favoritos.

* **CA-03 — Validación de genre_id**
  `PUT` con genre_id inexistente → 400.

* **CA-04 — Validación de director_id**
  `PUT` con director_id inexistente → 400.

* **CA-05 — Validación de actor_id**
  `PUT` con actor_id inexistente → 400.

* **CA-06 — Stats basados en datos reales**
  `GET /stats` retorna conteos de reviews y watchlist reales.

* **CA-07 — Actualización automática por review**
  Al crear review, se actualiza `genreAffinity` (+5 rating ≥ 4.5, +3 rating ≥ 3.5, +1 otros).

* **CA-08 — Actualización automática por watchlist**
  Al agregar a watchlist, se actualiza `genreAffinity` (+2 prioridad ≥ 4, +1 otros).

* **CA-09 — Usuario sin interacciones**
  Preferencias vacías, stats en 0. No error.

* **CA-10 — Película con múltiples géneros**
  Suma afinidad a cada género de la película.

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `GET /users/me/preferences` (usuario con historial) | 200 → preferencias con genreAffinity poblado |
| H2 | `PUT /users/me/preferences` con datos válidos | 200 → preferencias actualizadas |
| H3 | `GET /users/me/preferences/stats` | 200 → top géneros y directores basados en datos reales |
| H4 | `PUT /users/me/preferences` con arrays vacíos | 200 → preferencias limpiadas |
| H5 | Review 5★ a película de Drama | `genreAffinity["Drama"]` +5 |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | `PUT` con `favoriteGenres: [9999]` | 400 |
| B2 | `PUT` con `favoriteDirectors: [9999]` | 400 |
| B3 | `PUT` con `favoriteActors: [9999]` | 400 |
| B4 | `PUT` con body vacío `{}` | 400 (al menos un campo requerido) |
| B5 | `PUT` con `favoriteGenres: []` | 200 → limpia géneros favoritos |
| B6 | Usuario sin reviews ni watchlist → `GET /stats` | 200 → conteos en 0 |

---

## Corner Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| C1 | `GET /users/me/preferences` sin auth | 401 |
| C2 | `PUT /users/me/preferences` sin auth | 401 |
| C3 | `PUT` con tipos incorrectos (`favoriteGenres: "drama"`) | 400 |
| C4 | `PUT` con duplicados en array `[1, 1, 3]` | 200 → deduplica |
| C5 | Review de película con múltiples géneros | Suma afinidad a cada género |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | Usuario nuevo sin interacciones | Preferencias vacías, stats en 0 |
| EC2 | Review eliminada | Se recalcula genreAffinity |
| EC3 | Watchlist item eliminado | Se recalcula genreAffinity |
| EC4 | Película con 5 géneros | +5 afinidad a cada uno |

---

## Notas de implementación

1. **Tabla `user_preferences`**: `user_id` (PK, FK), `favorite_genres` (JSON), `favorite_directors` (JSON), `favorite_actors` (JSON), `genre_affinity` (JSON), `updated_at`.

2. **Actualización automática**: en `reviewService.createReview()` y `watchlistService.add()`, se llama a `userPreferencesService.updateGenreAffinity()`.

3. **Delta de afinidad**:
   - Review: rating ≥ 4.5 → +5, rating ≥ 3.5 → +3, otros → +1
   - Watchlist: prioridad ≥ 4 → +2, otros → +1

4. **Validación de IDs**: `PUT` valida que los IDs existan en `genres`, `directors`, `actors` antes de guardar.

---

## Archivos a crear (Estructura de árbol)

```text
source/
├── db/migrations/
│   └── 202610130001_user_preferences.sql          ★ NUEVO
├── domain/
│   └── UserPreferences.ts                          ★ NUEVO
├── repositories/
│   └── UserPreferencesRepository.ts                ★ NUEVO
├── services/
│   ├── userPreferencesService.ts                   ★ NUEVO
│   ├── reviewService.ts                            ✎ + updateGenreAffinity
│   └── WatchlistService.ts                         ✎ + updateGenreAffinity
├── controllers/
│   └── userPreferencesController.ts                ★ NUEVO
├── routes/
│   └── userPreferencesRoutes.ts                    ★ NUEVO
├── schemas/
│   └── userPreferences.ts                          ★ NUEVO
├── types/
│   └── user.ts                                     ✎ + UserPreferencesRow/Response
├── api.ts                                          ✎ wirear
└── __tests__/
    ├── unit/
    │   └── userPreferences.test.ts                 ★ NUEVO
    └── integration/
        └── user-preferences.integration.test.ts   ★ NUEVO
```

---

## Diagrama de flujo (textual)

```text
Request: PUT /users/me/preferences
  │
  ├─ userPreferencesRoutes.ts → router.put('/me/preferences', requireAuth, controller.updatePreferences)
  │
  ├─ userPreferencesController.ts → updateUserPreferencesSchema.safeParse(req.body)
  │    └─ valida: favoriteGenres (array de ints), favoriteDirectors, favoriteActors
  │    └─ si falla → 400
  │
  ├─ userPreferencesService.ts → updatePreferences(userId, dto)
  │    └─ valida que genre_ids existan en DB
  │    └─ valida que director_ids existan en DB
  │    └─ valida que actor_ids existan en DB
  │    └─ si algún ID no existe → 400
  │    └─ upsert en user_preferences
  │
  ├─ UserPreferencesRepository.upsert()
  │    └─ UPDATE si existe, INSERT si no
  │
  └─ Response: 200 OK → preferencias actualizadas
```

```text
Request: POST /movies/:id/reviews (flujo automático)
  │
  ├─ reviewService.createReview()
  │    └─ reviewRepository.upsert()
  │    └─ delta = rating >= 4.5 ? 5 : rating >= 3.5 ? 3 : 1
  │    └─ updateGenreAffinityForMovie(userId, movieId, delta)
  │         └─ SELECT genre_id FROM movie_genres WHERE movie_id = ?
  │         └─ for each genre: userPreferencesService.updateGenreAffinity(userId, genreId, delta)
  │
  └─ userPreferencesService.updateGenreAffinity()
       └─ UserPreferencesRepository.updateGenreAffinity()
            └─ parse JSON genre_affinity, sumar delta, guardar
```
