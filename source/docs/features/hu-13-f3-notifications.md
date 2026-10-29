# HU-13 · F3 — Contrato de notificaciones in-app

> **Tipo:** Contrato de diseño · **HU:** HU-13 (fase F3) · **Estado:** Contrato cerrado, implementación en curso · **Revisión:** 2026-10-29 · **Rama:** `feature/bullmq-notifications`

Este documento fija el contrato de F3 **antes** de escribir código, porque el doc de
[`hu-13`](./hu-13-bullmq-job-queue.md) solo enumera endpoints y criterios. Acá está el DDL, los
tipos, los payloads y las respuestas exactas de los 4 endpoints.

---

## Decisiones cerradas (2026-10-29)

| # | Decisión | Valor |
|---|----------|-------|
| 1 | Destinatario del evento | **El autor** de la review (no hay modelo social para notificar a terceros) |
| 2 | Cuándo se notifica | Solo cuando `isNew === true` (no en cada actualización de una review existente) |
| 3 | Idempotencia | `UNIQUE (user_id, type, dedupe_key)` + `INSERT IGNORE` |
| 4 | Tipos activos en F3 | **Solo `review.published`**. `watchlist.added` y `recs.ready` quedan reservados |
| 5 | Contrato de la lista | `page`/`limit` (como `GET /movies`), `total`, orden `created_at DESC` |
| 6 | Falla de la notificación | **Best-effort**: `logger.error` y la respuesta del flujo de negocio no cambia |

### Defaults

| Tema | Decisión |
|------|----------|
| `payload` | Columna `JSON` + `type` aparte; el texto de la notificación se arma en el dominio |
| PK | `BIGINT AUTO_INCREMENT` (como `reviews` y `user_watchlists`), siempre filtrando por `user_id` |
| Índices | `(user_id, created_at)` y `(user_id, read_at)` |
| Retención | Sin TTL en F3 (deuda: cron de purga a 90 días) |
| Worker | `workers/notificationWorker.ts`, entrada PM2 `worker-notifications` |
| Concurrencia | 5, sin limiter (no hay proveedor externo) |
| Email | Cola `email-transactional` (prioridad 5) con el template `review-published` ya existente |
| Router | `routes/notificationRoutes.ts` con `/me/notifications...`, montado en `app.use('/users', ...)` |
| Bull Board sin auth | Sigue como deuda de F1 |

---

## Modelo de datos

```sql
CREATE TABLE IF NOT EXISTS notifications (
  id BIGINT NOT NULL AUTO_INCREMENT,
  user_id CHAR(36) NOT NULL,
  type VARCHAR(40) NOT NULL,
  dedupe_key VARCHAR(120) NOT NULL,
  payload JSON NOT NULL,
  read_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_notifications_dedupe (user_id, type, dedupe_key),
  KEY idx_notifications_user_created (user_id, created_at),
  KEY idx_notifications_user_read (user_id, read_at),
  CONSTRAINT fk_notifications_user FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
```

`dedupe_key` es la clave de negocio del evento dentro de su `type`:

| `type` | `dedupe_key` | Motivo |
|--------|--------------|--------|
| `review.published` | `reviewId` | Una review publicada = una notificación, aunque el job se reintente |
| `watchlist.added` *(reservado)* | `movieId` | |
| `recs.ready` *(reservado)* | fecha del recompute | |

`INSERT IGNORE` hace que el reintento del job (o un doble `add`) sea un no-op silencioso en vez de
un error, y la fila existente **no se pisa** (no se resetea `read_at`).

---

## Tipos y payloads

```ts
export const NOTIFICATION_TYPES = ['review.published'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

export interface ReviewPublishedPayload {
    movieId: number
    movieTitle: string
    reviewId: string
}
```

`watchlist.added` y `recs.ready` están nombrados en `types/bullmq.ts` pero **no** tienen emisor ni
payload definido en F3.

### DTO de respuesta

```ts
export interface NotificationResponse {
    id: string                 // BIGINT serializado como string
    type: NotificationType
    payload: Record<string, unknown>
    readAt: string | null
    createdAt: string
}
```

`id` viaja como **string** para no perder precisión en JS (`BIGINT` → número inseguro por encima de
2^53).

---

## Endpoints

Todos requieren `requireAuth` y operan únicamente sobre el usuario del token.

### `GET /users/me/notifications`

| Query | Tipo | Default |
|-------|------|---------|
| `page` | int > 0 | `1` |
| `limit` | int 1..100 | `20` |
| `unread_only` | boolean | `false` |

<details><summary>Respuesta 200</summary>

```json
{
  "notifications": [
    {
      "id": "42",
      "type": "review.published",
      "payload": { "movieId": 27205, "movieTitle": "Inception", "reviewId": "17" },
      "readAt": null,
      "createdAt": "2026-10-29T13:35:01.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20
}
```

`total` es el total **filtrado** (si `unread_only=true`, solo las no leídas).
</details>

### `GET /users/me/notifications/unread-count`

```json
{ "unread": 3 }
```

> Se registra **antes** que cualquier ruta con `:id` para que `unread-count` no se interprete como
> un id.

### `PATCH /users/me/notifications/:id/read`

| Caso | Respuesta |
|------|-----------|
| Existe y es del usuario | `200 { "notification": { ...DTO } }` |
| Ya estaba leída | `200` con el `readAt` original (idempotente) |
| No existe o es de otro usuario | `404 { "error": "Notificación no encontrada" }` |
| `:id` no numérico | `400 { "error": "..." }` |

`404` (y no `403`) para no filtrar la existencia de notificaciones ajenas.

### `PATCH /users/me/notifications/read-all`

```json
{ "updated": 3 }
```

`updated` cuenta solo las filas que pasaron de no leída a leída.

---

## Flujo del fan-out

```
reviewService.createReview (isNew)
  └─ enqueue 'notification-fanout' { event: 'review.published', userId, payload }   [best-effort]
       └─ notificationWorker
            ├─ lee user_settings.notify_email
            ├─ SIEMPRE: enqueue 'notification-inapp' { userId, type: 'review.published', payload }
            │     └─ INSERT IGNORE en `notifications`
            └─ si notify_email: enqueue 'email-transactional' { template: 'review-published', ... }
```

| Cola | Prioridad | Payload |
|------|-----------|---------|
| `notification-fanout` | 1 | `{ event, userId, payload }` |
| `notification-inapp` | 3 | `{ userId, type, payload }` |

El productor (`reviewService`) **no conoce canales ni plantillas**: solo emite el evento. El ruteo
por preferencias vive en el fan-out, así que agregar un canal (push, post-F4) no toca el flujo de
negocio.

---

## Casos borde

| # | Caso | Resultado esperado |
|---|------|--------------------|
| E1 | Mismo evento encolado dos veces | Una sola fila (`INSERT IGNORE` + UNIQUE) |
| E2 | Job de fan-out reintentado tras fallo parcial | Sin duplicados (E1) |
| E3 | `notify_email=false` | Solo notificación in-app |
| E4 | Redis caído al publicar la review | `201`/`200` igual + `logger.error`; la review queda persistida |
| E5 | Worker caído: notificación creada pero email no | El email se reintenta (BullMQ); el in-app no se duplica |
| E6 | `PATCH /:id/read` dos veces | `200`, `read_at` sin cambios |
| E7 | `PATCH /:id/read` de otro usuario | `404` |
| E8 | Usuario sin fila en `user_settings` | `notify_email` default `true` (email sí) |
| E9 | `limit=500` | `400` por validación (máximo 100) |

---

## Fuera de alcance de F3

- Push notifications (`notify_push` existe como placeholder en `user_settings`).
- Tiempo real (SSE/WebSocket): la UI hace polling.
- Notificar a otras personas (sin modelo social en la base).
- Digest, preferencias por tipo, retención/TTL.
- CA-5 (`recs.ready`): depende del recompute de **F4**, que todavía no existe.

---

## Sub-fases

| Sub-fase | Contenido |
|----------|-----------|
| **F3.1** | Migración + `schema.sql` + `domain/Notification` + `NotificationRepository` + `NotificationService` + tests unit |
| **F3.2** | Schemas Zod + `NotificationController` + `notificationRoutes` + wiring en `api.ts` + tests de integración de los 4 endpoints |
| **F3.3** | `notificationQueue` + `notificationFanoutJob` + `notificationWorker` + respeto de `notify_email` + PM2 + tests de colas |
| **F3.4** | Integración `reviewService` → fan-out (best-effort) + doc de HU-13 + índices |

Un commit por archivo creado o modificado, `merge --no-ff` a `develop`.
