# HU-13: BullMQ Job Queue System

> **Tipo:** Feature · **HU:** HU-13 · **Estado:** Propuesta · **Revisión:** 2026-10-24

Como equipo de desarrollo,
quiero una infraestructura de colas de trabajos asíncronos (BullMQ + Redis)
para desacoplar tareas pesadas del hilo principal de Express,
habilitar reintentos, observabilidad y escalado independiente de workers.

---

## Contexto

Actualmente la API ejecuta tareas pesadas en el request HTTP:
- `npm run recs:compute` bloquea el proceso principal (single-threaded Node)
- Emails de verificación/reset password se envían sincrónicamente (DevEmailVerificationNotifier)
- Sin reintentos automáticos ni visibilidad de fallos
- Imposible escalar workers independientemente del API

**Decisiones tomadas:**
1. **Email provider:** Resend (3,000 emails/mes gratis, React Email templates)
2. **Notificaciones F3:** Solo email + in-app (push post-F4)
3. **Tests:** Redis real con resolución en cascada: `REDIS_URL_TEST` → Testcontainers → `skip`
4. **Deploy:** Mismo repo, procesos PM2 separados (F1: `api` + `worker`; F2–F4 agregan `worker-email`, `worker-notif`, `worker-recs`)
5. **Métricas:** Bull Board UI en F1 → Prometheus/Grafana en F2+
6. **Conexión Redis:** BullMQ recibe **opciones** de conexión (`host`/`port`/`db`), no una instancia
   compartida de ioredis. Compartir cliente provoca `MaxListenersExceededWarning` y un `error`
   no capturado (`Connection is closed`) al cerrarlo.
7. **Nombres de cola:** BullMQ 5 rechaza `:`; se usa kebab-case (`email-critical`, `recs-recompute-all`).

---

## Alcance

### Incluye (4 fases)

| Fase | Rama | Entregable principal |
|------|------|---------------------|
| **F1** | `feature/bullmq-infra` | Infra base: queues, workers, Bull Board, Testcontainers, PM2 |
| **F2** | `feature/bullmq-emails` | Colas email (critical/transactional/marketing), Resend adapter, templates |
| **F3** | `feature/bullmq-notifications` | Notificaciones in-app, fan-out, endpoints CRUD, integración review/watchlist/recs |
| **F4** | `feature/bullmq-recs-recompute` | Migración `recs:compute` a worker + cron nocturno + on-demand |

### Queda fuera
- Push notifications (Web Push / FCM / OneSignal) → post-F4
- Digest diario/semanal → post-F4
- SSE/WebSocket real-time in-app → post-F4
- i18n email templates → post-F4
- Redis HA (Sentinel/Cluster) → infra separada

---

## Contrato

### Colas y Prioridades

| Cola | Prioridad | Job Payload | Worker | Fase |
|------|-----------|-------------|--------|------|
| `email-critical` | 10 | `{ template, to, data, jobId }` | emailWorker | F2 |
| `email-transactional` | 5 | `{ template, to, data }` | emailWorker | F2 |
| `email-marketing` | 1 | `{ template, to, data }` | emailWorker | F2 |
| `notification-fanout` | 5 | `{ event, userId, payload }` | notificationWorker | F3 |
| `notification-inapp` | 3 | `{ userId, type, payload }` | notificationWorker | F3 |
| `recs-recompute-user` | 5 | `{ userId }` | recommendationWorker | F4 |
| `recs-recompute-all` | 1 | `{}` | recommendationWorker | F4 |

> **Nota:** BullMQ 5 rechaza `:` en el nombre de la cola (`Queue name cannot contain :`),
> por eso los nombres usan kebab-case. Los prefijos con `:` que aparecen en claves de
> cache (`recs:user:{id}:*`) son otra cosa y no se ven afectados.

### Job Options (default)
```ts
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
  // rate limiting por cola donde aplique
}
```

### Endpoints Nuevos (F3)

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/users/me/notifications` | Lista paginada, `?unread_only=true` |
| `PATCH` | `/users/me/notifications/:id/read` | Marca una como leída |
| `PATCH` | `/users/me/notifications/read-all` | Marca todas como leídas |
| `GET` | `/users/me/notifications/unread-count` | Contador para badge UI |

### Admin UI
- **Bull Board:** `GET /admin/queues` (montado en F1)

---

## Criterios de Aceptación

### F1: Infra Base
- [ ] CA-1: `npm run worker:dev` levanta worker que procesa jobs de prueba
- [ ] CA-2: Bull Board accesible en `http://localhost:8089/admin/queues`
- [ ] CA-3: Tests de integración pasan con Testcontainers (Redis real)
- [ ] CA-4: Graceful shutdown (SIGTERM) drena jobs activos antes de cerrar
- [ ] CA-5: Retry exponencial + DLQ funcionando (job falla 3 veces → dead letter)

### F2: Emails
- [ ] CA-1: `POST /auth/register` → 202 + email encolado (no bloquea response)
- [ ] CA-2: Email verification llega en < 5s (Resend API)
- [ ] CA-3: Reintentos: fallo temporal → reintenta 3x con backoff exponencial
- [ ] CA-4: Rate limit: >10 req/s → jobs esperan en cola (no 429 de Resend)
- [ ] CA-5: Idempotencia: mismo `jobId` no duplica envío

### F3: Notificaciones In-App + Fan-out
- [ ] CA-1: Crear review → notificación in-app creada + email si `notify_email=true`
- [ ] CA-2: `GET /users/me/notifications` → paginación, filtro `unread_only`
- [ ] CA-3: `PATCH /:id/read` → marca leída, `PATCH /read-all` → marca todas
- [ ] CA-4: Fan-out respeta `user_settings.notify_email` (true/false)
- [ ] CA-5: Evento `recs.ready` opcional → notificación "Nuevas recomendaciones"

### F4: Recs Recompute
- [ ] CA-1: `npm run recs:compute` → encola job `recs-recompute-all` (no bloquea)
- [ ] CA-2: Cron nocturno (3 AM) ejecuta recompute para todos los usuarios con interacciones
- [ ] CA-3: Invalidación cache (review/watchlist/feedback) → encola `recs-recompute-user`
- [ ] CA-4: Métricas Bull Board: jobs completados, tiempo medio, fallos
- [ ] CA-5: Cache hit rate > 95% tras recompute nocturno

---

## Casos

### Happy Path

| # | Flujo | Resultado esperado |
|---|-------|---------------------|
| H1 | Usuario registra cuenta | 201 + email verification encolado en `email-critical` |
| H2 | Worker email procesa job | Resend API llamado, email entregado, job completado |
| H3 | Usuario crea review | Notificación in-app creada + email si `notify_email=true` |
| H4 | Usuario consulta notificaciones | 200 + lista paginada con `read_at` null/fecha |
| H5 | Cron nocturno ejecuta | `recs-recompute-all` procesa todos los usuarios, cache repoblado |

### Boundary / Corner / Edge Cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| B1 | Redis caído al encolar | Fail-fast: 500 en API, job no perdido (transacción BD no commit) |
| B2 | Worker muere procesando job | Job vuelve a cola (retry), otro worker lo toma |
| B3 | Resend devuelve 429 (rate limit) | Job reencolado con backoff, no falla definitivamente |
| B4 | Mismo `jobId` enviado 2x | Solo 1 email enviado (idempotencia BullMQ) |
| B5 | Usuario con `notify_email=false` crea review | Solo notificación in-app, sin email |
| B6 | `recs-recompute-user` para usuario sin interacciones | Job completa rápido, cache no se actualiza (no-op) |
| B7 | Job tarda > 30s (recs recompute) | Worker sigue vivo, Bull Board muestra progreso |
| B8 | SIGTERM en medio de job | Worker termina job actual, no toma nuevos, cierra limpio |

---

## Implementación

### Estructura de Archivos (Todas las Fases)

```
source/
├── config/
│   └── bullmq.ts                 # F1: Redis connection, defaultJobOptions, queue names
├── queues/
│   ├── index.ts                  # F1: Exporta todas las colas (factory)
│   ├── queueFactory.ts           # F1: createQueue(name, opts)
│   ├── emailQueue.ts             # F2: 3 colas con prioridades y limiters
│   ├── notificationQueue.ts      # F3: fanout, inapp
│   └── recommendationQueue.ts    # F4: recs-recompute-user, recs-recompute-all
├── workers/
│   ├── baseWorker.ts             # F1: Clase base: process, shutdown, error handling
│   ├── index.ts                  # F1: Exporta workers
│   ├── emailWorker.ts            # F2: Procesa emailQueue, usa EmailService
│   ├── notificationWorker.ts     # F3: Procesa fanout + inapp
│   └── recommendationWorker.ts   # F4: Procesa recs queues
├── jobs/
│   ├── sendEmailJob.ts           # F2: Payload + handler
│   ├── notificationFanoutJob.ts  # F3: Fan-out logic
│   └── recomputeRecommendationsJob.ts  # F4: Handler + cron schedule
├── services/
│   ├── EmailService.ts           # F2: Adapter Resend (send, sendBatch)
│   ├── emailTemplates/           # F2: React Email components
│   │   ├── VerificationEmail.tsx
│   │   ├── PasswordResetEmail.tsx
│   │   ├── WelcomeEmail.tsx
│   │   └── ReviewPublishedEmail.tsx
│   ├── NotificationService.ts    # F3: create, list, markRead, unreadCount
│   └── NotificationRepository.ts # F3
├── domain/
│   └── Notification.ts           # F3
├── repositories/
│   └── NotificationRepository.ts # F3
├── controllers/
│   └── NotificationController.ts # F3
├── routes/
│   └── notificationRoutes.ts     # F3
├── notifiers/
│   └── ResendEmailNotifier.ts    # F2: Reemplaza DevEmailVerificationNotifier
├── scripts/
│   └── recomputeRecommendations.ts  # F4: ✎ Deprecado → wrapper que encola job
├── api.ts                        # ✎ wiring DI + mount /users/me/notifications + /admin/queues
├── ecosystem.config.js           # F1: PM2 api + worker genérico
├── db/migrations/
│   └── 202610240001_notifications.sql  # F3
├── types/
│   └── bullmq.ts                 # F1: JobPayload, QueueNames, WorkerOptions
└── __tests__/
    ├── integration/
    │   ├── bullmq.integration.test.ts      # F1
    │   ├── emailQueue.integration.test.ts  # F2
    │   ├── notifications.integration.test.ts  # F3
    │   └── recsRecompute.integration.test.ts  # F4
    └── unit/
        ├── queueFactory.test.ts       # F1
        ├── EmailService.test.ts       # F2
        └── NotificationService.test.ts  # F3
```

### Dependencias Nuevas (package.json)

```json
{
  "dependencies": {
    "bullmq": "^5.x",
    "resend": "^3.x",
    "@react-email/components": "^0.x",
    "bull-board": "^6.x"
  },
  "devDependencies": {
    "testcontainers": "^10.x",
    "@testcontainers/redis": "^10.x"
  }
}
```

### PM2 Ecosystem (ecosystem.config.js)

En F1 solo existen `api` y un worker genérico; cada fase agrega su app cuando el
worker concreto existe (evita que `pm2 start` falle por scripts inexistentes).

```js
// F1
module.exports = {
  apps: [
    { name: 'api', script: 'dist/api.js', instances: 'max', exec_mode: 'cluster' },
    { name: 'worker', script: 'dist/workers/index.js', instances: 1, exec_mode: 'fork' },
  ]
}

// F2/F3/F4 agregan:
// { name: 'worker-email', script: 'dist/workers/emailWorker.js', instances: 2 },
// { name: 'worker-notif', script: 'dist/workers/notificationWorker.js', instances: 1 },
// { name: 'worker-recs', script: 'dist/workers/recommendationWorker.js', instances: 1 },
```

---

## Verificación

### Comandos por Fase

```bash
# F1
cd source && npm run build && npm run test:queues
# Bull Board: http://localhost:8089/admin/queues

# F2
npm run test -- --testPathPattern=emailQueue
# Verificar email real en Resend dashboard

# F3
npm run test -- --testPathPattern=notifications
# POST /auth/register → verificar notificación in-app + email

# F4
npm run recs:compute  # Debe encolar job, no bloquear
# Verificar en Bull Board: recs-recompute-all procesado
```

### Redis de integración (resolución en cascada)

`__tests__/integration/bullmq.integration.test.ts` usa, en este orden:

1. `REDIS_URL_TEST` si está definido (Redis real local, hoy `redis://localhost:6379/15`).
2. Testcontainers (`redis:7-alpine`) si Docker está disponible (CI).
3. `describe.skip` si no hay ninguno de los dos, para no romper `npm test` en máquinas sin Docker.

### Resultado F1 (2026-10-27)

* `npm run build` → sin errores.
* `npm run test:queues` → 4 unit + 6 integración, todos en verde.
* `npm test` completo → **84 suites / 836 tests** en verde.
* `GET /admin/queues` → 200 (Bull Board montado).

### CI/CD
- Tests de integración usan Redis real (REDIS_URL_TEST o Testcontainers)
- `npm run build` + `npm test` deben pasar en `develop` antes de merge
- Bull Board solo expuesto en desarrollo (detrás de auth en producción)

---

## Limitaciones / Deuda Conocida

| Item | Mitigación |
|------|------------|
| **Redis single point of failure** | F1 usa standalone; producción → Redis Sentinel/Cluster |
| **No observabilidad avanzada en F1** | Bull Board UI suficiente; Prometheus en F2+ |
| **Email templates solo ES** | i18n post-F4 si se requiere |
| **In-app polling (no real-time)** | SSE/WebSocket post-F4 si métricas lo piden |
| **Job cleanup manual** | `removeOnComplete: 100`, `removeOnFail: 50` en config |
| **Migración `recs:compute` gradual** | F4 puede coexistir con script antiguo temporalmente |

---

## Próximos Pasos

1. **F1:** Implementar `feature/bullmq-infra` → merge a `develop`
2. **F2+F3:** Implementar en paralelo `feature/bullmq-emails` + `feature/bullmq-notifications`
3. **F4:** Implementar `feature/bullmq-recs-recompute`
4. Actualizar este doc a **Estado: Implementado** al completar cada fase