# HU-13 · F4 — Recompute de recomendaciones

> **Tipo:** Contrato de diseño · **HU:** HU-13 (fase F4) · **Estado:** Implementado · **Revisión:** 2026-11-01 · **Rama:** `feature/bullmq-recs-recompute`

Este documento fija cómo F4 mueve el recompute de recomendaciones del script
sincrónico a BullMQ, sin cambiar el contrato de `GET /users/me/recommendations`.

---

## Decisiones cerradas (2026-11-01)

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Alcance del recompute | Precacha las **tres listas** por usuario: `hybrid`, `content` y `collab` |
| 2 | Universo nocturno | Usuarios **con interacciones** (reviews o watchlist), según CA-2 |
| 3 | Invalidación | Se mantiene la invalidación **síncrona** existente y se **encola** el recompute best-effort |
| 4 | Dedupe | `jobId` por usuario y minuto; N eventos en el mismo minuto generan un job |
| 5 | Disparadores | Review (crear/editar/borrar), watchlist (agregar/quitar), feedback, preferencias, onboarding y perfil demográfico |
| 6 | Cron | `upsertJobScheduler` desde `worker-recs`, patrón `0 3 * * *`, TZ configurable |
| 7 | Job masivo | Recorre usuarios en lotes secuenciales y reporta progreso; no hace fan-out |
| 8 | Fallo por usuario | Se loguea y sigue; el job solo falla si fallan **todos** |
| 9 | `recs.ready` | In-app, solo si la lista hybrid quedó no vacía; dedupe por fecha (una por día) |
| 10 | Proceso | `worker-recs` separado (patrón F2/F3), registrado en PM2 |
| 11 | Script | `npm run recs:compute` encola; `recs:compute:sync` conserva el modo directo |

---

## Flujo

```text
POST/PATCH/DELETE review ─┐
POST/DELETE watchlist ────┤
POST feedback ────────────┼─> invalidateUserRecommendations()  (sync, ya existía)
PATCH preferences ────────┤            │
POST onboarding ──────────┤            └─> enqueue recs-recompute-user (best-effort)
PATCH profile ────────────┘                         │
                                                    v
                                        worker-recs / recs-recompute-user
                                                    │
                                                    v
                              RecommendationService.recomputeForUser()
                              ├─ invalida recs:user:<id>:*
                              ├─ hybrid  -> recs:user:<id>:hybrid
                              ├─ content -> recs:user:<id>:content
                              └─ collab  -> recs:user:<id>:collab
                                                    │
                                                    └─> si hybrid > 0, encola recs.ready

cron 3 AM / npm run recs:compute
        └─> recs-recompute-all (lotes de usuarios con interacciones)
```

La invalidación síncrona da frescura inmediata aunque Redis esté lento o el
worker caído; el job repuebla el cache para que el próximo request sea un hit.

---

## Payloads

| Cola | Job | Payload |
|------|-----|---------|
| `recs-recompute-user` | `recs-recompute-user` | `{ userId, reason: 'invalidation' }` |
| `recs-recompute-all` | `recs-recompute-all` | `{ reason: 'manual' \| 'cron' }` |

`jobId` de usuario: `recs-user-<userId>-<minutoEpoch>`. El minuto se calcula con
`RECS_DEDUPE_WINDOW_MS` (60 s por defecto). Un `jobId` fijo bloquearía al usuario
para siempre si el job queda retenido en `failed`.

---

## Cache y CA-5

`recomputeForUser` escribe las tres claves con TTL de 24 h:

- `recs:user:<id>:hybrid`
- `recs:user:<id>:content`
- `recs:user:<id>:collab`
- `recs:user:<id>:collab:scores` (la escribe `collabForUser` al calcular hybrid)

El límite precacheado es `RECS_PRECOMPUTE_LIMIT` (50), que coincide con el máximo
de `limit` que acepta el endpoint. Un request con `limit <= 50` es un hit.

Sin señales (sin interacciones y sin preferencias/afinidad) o sin Redis, el job
termina como `skipped` sin pegarle a MySQL. Eso cubre el caso B6 del doc principal.

---

## `recs.ready` (CA-5 de F3)

- Tipo nuevo en `NOTIFICATION_TYPES`: `recs.ready`.
- Payload `{ count, date }`; `dedupeKey = date` (YYYY-MM-DD), así que una corrida
  nocturna genera como máximo una notificación por usuario.
- Solo lo emite el job **masivo**, no el de invalidación, para no spamear al
  usuario cada vez que edita una review.
- Es solo in-app: no hay template de email `recs-ready` todavía.

---

## Configuración

| Variable | Default | Uso |
|----------|---------|-----|
| `RECS_WORKER_CONCURRENCY` | `2` | Concurrencia del worker de usuario |
| `RECS_ENQUEUE_TIMEOUT_MS` | `3000` | Corte best-effort del encolado |
| `RECS_RECOMPUTE_BATCH_SIZE` | `25` | Usuarios por lote en el job masivo |
| `RECS_PRECOMPUTE_LIMIT` | `50` | Items precacheados por tipo |
| `RECS_CRON_PATTERN` | `0 3 * * *` | Cron nocturno |
| `RECS_CRON_TZ` | `UTC` | Zona horaria del cron |
| `RECS_DEDUPE_WINDOW_MS` | `60000` | Ventana de dedupe por usuario |

---

## Operación

```powershell
npm run worker:recs:dev      # worker + registro del cron
npm run recs:compute         # encola recs-recompute-all (no bloquea)
npm run recs:compute:sync    # recompute directo, sin worker
```

Bull Board (`/admin/queues`) muestra los jobs, el progreso por lote y los fallos.
`BaseWorker` ya loguea `duration` por job; el job masivo agrega un resumen con
`processed`, `failed`, `ready` y `durationMs`.

---

## Frontend, demo y laboratorio

La página [`public/recommendations.html`](../../public/recommendations.html) recorre el flujo con
mapa embebido, contratos, casos borde y log. Detalle en
[`hu-13-f4-recs-recompute-lab.md`](./hu-13-f4-recs-recompute-lab.md).

Decisión **Opción A (sin endpoints nuevos)**:

- Modo real: ejecuta feedback, review y watchlist; verifica la invalidación síncrona y deja los
  pasos 3–5 como “verificar en Bull Board”, con link a `/admin/queues`.
- Modo demo: anima encolado, worker, precache y `recs.ready`, incluido el cron y el worker caído.

```text
/recommendations.html?lab=1
/recommendations.html?demo=1
/recommendations.html?demo=1&worker=off
```

## Pruebas

- `__tests__/unit/recommendationQueue.test.ts`: payloads, jobId y dedupe por minuto.
- `__tests__/unit/recomputeRecommendationsJob.test.ts`: lotes, progreso, fallos
  parciales/totales y emisión de `recs.ready`.
- `__tests__/unit/recommendationRecompute.test.ts`: precacheo de las tres listas,
  cold start y skip sin señales/Redis.
- `__tests__/unit/notificationInAppJob.test.ts`: dedupe key de `recs.ready`.

---

## Deuda conocida

| Item | Mitigación |
|------|------------|
| El job masivo hace `N` recomputes secuenciales (una lectura de interacciones por usuario) | Aceptable para el catálogo actual; si crece, mover la matriz item-item a un artefacto compartido |
| `recs.ready` solo in-app | Agregar template `recs-ready` si se quiere email |
| El cron usa `UTC` por defecto | Configurar `RECS_CRON_TZ` con la zona del negocio |
| Un fallo de Redis en el encolado pierde el recompute | La invalidación síncrona deja el cache limpio; el próximo request recalcula lazy |
