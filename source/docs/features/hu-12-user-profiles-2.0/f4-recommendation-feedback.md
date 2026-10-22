# HU-12 / F4: Feedback de Recomendaciones

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F4 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario de la API,
quiero indicar qué recomendaciones me gustan, no me interesan o ya vi,
para que el motor ajuste mis afinidades y deje de mostrarme contenido descartado.

Fase 4 de *User Profiles & Preferences 2.0*. Añade la tabla `recommendation_feedback`
y el endpoint `POST /users/me/recommendations/feedback`.

---

## Modelo de datos

```sql
CREATE TABLE recommendation_feedback (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  movie_id INT NOT NULL,
  action ENUM('view', 'hide', 'like', 'not_interested') NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_user_movie_action (user_id, movie_id, action),
  KEY idx_feedback_excluded (user_id, action),
  CONSTRAINT fk_feedback_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
  CONSTRAINT fk_feedback_movie FOREIGN KEY (movie_id) REFERENCES movies (id) ON DELETE CASCADE
);
```

El historial es acumulativo: un usuario puede registrar varias acciones sobre la misma
película (por ejemplo `view` y después `like`). La unicidad es por `(user, movie, action)`.

---

## Endpoint

### `POST /users/me/recommendations/feedback` (auth)

```json
{
  "movieId": 42,
  "action": "like"
}
```

| Campo | Tipo | Requerido | Valores |
|-------|------|-----------|---------|
| `movieId` | integer > 0 | sí | ID existente en `movies` |
| `action` | string | sí | `view` \| `hide` \| `like` \| `not_interested` |

Respuestas:

| Caso | Status | Body |
|------|--------|------|
| Feedback nuevo | `201` | `{ "movieId": 42, "action": "like", "applied": true }` |
| Feedback repetido | `200` | `{ "movieId": 42, "action": "like", "applied": false }` |
| Body inválido | `400` | `{ "error": "..." }` |
| Película inexistente | `404` | `{ "error": "Película no encontrada" }` |
| Sin token | `401` | `{ "error": "..." }` |

**Idempotencia:** el repositorio inserta y captura `ER_DUP_ENTRY`; un duplicado devuelve
`applied: false` sin volver a aplicar afinidad ni invalidar caché.

---

## Acciones y efecto

| Acción | Delta de afinidad (por género de la película) | Excluye de recomendaciones |
|--------|----------------------------------------------|----------------------------|
| `view` | `0` | no |
| `hide` | `-0.5` | no |
| `like` | `+1` | no |
| `not_interested` | `-1.5` | sí (todos los tipos) |

* La afinidad se actualiza **solo si el feedback es nuevo** (`applied === true`) y el
  delta es distinto de cero.
* Los géneros se actualizan **secuencialmente**, porque `updateGenreAffinity` hace
  read-modify-write del JSON completo `genre_affinity`; ejecutarlos en paralelo
  perdería actualizaciones.
* `updateGenreAffinity` elimina la entrada cuando el score queda en `<= 0`; por eso
  `hide`/`not_interested` reducen afinidad existente pero no generan valores negativos.
* La afinidad solo influye en el ranking de `type=hybrid`. En `content`/`collab` el
  efecto visible es la exclusión de `not_interested`.

### Invalidación de caché

Se invalida `recs:user:{id}:*` (fail-open) cuando el feedback es nuevo y la acción es
distinta de `view`. `view` no altera el ranking, así que no invalida.

### Exclusión

`not_interested` se aplica en dos puntos de `RecommendationService.compute()`:

1. Al filtrar candidatos antes de calcular scores.
2. Al construir `finalScores`, para cubrir también los IDs que llegan por
   collaborative filtering (que no depende de la lista de candidatos).

La consulta de exclusiones es fail-open: si falla, se loguea un warning y se devuelve
`[]` (la recomendación sigue funcionando).

---

## Criterios de Aceptación

* **CA-F4-01 — Feedback nuevo**
  `POST` con película existente y acción válida → `201` con `applied: true` y fila en
  `recommendation_feedback`.

* **CA-F4-02 — Idempotencia**
  Repetir el mismo `(movieId, action)` → `200` con `applied: false`; no se duplica la
  fila ni se vuelve a aplicar el delta.

* **CA-F4-03 — Afinidad**
  `like` suma `+1` a cada género de la película; `hide` resta `0.5`; `not_interested`
  resta `1.5`; `view` no modifica afinidad.

* **CA-F4-04 — Exclusión**
  Una película con `not_interested` no aparece en `GET /users/me/recommendations`
  (`content`, `collab` ni `hybrid`), aunque collaborative filtering la puntúe.

* **CA-F4-05 — Aislamiento**
  El feedback de un usuario no afecta afinidades, exclusiones ni caché de otro usuario.

* **CA-F4-06 — Validación**
  `movieId` no entero/positivo o `action` fuera del enum → `400`; película inexistente
  → `404`; sin token → `401`.

* **CA-F4-07 — Caché**
  Un feedback nuevo con efecto (like/hide/not_interested) invalida las recomendaciones
  cacheadas del usuario; un duplicado o un `view` no invalida.

* **CA-F4-08 — Fail-open de lectura**
  Si falla la consulta de exclusiones, las recomendaciones se devuelven igualmente.

---

## Verificación

```bash
npm run build
npx jest __tests__/unit/recommendationFeedback.test.ts
npx jest __tests__/unit/recommendation.test.ts
npx jest __tests__/integration/recommendation-feedback.integration.test.ts
```

Cobertura:

* Unitarias: deltas, idempotencia, `view`, 404, fail-open, propagación de errores.
* Unitarias de recomendaciones: exclusión en `content` y `collab`.
* Integración: 401/400/404, `201`/`200`, afinidad persistida, exclusión real y
  `hide` sin exclusión.

---

## Limitaciones / deuda

* El feedback y la afinidad se escriben en statements separados (sin transacción). Si
  falla la afinidad, el feedback queda registrado y se loguea un warning; no se
  reintenta automáticamente.
* `updateGenreAffinity` sigue siendo read-modify-write; dos requests concurrentes del
  mismo usuario pueden perder una actualización (deuda previa de F2).
* La exclusión se resuelve por request contra la tabla; si el volumen crece, conviene
  cachear el set de `not_interested` por usuario.
* `view` no se usa todavía para métricas de CTR; queda como señal disponible.
