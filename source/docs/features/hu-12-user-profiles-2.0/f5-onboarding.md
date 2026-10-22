# HU-12 / F5: Onboarding & Cold-Start

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F5 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario nuevo de la API,
quiero elegir mis géneros y directores favoritos al registrarme,
para recibir recomendaciones útiles desde el primer día sin historial.

Fase 5 de *User Profiles & Preferences 2.0*. Añade la bandera
`user_settings.onboarding_completed`, el endpoint `POST /users/me/onboarding`
y un fallback de popularidad para cold-start.

---

## Modelo de datos

```sql
ALTER TABLE user_settings
  ADD COLUMN onboarding_completed TINYINT(1) NOT NULL DEFAULT 0;
```

* `onboardingCompleted` se expone en `GET/PATCH /users/me/settings`.
* Es **solo lectura** en settings: el `PATCH` lo preserva y solo
  `POST /users/me/onboarding` lo pone a `true`.

---

## Endpoint

### `POST /users/me/onboarding` (auth)

```json
{
  "favoriteGenres": [1, 2],
  "favoriteDirectors": [10]
}
```

| Campo | Tipo | Requerido | Reglas |
|-------|------|-----------|--------|
| `favoriteGenres` | integer[] | sí | 1–10 ids existentes, sin duplicados |
| `favoriteDirectors` | integer[] | no | 0–10 ids existentes, sin duplicados |

Respuesta `200`:

```json
{
  "onboardingCompleted": true,
  "seeded": true,
  "favoriteGenres": [1, 2],
  "favoriteDirectors": [10]
}
```

| Caso | Status |
|------|--------|
| Onboarding válido | `200` |
| Body inválido / ids inexistentes / duplicados / favorito+dislike | `400` |
| Sin token | `401` |

### Semántica

1. Actualiza `favoriteGenres`/`favoriteDirectors` en `user_preferences`
   (reutiliza la validación de F2; los dislikes y filtros existentes se preservan).
2. **Solo en la primera ejecución** (`onboardingCompleted === false`) siembra
   `genre_affinity` con `+5` por cada género elegido. La siembra es secuencial
   porque cada actualización hace read-modify-write del JSON completo.
3. Marca `onboarding_completed = 1` (crea la fila de settings con defaults si no existe).
4. Invalida las recomendaciones cacheadas del usuario (fail-open).

Repetir el onboarding actualiza los favoritos pero **no vuelve a sembrar** afinidad;
así el endpoint es idempotente respecto al seed y no infla el score.

---

## Cold-start híbrido (F5-3 / F5-5)

Si un usuario **no tiene interacciones** y tiene señales de género
(`favoriteGenres` o `genreAffinity`), `GET /users/me/recommendations?type=hybrid`
usa un fallback en lugar de devolver `[]`:

```text
score = rating + 2 * (géneros favoritos coincidentes) + 0.5 * afinidad_efectiva
```

* Solo considera candidatos que compartan algún género favorito o con afinidad positiva.
* Excluye películas ya vistas/valoradas y las marcadas `not_interested`.
* Ordena por `score` (rating = popularidad global), luego por coincidencias, luego por id.
* `reason`: `"Popular en tus géneros favoritos"` si hay favoritos;
  `"Popular en tus géneros de interés"` si solo hay afinidad.
* Sin historial **ni** señales de género se mantiene el comportamiento previo: `[]`.

El fallback también se aplica si, tras el ranking normal, no queda ningún ítem y el
usuario tiene preferencias de género.

---

## Criterios de Aceptación

* **CA-F5-01 — Onboarding válido**
  `POST` con 1–10 géneros existentes → `200`, favoritos persistidos y
  `onboardingCompleted: true` en settings.

* **CA-F5-02 — Seed de afinidad**
  La primera ejecución deja `genre_affinity[g].score === 5` para cada género elegido;
  una segunda ejecución no lo incrementa (`seeded: false`).

* **CA-F5-03 — Validación**
  Lista vacía, más de 10 ids, duplicados o ids inexistentes → `400`; sin token → `401`.

* **CA-F5-04 — Progreso**
  `GET /users/me/settings` devuelve `onboardingCompleted: false` sin fila;
  tras el onboarding devuelve `true`; un `PATCH` de settings lo conserva.

* **CA-F5-05 — Cold-start**
  Tras el onboarding, `hybrid` sin historial devuelve al menos un ítem con
  `movie`, `score` y `reason`; sin preferencias sigue devolviendo `[]`.

* **CA-F5-06 — Feedback**
  El fallback no recomienda películas con `not_interested` ni películas vistas.

* **CA-F5-07 — Caché**
  El onboarding invalida las recomendaciones cacheadas del usuario.

---

## Verificación

```bash
npm run build
npx jest __tests__/unit/onboarding.test.ts
npx jest __tests__/unit/userSettings.test.ts
npx jest __tests__/unit/recommendation.test.ts
npx jest __tests__/integration/onboarding.integration.test.ts
npx jest __tests__/integration/user-settings.integration.test.ts
npx jest __tests__/integration/recommendation.integration.test.ts
```

---

## Limitaciones / deuda

* El onboarding no es transaccional: favoritos, afinidad y bandera se escriben en
  statements separados. Si falla la bandera, el cliente puede reintentar; el seed no
  se duplica porque depende de `onboardingCompleted`.
* La afinidad sembrada usa el mismo decay de F2 (media vida 90 días); pasado ese
  tiempo pierde peso y el fallback por rating toma más relevancia.
* `onboardingCompleted` no se puede reiniciar desde settings; un endpoint de reset
  queda fuera de alcance.
* El fallback solo aplica a `type=hybrid`; `content`/`collab` mantienen su semántica.
