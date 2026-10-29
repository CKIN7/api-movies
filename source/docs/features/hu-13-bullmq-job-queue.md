# HU-13: BullMQ Job Queue System

> **Tipo:** Feature · **HU:** HU-13 · **Estado:** En progreso (F1 y F2 implementadas) · **Revisión:** 2026-10-28

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
8. **Prioridad de cola:** en BullMQ el número **menor** se procesa **primero**
   (`lower numbers are processed before higher numbers`). El valor `0` significa "sin
   prioridad explícita" y esos jobs se procesan **antes** que cualquier priorizado, así que
   todas las prioridades arrancan en `1`. Ver [`fixes/bullmq-f1-corrections.md`](../fixes/bullmq-f1-corrections.md).
9. **Envío best-effort:** `POST /auth/register` conserva el `201`; el email se encola después del
   commit y su fallo no es fatal (se loguea y `POST /auth/resend` es la vía de recuperación). F2
   absorbe S1+S2+S3 del fix de registro atómico. Ver "Decisión resuelta para F2".

---

## Alcance

### Incluye (4 fases)

| Fase | Rama | Entregable principal |
|------|------|---------------------|
| **F1** | `feature/bullmq-infra` | Infra base: queues, workers, Bull Board, Testcontainers, PM2 |
| **F2** | `feature/bullmq-emails` | Colas email (critical/transactional/marketing), Resend adapter, templates |
| **F3** | `feature/bullmq-notifications` | Notificaciones in-app, fan-out, endpoints CRUD, integración review/watchlist/recs · [contrato cerrado](./hu-13-f3-notifications.md) |
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
| `email-critical` | 1 | `{ template, to, data, jobId }` | emailWorker | F2 |
| `email-transactional` | 5 | `{ template, to, data }` | emailWorker | F2 |
| `email-marketing` | 10 | `{ template, to, data }` | emailWorker | F2 |
| `notification-fanout` | 1 | `{ event, userId, payload }` | notificationWorker | F3 |
| `notification-inapp` | 3 | `{ userId, type, payload }` | notificationWorker | F3 |
| `recs-recompute-user` | 1 | `{ userId }` | recommendationWorker | F4 |
| `recs-recompute-all` | 10 | `{}` | recommendationWorker | F4 |

> **Nota:** BullMQ 5 rechaza `:` en el nombre de la cola (`Queue name cannot contain :`),
> por eso los nombres usan kebab-case. Los prefijos con `:` que aparecen en claves de
> cache (`recs:user:{id}:*`) son otra cosa y no se ven afectados.

> **Nota — sentido de la prioridad:** el número **menor se procesa primero**. `1` es lo más
> urgente y `10` lo menos. Por eso `email-critical` va antes que `email-marketing`, y
> `recs-recompute-user` (dirigido a un usuario) va antes que `recs-recompute-all` (batch
> nocturno). El valor `0` queda reservado para "sin prioridad explícita" y no se usa.

### Job Options (default)
```ts
{
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
  // priority: 1 = más urgente (ver "Colas y Prioridades")
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
- [x] CA-1: `npm run worker:dev` levanta worker que procesa jobs de prueba
- [x] CA-2: Bull Board accesible en `http://localhost:8089/admin/queues`
- [x] CA-3: Tests de integración pasan con Testcontainers (Redis real)
- [x] CA-4: Graceful shutdown (SIGTERM) drena jobs activos antes de cerrar
- [x] CA-5: Retry exponencial + DLQ funcionando (job falla 3 veces → dead letter)

### F2: Emails
- [x] CA-1: `POST /auth/register` → **201** + email encolado en `email-critical` (el response no espera al envío)
- [x] CA-2: Email verification llega en < 5s (Resend API)
- [x] CA-3: Reintentos: fallo temporal → reintenta 3x con backoff exponencial
- [x] CA-4: Rate limit: >10 req/s → jobs esperan en cola (no 429 de Resend)
- [x] CA-5: Idempotencia: mismo `jobId` no duplica envío
- [x] CA-6: Registro atómico: `users` + `email_verifications` se persisten en una transacción; si el encolado falla, la respuesta sigue siendo `201` (fail-open) con `logger.error`

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
| B1 | Redis caído al encolar | Best-effort: `201` + `logger.error`; el registro queda persistido y `POST /auth/resend` completa la verificación |
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
│   ├── emailQueue.ts             # F2: 3 colas de email (prioridades en config/bullmq.ts)
│   ├── notificationQueue.ts      # F3: fanout, inapp
│   └── recommendationQueue.ts    # F4: recs-recompute-user, recs-recompute-all
├── workers/
│   ├── baseWorker.ts             # F1: Clase base: process, shutdown, error handling
│   ├── index.ts                  # F1: Exporta workers
│   ├── emailWorker.ts            # F2: 3 workers de email (critical/transactional/marketing); aquí va el limiter (opción del Worker, no de la Queue)
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
│   ├── QueuedEmailVerificationNotifier.ts  # F2: Encola en email-critical (implementa EmailVerificationNotifier)
│   └── QueuedPasswordResetNotifier.ts      # F2: Encola en email-critical (implementa PasswordResetNotifier)
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

> **Desvíos de implementación de F2 (2026-10-28):**
> * No se creó `ResendEmailNotifier`: la entrega real vive en `EmailService` (adapter Resend +
>   registry de templates) y el worker la invoca vía `jobs/sendEmailJob.ts`. Un notificador por
>   template duplicaba lógica que el registry ya resuelve.
> * Los templates se renderizan con `react-dom/server` (`renderToStaticMarkup`), no con
>   `@react-email/render`: ese paquete usa `import()` dinámico y no corre bajo el VM de Jest
>   sin `--experimental-vm-modules`.
> * `queueFactory` conserva las 7 colas del contrato (3 de email). La prioridad ordena jobs
>   **dentro** de cada cola; **entre** colas no compiten (ver "Deuda conocida").
> * Sin `RESEND_API_KEY` el worker entra en modo dev (loguea en vez de enviar), así los tests y
>   el entorno local no dependen del proveedor ni gastan cuota.

### Dependencias Nuevas (package.json)

```json
{
  "dependencies": {
    "bullmq": "^5.15.0",
    "resend": "^6.x",
    "@react-email/components": "^1.x",
    "react": "^19.x",
    "react-dom": "^19.x",
    "@bull-board/api": "^9.10.5",
    "@bull-board/express": "^9.10.5",
    "@bull-board/ui": "^9.10.5"
  },
  "devDependencies": {
    "testcontainers": "^10.x",
    "@testcontainers/redis": "^10.x",
    "@types/react": "^19.x",
    "@types/react-dom": "^19.x"
  }
}
```

> **Nota — Bull Board:** la v9 no se distribuye como un paquete `bull-board` único, sino como
> `@bull-board/api` + `@bull-board/express` + `@bull-board/ui`. El adapter de BullMQ se importa
> como `BullMQAdapter` desde `@bull-board/api/bullMQAdapter` y el router desde
> `@bull-board/express`. Los tres paquetes ya están instalados (F1).
>
> **Nota — React:** `@react-email/components` declara `react` como peer dependency
> (`^18 || ^19`). `react`, `react-dom` y sus tipos se instalaron en F1 para que los templates
> `.tsx` de `services/emailTemplates/` compilen (`tsconfig.json` con `jsx: react-jsx`).

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

### Apagado graceful

`BaseWorker.shutdown()` usa `worker.close()` **sin** `force`: espera a que termine el job
activo antes de cerrar la conexión. `close(true)` no sirve para esto: cortocircuita la
espera (`return force || this.whenCurrentJobsFinished(false)` en BullMQ) y aborta el job,
que después se reintenta por el stall check.

El límite duro lo pone PM2 con `kill_timeout: 30000`: si un job tarda más, el proceso se
mata y el job vuelve por el stall check. La regresión está cubierta por el test
`shutdown espera al job en curso antes de cerrar el worker`.

---

## Verificación

### Comandos por Fase

```bash
# F1
cd source && npm run build && npm run test:queues
# Bull Board: http://localhost:8089/admin/queues

# F2
npm run test:queues
# Verificar email real en Resend dashboard

# F3
npm run test -- --testPathPatterns=notifications
# POST /auth/register → verificar notificación in-app + email

# F4
npm run recs:compute  # Debe encolar job, no bloquear
# Verificar en Bull Board: recs-recompute-all procesado
```

> **Nota — flag de Jest:** en Jest 30 la opción `--testPathPattern` se renombró a
> `--testPathPatterns`. El valor es una regex contra la ruta del test (se pueden sumar
> patrones). `npm run test:queues` usa `--testPathPatterns="bullmq|queue|EmailService|emailQueue"`
> y cubre las 5 suites de colas/email: `queueFactory`, `queuedEmailNotifiers`, `EmailService`,
> `bullmq.integration` y `emailQueue.integration`.

### Redis de integración (resolución en cascada)

`__tests__/integration/bullmq.integration.test.ts` usa, en este orden:

1. `REDIS_URL_TEST` si está definido (Redis real local, hoy `redis://localhost:6379/15`).
2. Testcontainers (`redis:7-alpine`) si Docker está disponible (CI).
3. `describe.skip` si no hay ninguno de los dos, para no romper `npm test` en máquinas sin Docker.

### Resultado F1 (2026-10-27)

* `npm run build` → sin errores.
* `npm run test:queues` → 4 unit + 7 integración, todos en verde.
* `npm test` completo → **84 suites / 837 tests** en verde.
* `GET /admin/queues` → 200 (Bull Board montado).

### Correcciones post-F1 (2026-10-28)

Rama `fix/bullmq-f1-corrections`, integrada en `develop` (`92fb4d4`). Detalle
completo en [`fixes/bullmq-f1-corrections.md`](../fixes/bullmq-f1-corrections.md).

* `npm run test:queues` reparado: `--testPathPattern` ya no existe en Jest 30.
* Prioridades de cola corregidas al sentido real de BullMQ (menor = se procesa primero).
* `tsconfig.json` con soporte `jsx` para los templates `.tsx` de F2.
* Índices de documentación actualizados al estado real de F1.
* Verificación: `npm run build` y `npm run typecheck` sin errores, `npm run test:queues` con
  2 suites / 16 tests, `npm test` completo con **84 suites / 842 tests** en verde.

### Resultado F2 (2026-10-28)

Rama `feature/bullmq-emails`. Incluye el registro atómico de
[`fixes/register-atomicity.md`](../fixes/register-atomicity.md) (S1 + S2 + S3).

* `npm run build` y `npm run typecheck` → sin errores.
* `npm run test:queues` → 5 suites / 27 tests en verde (incluye `EmailService`,
  `queuedEmailNotifiers` y `emailQueue.integration`).
* `npm test` completo → **87 suites / 856 tests** en verde (+3 suites / +14 tests vs. `develop`).
* `POST /auth/register` → `201` y job encolado en `email-critical`. Con `RESEND_API_KEY` la
  entrega sale por Resend; sin la key el worker loguea el correo (modo dev).

#### Corrección post-F2 (2026-10-29)

`POST /auth/register` real fallaba con `Custom Id cannot contain :` en el log
(`No se pudo enviar verificación a <userId>: ...`). Causa: los notifiers armaban
`jobId` como `<template>:<token>`, y BullMQ rechaza `:` salvo el formato legado de
3 segmentos (`node_modules/bullmq/.../classes/job.js:1073-1075`). Como el encolado es
best-effort, el error se silenciaba y **ningún email se encolaba**.

* Los `jobId` pasan a `<template>-<token>` (`verification-<uuid>`, `password-reset-<uuid>`).
* `enqueueEmail` valida el `jobId` y lanza un error explícito si contiene `:`.
* Tests: `__tests__/unit/emailQueue.test.ts` (guard) y un caso en
  `emailQueue.integration.test.ts` que usa el notificador real contra Redis.
* `npm run test:queues` → 6 suites / 31 tests en verde.
* `npm test` completo → **88 suites / 860 tests** en verde.

El *nombre* del job (`critical:verification`) sigue llevando `:` a propósito: BullMQ
solo valida `jobId`, y el prefijo sirve para filtrar en Bull Board.

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
| **Limiter de email por cola (F2)** | Los 3 limiters (uno por cola) no representan el límite global de Resend. F2+ necesita cupo diario compartido (`INCR emails:sent:YYYY-MM-DD`) y una métrica de fallos de enqueue |
| **Prioridad solo intra-cola (F2)** | La prioridad ordena jobs dentro de una cola; entre `email-critical` y `email-marketing` el orden lo dan los workers/concurrencia, no el número |
| **Bull Board sin auth (F1/F2)** | `GET /admin/queues` está montado en todos los entornos; proteger tras auth/rol antes de producción |

---

## Próximos Pasos

1. **F1:** Hecha. Correcciones de `fix/bullmq-f1-corrections` integradas en `develop` (`92fb4d4`).
2. **F2:** Hecha en `feature/bullmq-emails` (emails críticos/transaccionales/marketing + registro atómico).
3. **F3:** Implementar `feature/bullmq-notifications`
4. **F4:** Implementar `feature/bullmq-recs-recompute`
5. Actualizar este doc a **Estado: Implementado** al completar cada fase

### Decisión resuelta para F2 (2026-10-28)

`POST /auth/register` y el fix de registro atómico
([`fixes/register-atomicity.md`](../fixes/register-atomicity.md)) se solapaban: el fix mantiene el
`201` actual con el notificador **fuera** de la transacción y su fallo no fatal, mientras que el
CA-1 de F2 pedía `202` con el email encolado.

**Resolución: opción (A) — encolar best-effort, conservando `201`.**

* La respuesta de `POST /auth/register` sigue siendo **`201 { message, user }`**. No hay cambio de
  contrato: ni el controller, ni los tests de integración, ni la colección de Postman, ni los
  clientes existentes se tocan.
* F2 absorbe **S1** (los dos `INSERT` en una transacción), **S2** (el encolado va después del
  commit y su fallo no es fatal) y **S3** (`ER_DUP_ENTRY` → `409`) del spec de atomicidad.
* El envío es best-effort: si el encolado falla, la respuesta sigue siendo `201`, se registra
  `logger.error` y `POST /auth/resend` completa la verificación.

**Por qué `201` y no `202`:** el `202` no aporta nada funcional — el `add()` a Redis sigue siendo
síncrono dentro del request; lo asíncrono es la *entrega*, no la *aceptación*. A cambio, el `202`
rompe el contrato en seis puntos (`authController.ts:22`, los cuatro asserts de
`auth.register.integration.test.ts`, el assert de Postman y el CA-04 del spec de atomicidad) y
choca con el H1 de este mismo doc, que ya decía `201`.

> **Nota:** la semántica de fallo best-effort ya estaba especificada en S2 del fix de atomicidad
> (`register-atomicity.md:73`) y en su CA-02. Lo que quedaba abierto era solo el status code.

**Consecuencias operativas del best-effort** (obligatorias en F2):

1. El fallo de encolado queda **silencioso** para el cliente → hace falta una métrica de fallos de
   enqueue (Prometheus) y un job de barrido que re-encole los emails pendientes
   (`verifications:cleanup`, ya contemplado en el proposal de use-cases).
2. `POST /auth/resend` es la vía de recuperación y debe encolar igual, con el mismo trato
   best-effort que `register`.
3. `POST /auth/forgot-password` también encola, y arrastra el cooldown de 5 min ya existente.