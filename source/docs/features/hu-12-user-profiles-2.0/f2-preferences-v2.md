# HU-12 / F2: Preferencias Enriquecidas (dislikes, filtros y decay)

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F2 · **Estado:** Implementado · **Revisión:** 2026-10-23

Como usuario de la API,
quiero expresar tanto lo que me gusta como lo que **no** me gusta, y fijar filtros duros de contenido,
para que mis recomendaciones se ajusten con más precisión y con el tiempo.

Fase 2 de *User Profiles & Preferences 2.0*. Extiende `user_preferences` (JSON) y el motor de
recomendaciones. **Retrocompatible**: todos los campos nuevos son opcionales.

---

## Endpoints

### `GET /users/me/preferences`

Respuesta extendida:

```json
{
  "favoriteGenres": [1, 3],
  "favoriteDirectors": [2],
  "favoriteActors": [10],
  "dislikedGenres": [5],
  "dislikedDirectors": [],
  "dislikedActors": [],
  "contentFilters": { "minRating": 7, "maxAgeRating": "PG-13", "decades": [1990, 2000] },
  "genreAffinity": { "1": { "score": 8, "updatedAt": "2026-10-19T10:00:00.000Z" } },
  "updatedAt": "2026-10-19T10:00:00.000Z"
}
```

### `PUT /users/me/preferences`

Acepta `dislikedGenres`, `dislikedDirectors`, `dislikedActors`, `contentFilters`
además de los favoritos existentes.

### Frontend

`public/preferences.html` expone los dislikes junto a los favoritos:

- Chips de géneros a evitar, con selección excluyente respecto de favoritos.
- Inputs de IDs separados por coma para directores y actores a evitar.
- Un único botón “Guardar preferencias” envía `favorite*` y `disliked*` completos.
- Si el usuario marca el mismo género o artista en ambos lados, la UI lo quita de
  favoritos antes de guardar; el backend también valida el conflicto con `400`.
- Los dislikes se consumen en `type=hybrid`; no son una exclusión dura.

---

## Criterios de Aceptación

* **CA-F2-01 — Validación de IDs**
  Los IDs de dislike se validan contra `genres` / `directors` / `actors`; un id inexistente → `400`.

* **CA-F2-02 — Conflicto favorito/dislike**
  El mismo id en `favorite*` y `disliked*` → `400`.

* **CA-F2-03 — Dislikes restan**
  En `preferenceScores`, un género dislike resta 10, un director dislike resta 30 y un actor dislike
  resta 10 (máx. 2 actores). El score nunca baja de 0.

* **CA-F2-04 — Filtros duros (hybrid)**
  `contentFilters` excluye candidatos antes del scoring: `minRating`, `maxAgeRating`,
  `decades`, `runtimeMin`, `runtimeMax`.

* **CA-F2-05 — Candidatos extendidos**
  `getCandidates()` incluye `age_rating`, `duration` y `year` para poder filtrar.

* **CA-F2-06 — Decay de afinidad**
  `genreAffinity` decae exponencialmente (mitad del peso cada 90 días) al leerla. Se tolera el
  formato legado (número) y se migra con `scripts/migrateAffinityDecay.ts`.

* **CA-F2-07 — Límites/dedupe** (heredado de F0)
  Máximo 50 por lista; deduplicación automática; `runtimeMin ≤ runtimeMax`.

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `PUT { dislikedGenres: [5] }` | ✅ 200 → reflejado en GET |
| H2 | `PUT { contentFilters: { minRating: 7 } }` | ✅ 200 → filtros guardados |
| H3 | `?type=hybrid` con dislike de género | candidatas de ese género penalizadas |
| H4 | `?type=hybrid` con `maxAgeRating: "PG"` | películas R/NC-17 excluidas |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | 50 dislikes | ✅ 200 |
| B2 | 51 dislikes | ❌ 400 |
| B3 | `runtimeMin > runtimeMax` | ❌ 400 |
| B4 | `minRating: 11` | ❌ 400 |
| B5 | `maxAgeRating: "X"` | ❌ 400 |
| B6 | favorito y dislike mismo id | ❌ 400 |

---

## Corner Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| C1 | Solo dislikes, sin favoritos | ✅ recs siguen funcionando |
| C2 | Filtros imposibles (minRating 10 + maxAgeRating G) | ✅ 200 → `[]` |
| C3 | `genre_affinity` legado (número) | Se lee; se convierte a objeto al siguiente update |
| C4 | `decades` con duplicados | ✅ dedupe |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | Afinidad decae por debajo de 0 | La clave se elimina |
| EC2 | Sin `contentFilters` | `{}` → sin filtrado |
| EC3 | Decay con `updatedAt` inválido | Trata el score como actual (no decae) |

---

## Notas de implementación

1. **Columnas**: `disliked_genres`, `disliked_directors`, `disliked_actors`, `content_filters` (JSON).
2. **`content_filters`**: no incluye idioma (la tabla `movies` no tiene esa columna).
3. **Decay**: `effectiveAffinity()` en `recommendationService.ts` con vida media de 90 días.
4. **Motor**: `passesFilters()` se aplica sobre los candidatos solo en `type=hybrid`.
5. **Migración one-shot**: `npm` no registra script propio; ejecutar `npx tsx scripts/migrateAffinityDecay.ts`.

---

## Archivos a crear / modificar (Estructura de árbol)

```text
source/
├── db/migrations/
│   └── 202610190002_user_preferences_v2.sql    ★ NUEVO
├── repositories/
│   ├── UserPreferencesRepository.ts            ✎ dislikes + filters + affinity shape
│   └── RecommendationRepository.ts             ✎ age_rating/duration
├── services/
│   ├── userPreferencesService.ts               ✎ dislikes + filtros + decay (F0 también)
│   └── recommendationService.ts                ✎ dislikes + filtros duros + decay
├── schemas/
│   └── userPreferences.ts                      ✎ contentFilters + límites (F0 también)
├── types/
│   ├── user.ts                                 ✎ ContentFilters/GenreAffinity (F0 también)
│   └── recommendation.ts                       ✎ campos de candidato
├── scripts/
│   └── migrateAffinityDecay.ts                 ★ NUEVO
└── __tests__/
    ├── unit/
    │   └── userPreferences.v2.test.ts          ★ NUEVO
    └── integration/
        └── user-preferences.v2.integration.test.ts ★ NUEVO
```

---

## Diagrama de flujo (textual)

```text
GET /users/me/recommendations?type=hybrid
  │
  ├─ getUserInteractions / getPreferences (favoritos + dislikes + filters) / getCandidates
  ├─ candidates.filter(passesFilters)      ← minRating, ageRating, decades, runtime
  ├─ preferenceScores:
  │     + favoritos, − dislikes, + affinity con decay exponencial
  ├─ collabForUser
  ├─ hybrid = content*0.4 + collab*0.4 + pref*0.2
  └─ 200 OK
```

---

## Verificación

* `npm run migrate` (aplica la migración en la BD de la app)
* `npx tsx scripts/migrateAffinityDecay.ts` (one-shot)
* `npm test -- userPreferences` · `npm test -- user-preferences`
* `npm run build`
