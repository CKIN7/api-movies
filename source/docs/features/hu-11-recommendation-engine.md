# HU-11: Motor de Recomendaciones (Content-Based + Collaborative + Preferencias)

> **Tipo:** Feature · **HU:** HU-11 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario de la API,  
quiero recibir recomendaciones de películas personalizadas según mi historial (reviews + watchlist), mis preferencias declaradas y el comportamiento de usuarios similares,  
para descubrir contenido afín sin tener que buscarlo manualmente.

---

## Endpoint

`GET /users/me/recommendations?type={content|collab|hybrid}&limit={n}`

* Autenticación requerida (`Bearer` access token). El usuario se deriva del token (`req.user.sub`).
* `type` — default: `hybrid`.
* `limit` — default: `20`. Máximo permitido: `50`.

### Respuesta exitosa (200 OK)

```json
[
  {
    "movie": {
      "id": 2,
      "title": "The Dark Knight",
      "year": 2008,
      "rating": 9,
      "director": "Christopher Nolan",
      "genres": ["action"]
    },
    "score": 72,
    "reason": "Usuarios como tú también la vieron"
  }
]
```

`score` ∈ (0, 100], un solo decimal. `reason` es una explicación corta en español.

---

## Criterios de Aceptación

* **CA-01 — Autenticación**  
  Sin token → `401`. Token expirado/inválido → `401`.

* **CA-02 — Cold start**  
  Usuario sin reviews ni watchlist ni preferencias → `200` con `[]` (no error).

* **CA-03 — Historial combinado**  
  El historial es la unión de `reviews` (peso = `rating`) y `user_watchlists` (peso = `priority`), desduplicado por película tomando el peso máximo. Lo ya visto/en watchlist **nunca** aparece en la respuesta.

* **CA-04 — type=content**  
  Score = similitud con el historial: géneros compartidos (cada género 1 punto), director visto previamente (+3), actor visto previamente (+1). Normalizado al máximo → 0–100.  
  `reason`: `Similar a "<título semilla>"` si la similitud viene de una película concreta del historial; si no, `Basado en tu historial de visualización`.

* **CA-05 — type=collab**  
  Item-item collaborative filtering: coseno entre el vector de la candidata (ratings/priorities por usuario) y el vector de cada película del historial del usuario, ponderado por el peso de la interacción. Normalizado → 0–100.  
  `reason`: `Usuarios como tú también la vieron`.

* **CA-06 — type=hybrid (default)**  
  `hybrid = content*0.4 + collab*0.4 + pref*0.2`, donde `pref` mide coincidencia con `favoriteGenres`/`favoriteDirectors`/`favoriteActors`/`genreAffinity` de `user_preferences` (normalizado → 0–100).  
  `reason`: la señal dominante (collab > pref > content, empate resuelto en ese orden de chequeo).

* **CA-07 — Validación de query**  
  `?type=banana` → `400`. `?limit=0`, `?limit=51`, `?limit=abc` → `400`. Reutiliza `recommendationsQuerySchema` (`schemas/userPreferences.ts`).

* **CA-08 — Límite**  
  `?limit=2` → máximo 2 items, ordenados por score desc.

* **CA-09 — Caché Redis**  
  Resultados cacheados 24h en `recs:user:{userId}:{type}`. La matriz colaborativa se cachea aparte en `recs:user:{userId}:collab:scores` (top-50) para no chocar con la lista final de items.

* **CA-10 — Invalidación**  
  Crear/actualizar/eliminar review y agregar/quitar watchlist → se borran todas las claves `recs:user:{userId}:*` del usuario. Fail-open: si Redis no está listo, se omite (el TTL de 24h cubre).

* **CA-11 — Batch offline**  
  `npm run recs:compute` → recalcula la matriz colaborativa top-50 para **todos** los usuarios con interacciones y la escribe en `recs:user:{id}:collab:scores`. Usuarios sin scores limpián su clave.

* **CA-12 — Fallback on-demand**  
  Si `collab:scores` no existe (cache miss), se recalcula al vuelo desde la DB y se cachea. Redis caído → fail-open, se computa sin cache.

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `GET /users/me/recommendations` (con historial) | ✅ 200 → lista hybrid ordenada por score |
| H2 | `?type=content` (con historial) | ✅ 200 → similitudes al historial, excluye lo visto |
| H3 | `?type=collab` (con otros usuarios) | ✅ 200 → items popularidad-similares, reason colaborativo |
| H4 | `?limit=5` | ✅ 200 → top 5 |
| H5 | Review en movie 1 → `?type=content` | ✅ 200 → movie 1 ausente del resultado |
| H6 | Watchlist movie 2 + review movie 1 → `?type=content` | ✅ 200 → ni 1 ni 2 en el resultado |
| H7 | Usuario con `favoriteDirectors=[20]` → hybrid | ✅ 200 → películas del director 20 suben de score |
| H8 | `npm run recs:compute` con 2 usuarios con interacciones | ✅ `Recomputed collab recommendations for 2 user(s)` |
| H9 | Token de usuario sin datos | ✅ 200 → `[]` |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | `?limit=1` | ✅ 200 — mínimo |
| B2 | `?limit=50` | ✅ 200 — máximo |
| B3 | `?limit=51` | ❌ 400 |
| B4 | `?limit=0` | ❌ 400 |
| B5 | `?limit=-1` | ❌ 400 |
| B6 | `?limit=2.5` | ❌ 400 (Zod espera int) |
| B7 | `?type=` (vacío) | ✅ 200 → default `hybrid` |
| B8 | `?type=CONTENT` | ❌ 400 (enum lowercase) |

---

## Corner Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| C1 | Sin token | ❌ 401 |
| C2 | Sin historial, con `favoriteGenres` | ✅ 200 → recomendaciones solo por preferencias (reason: `Coincide con tus géneros y artistas favoritos`) |
| C3 | Un solo usuario con interacciones (sin vecinos) | ✅ 200 collab → `[]`; hybrid sigue funcionando por content/pref |
| C4 | Película vista con rating 1 (peso bajo) | Sigue excluida del resultado (cualquier interacción excluye) |
| C5 | Review + watchlist de la misma película | Peso = `max(rating, priority)`, contada una sola vez |
| C6 | Redis caído | ✅ 200 — se computa al vuelo sin cache (fail-open) |
| C7 | Batch sin interacciones en la DB | ✅ `Recomputed collab recommendations for 0 user(s)` |
| C8 | Batch con un usuario sin vecinos | No escribe clave (scores vacíos → invalida la clave vieja) |

---

## Edge Cases

| # | Caso | Comportamiento esperado |
|---|---|---|
| **EC1** | Cold start total | `[]` sin error |
| **EC2** | Solo watchlist, sin reviews | Historial = watchlist; content/hibridas funcionan |
| **EC3** | Mutación de review (update rating) | Affinity de `user_preferences` recalculada + recs invalidadas |
| **EC4** | DELETE review | Affinity recalculada + recs invalidadas |
| **EC5** | Quitar de watchlist | Recs invalidadas |
| **EC6** | 1000s de películas en candidates | `getCandidates()` hace un solo query agregado; scoring en memoria O(n·m) |
| **EC7** | Colisión de shapes en `:collab` | Mitigada: scores viven en `collab:scores`, items finales en `:{type}` |

---

## Notas de implementación

Algoritmos puros (sin I/O) en `recommendationService.ts`:

* **contentScores**: por candidata, cuenta géneros compartidos con cada item del historial (+3 si director repetido, +1 por actor repetido), toma el máximo entre semillas, normaliza al máximo.
* **preferenceScores**: 5 puntos por favorito explícito (genre/director/actor), más `genreAffinity` normalizado.
* **collabScores**: item-item coseno manual (sin dependencias) entre el vector de la candidata y cada vecino del historial, ponderado por peso; normaliza al máximo.
* **cosine**: optimizado iterando el mapa más chico; retorna 0 si algún vector es vacío.

Cache:

* `recs:user:{id}:{type}` → `RecommendationItem[]` (lista final, 24h).
* `recs:user:{id}:collab:scores` → `Record<string, number>` top-50 (matriz colaborativa, 24h).  
  ⚠️ Namespace separado a propósito: al principio ambas usaban `...:collab` y el hybrid leía un array donde esperaba scores → collab = 0 silencioso.

Invalidación: `invalidateUserRecommendations()` (utils/cache) usa SCAN `recs:user:{id}:*`, llamada desde `reviewService` (create/update/delete) y `WatchlistService` (add/remove).

---

## Archivos a crear (Estructura de árbol)

```text
source/
├── types/
│   └── recommendation.ts                ★ NUEVO — RecommendationItem, UserInteraction, RecommendationCandidateRow
├── repositories/
│   └── RecommendationRepository.ts       ★ NUEVO — getUserInteractions, getAllInteractions, getCandidates
├── services/
│   └── recommendationService.ts          ★ NUEVO — scoring + cache + recomputeCollabForAllUsers
├── controllers/
│   └── recommendationController.ts       ★ NUEVO — getRecommendations handler
├── routes/
│   └── recommendationRoutes.ts           ★ NUEVO — GET /me/recommendations (requireAuth)
├── scripts/
│   └── recomputeRecommendations.ts       ★ NUEVO — batch offline (npm run recs:compute)
├── utils/
│   └── cache.ts                          ✎ + CACHE_KEYS.recs, invalidateUserRecommendations
├── services/
│   ├── reviewService.ts                  ✎ + invalidate en create/update/delete
│   └── WatchlistService.ts               ✎ + invalidate en add/remove
├── api.ts                                ✎ + wiring DI + mount /users
├── package.json                          ✎ + script recs:compute
├── __tests__/
│   ├── unit/
│   │   └── recommendation.test.ts        ★ NUEVO — 8 tests (scoring, cold start, límites, boost)
│   └── integration/
│       └── recommendation.integration.test.ts ★ NUEVO — 8 tests (401, cold start, exclusión, validación)
└── docs/
    └── features/
        └── hu-11-recommendation-engine.md   ✎ poblar
```

---

## Notas técnicas

1. **Sin dependencias de ML**  
   El coseno item-item se implementa a mano (Maps de `usuario → peso`). No se agregó `ml-matrix` ni similares.

2. **Reutiliza el schema de F1**  
   `recommendationsQuerySchema` ya existía en `schemas/userPreferences.ts` (valida `type` enum + `limit` 1–50 default 20). No se duplicó.

3. **Orden de montaje en `api.ts`**  
   `app.use('/users', recommendationRouter)` después de `userRouter`. Sin conflicto: `userRoutes` solo declara `PATCH /:id/role`.

4. **Fail-open en Redis**  
   Todos los accesos a cache pasan por `redisReady()`/`isRedisHealthy()`. Redis caído degrada a cómputo en vivo, nunca a 500.

5. **Batch y on-demand comparten algoritmo**  
   `recomputeCollabForAllUsers()` y `collabForUser()` usan las mismas `collabScores`/`buildItemMaps`. El batch solo precalcula para evitar el cold miss.

6. **Tests compartan Redis con dev**  
   `TEST_USER_ID` = usuario admin real del seed. El `beforeEach` limpia `recs:user:{TEST_USER_ID}:*` para que keys huérfanas no contaminen (p. ej. un hybrid cacheado en validación manual).

7. **DbLogger muestra `rows:2` siempre**  
   Loguea `result.length` donde `result` es el tuple `[rows, fields]` de mysql2 — quirk pre-existente, no son 2 filas.

---

## Diagrama de flujo (textual)

```text
Request: GET /users/me/recommendations?type=hybrid&limit=20
  │
  ├─ recommendationRoutes → requireAuth → controller.getRecommendations
  │    └─ recommendationsQuerySchema.parse(req.query) → { type: 'hybrid', limit: 20 }
  │
  ├─ recommendationService.getRecommendations(userId, query)
  │    ├─ ¿Redis healthy y recs:user:{id}:hybrid existe? → return cached.slice(0, 20)
  │    │
  │    └─ compute():
  │         ├─ getUserInteractions(userId)   ← reviews ∪ watchlists (MAX weight)
  │         ├─ prefsService.getPreferences()  ← user_preferences
  │         ├─ getCandidates()                ← movies + genres + actors agregados
  │         ├─ contentScores(...)             ← similitud historial → 0–100
  │         ├─ preferenceScores(...)          ← favoritos + genreAffinity → 0–100
  │         ├─ collabForUser()
  │         │    ├─ ¿recs:user:{id}:collab:scores en Redis? → Map
  │         │    └─ sino: getAllInteractions() → collabScores() → cachea top-50
  │         ├─ merged: hybrid = content*0.4 + collab*0.4 + pref*0.2
  │         ├─ filtra score > 0, sort desc, top-N
  │         ├─ movieRepo.findByIds() para hidratar título/año/director/genres
  │         └─ cachea lista final en recs:user:{id}:hybrid (24h)
  │
  └─ Response: 200 OK → RecommendationItem[]

Batch: npm run recs:compute
  └─ recomputeRecommendations.ts
       └─ service.recomputeCollabForAllUsers()
            ├─ getAllInteractions() + getCandidates()
            ├─ por cada usuario: collabScores() → top-50 → recs:user:{id}:collab:scores
            └─ sin scores → invalida clave previa
```
