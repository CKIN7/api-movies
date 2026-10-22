# HU-12 / F0: User Profiles & Preferences 2.0 — Deuda técnica

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F0 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario de la API,
quiero que mis preferencias se reflejen de inmediato en mis recomendaciones y que la API sea consistente y observable,
para que la personalización no quede "congelada" ni falle en silencio.

Esta es la **fase 0** de la feature *User Profiles & Preferences 2.0*. No añade endpoints ni tablas:
solo cierra cuatro problemas reales detectados en el código actual.

---

## Contexto

`user_preferences` (`db/schema.sql:127`) ya almacena favoritos explícitos (`favorite_genres`,
`favorite_directors`, `favorite_actors`) y afinidad implícita (`genre_affinity`). El motor de
recomendaciones los consume para el tipo `hybrid` (`services/recommendationService.ts:245`).

Las demás mutaciones del sistema invalidan la caché de recomendaciones:

* `reviewService`: create/update/delete → `invalidateUserRecommendations` (`services/reviewService.ts:70,133,159`)
* `WatchlistService`: add/remove → `invalidateUserRecommendations` (`services/WatchlistService.ts:44,101`)

Preferencias es la única ruta que se olvidó de hacerlo. Además el schema acepta arrays sin límite,
`updatedAt` no es determinista y los errores de afinidad se silencian.

---

## Alcance

| # | Cambio | Archivo(s) |
|---|--------|------------|
| F0.1 | Invalidar recomendaciones al actualizar preferencias | `services/userPreferencesService.ts` |
| F0.2 | Límite (50) y dedupe en los arrays de favoritos | `schemas/userPreferences.ts` |
| F0.3 | `updatedAt: null` determinista cuando no hay fila | `services/userPreferencesService.ts`, `types/user.ts` |
| F0.4 | Observabilidad de fallos al actualizar `genreAffinity` | `services/userPreferencesService.ts`, `services/WatchlistService.ts` |

Sin migración de base de datos.

---

## Criterios de Aceptación

* **CA-F0-01 — Invalidación de recomendaciones**
  `PUT /users/me/preferences` borra las claves `recs:user:{userId}:*` tras escribir.
  Fail-open: si Redis no está disponible, el `PUT` sigue devolviendo `200`.

* **CA-F0-02 — Límites y dedupe**
  Cada lista de favoritos acepta como máximo **50** elementos. Los duplicados se eliminan
  (`[1,1,3]` → `[1,3]`). Un array de 51 elementos → `400`.

* **CA-F0-03 — `updatedAt` determinista**
  `GET /users/me/preferences` para un usuario sin fila devuelve `updatedAt: null`
  (no una fecha nueva en cada llamada).

* **CA-F0-04 — Fallos de afinidad visibles**
  Si falla la escritura de `genreAffinity`, se registra un `warn` con contexto
  (`userId`, `genreId`, `delta`, mensaje de error). La operación de review/watchlist no falla.

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `PUT /users/me/preferences { favoriteGenres:[1,3] }` | ✅ 200 y `recs:user:{id}:*` invalidado |
| H2 | `PUT ... { favoriteGenres:[1,1,3] }` | ✅ 200 → persiste `[1,3]` |
| H3 | `GET /users/me/preferences` sin fila | ✅ 200 → `updatedAt: null` |
| H4 | `POST /movies/:id/reviews` con Redis caído y fallo de afinidad | ✅ 201 + `warn` en logs |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | 50 favoritos | ✅ 200 — justo en el máximo |
| B2 | 51 favoritos | ❌ 400 |
| B3 | `[1,1,3]` | ✅ 200 → deduplica |
| B4 | `[0]`, `[-1]` | ❌ 400 (`positive`) |
| B5 | `["drama"]` | ❌ 400 (tipo) |

---

## Corner Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| C1 | Redis caído al invalidar | ✅ 200 — fail-open |
| C2 | Body `{}` | ❌ 400 (al menos un campo) |
| C3 | Favorito y dislike del mismo id | ❌ 400 (regla introducida en F2) |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | Usuario sin fila | Estructura vacía estable, `updatedAt: null` |
| EC2 | `genre_affinity` legado como número | Se tolera en lectura; se migra a objeto al siguiente update |
| EC3 | Fallo de afinidad en watchlist | `200/201` + `warn`; no rompe el request |

---

## Notas de implementación

1. **Invalidación**: reutiliza `invalidateUserRecommendations` (`utils/cache.ts:67`), que ya es
   fail-open y limpia con `SCAN recs:user:{id}:*`.
2. **Dedupe en el schema**: `z.array(...).max(50).transform(a => [...new Set(a)])`; `max` valida el
   array de entrada, el `transform` deduplica después.
3. **`updatedAt`**: el tipo `UserPreferencesResponse.updatedAt` pasa a `Date | null`. La fila real
   siempre trae `updated_at` (default de tabla), así que `UserPreferences.toResponse()` no cambia.
4. **Afinidad**: `updateGenreAffinity` mantiene semántica *best-effort*, pero deja de tragarse el
   error sin rastro. `WatchlistService` deja de tener un `catch` vacío.

---

## Archivos a modificar (Estructura de árbol)

```text
source/
├── schemas/
│   └── userPreferences.ts           ✎ límites + dedupe
├── services/
│   ├── userPreferencesService.ts    ✎ invalidación, updatedAt null, warn
│   └── WatchlistService.ts          ✎ warn en catch vacío
├── types/
│   └── user.ts                      ✎ updatedAt: Date | null
└── __tests__/
    ├── unit/
    │   ├── userPreferences.test.ts  ✎ invalidación, dedupe, updatedAt null, affinity objeto
    │   └── watchlistService.test.ts ✎ assert de warn
    └── integration/
        └── user-preferences.integration.test.ts ✎ updatedAt null
```

---

## Diagrama de flujo (textual)

```text
PUT /users/me/preferences
  │
  ├─ updateUserPreferencesSchema.safeParse(body)  → 400 si inválido (>50, tipos)
  │
  ├─ userPreferencesService.updatePreferences(userId, dto)
  │    ├─ valida IDs existentes (favoritos)
  │    ├─ merge con fila actual
  │    ├─ repo.update() | repo.insert()
  │    ├─ invalidateUserRecommendations(userId)   ← NUEVO (fail-open)
  │    └─ getPreferences() → updatedAt real o null
  │
  └─ 200 OK
```

---

## Verificación

* `npm test -- userPreferences` (unit)
* `npm test -- user-preferences` (integración, requiere MySQL/Redis de test)
* `npm run build`
