import type { JobsOptions, QueueOptions } from 'bullmq'
import type { RedisOptions } from 'ioredis'

// ═══════════════════════════════════════════════════════════════
//  Conexion BullMQ
// ═══════════════════════════════════════════════════════════════
//  NO se comparte una instancia de ioredis entre colas/workers.
//  BullMQ crea su propia conexion por cola a partir de estas
//  opciones: compartir el cliente provoca MaxListenersExceeded y
//  un 'error' no capturado ("Connection is closed") al cerrarlo.
//  `maxRetriesPerRequest: null` es requisito de BullMQ para las
//  conexiones bloqueantes de los workers.
// ═══════════════════════════════════════════════════════════════

function parseRedisUrl(raw: string): RedisOptions {
  const url = new URL(raw)
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : 6379,
    ...(url.username ? { username: decodeURIComponent(url.username) } : {}),
    ...(url.password ? { password: decodeURIComponent(url.password) } : {}),
    db: url.pathname && url.pathname !== '/' ? Number(url.pathname.slice(1)) : 0,
  }
}

export const bullmqConnection: RedisOptions = {
  ...parseRedisUrl(process.env.REDIS_URL || 'redis://localhost:6379'),
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
}

export const defaultJobOptions: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: 100,
  removeOnFail: 50,
}

// BullMQ 5 prohibe ':' en los nombres de cola. Se usa kebab-case.
export const QueueNames = {
  EMAIL_CRITICAL: 'email-critical',
  EMAIL_TRANSACTIONAL: 'email-transactional',
  EMAIL_MARKETING: 'email-marketing',
  NOTIFICATION_FANOUT: 'notification-fanout',
  NOTIFICATION_INAPP: 'notification-inapp',
  RECS_RECOMPUTE_USER: 'recs-recompute-user',
  RECS_RECOMPUTE_ALL: 'recs-recompute-all',
} as const

export type QueueName = (typeof QueueNames)[keyof typeof QueueNames]

// ═══════════════════════════════════════════════════════════════
//  Prioridad
// ═══════════════════════════════════════════════════════════════
//  En BullMQ el numero MENOR se procesa PRIMERO ("lower numbers
//  are processed before higher numbers"). Ademas `0` significa
//  "sin prioridad explicita" y esos jobs se procesan antes que
//  cualquier job priorizado, asi que todas las prioridades
//  explicitas arrancan en 1.
//
//  Regla del proyecto: critical=1 < transactional=5 < marketing=10.
//  No invertir estos valores: el correo de verificacion debe salir
//  antes que el correo de marketing.
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
//  Email (F2)
// ═══════════════════════════════════════════════════════════════
//  `emailLimiter` es una opcion del Worker (no de la Queue): BullMQ
//  cuenta el despacho en Redis, asi que el limite es compartido entre
//  instancias del mismo worker-email, pero NO entre las 3 colas de
//  email (cada cola tiene su propio limiter). Resend free son 2 req/s
//  globales; por eso los defaults son conservadores y configurables.
// ═══════════════════════════════════════════════════════════════

export const emailLimiter = {
  max: Number(process.env.EMAIL_RATE_LIMIT_MAX ?? 10),
  duration: Number(process.env.EMAIL_RATE_LIMIT_DURATION_MS ?? 1000),
}

export const emailWorkerConcurrency = Number(process.env.EMAIL_WORKER_CONCURRENCY ?? 2)

// El encolado es best-effort (register sigue devolviendo 201). Si Redis
// no responde, no queremos que el request cuelgue: se corta a los N ms.
export const emailEnqueueTimeoutMs = Number(process.env.EMAIL_ENQUEUE_TIMEOUT_MS ?? 3000)

export const queueOptions: Record<QueueName, Partial<QueueOptions>> = {
  [QueueNames.EMAIL_CRITICAL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 1 },
  },
  [QueueNames.EMAIL_TRANSACTIONAL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 5 },
  },
  [QueueNames.EMAIL_MARKETING]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 10 },
  },
  [QueueNames.NOTIFICATION_FANOUT]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 1 },
  },
  [QueueNames.NOTIFICATION_INAPP]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 3 },
  },
  [QueueNames.RECS_RECOMPUTE_USER]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 1 },
  },
  [QueueNames.RECS_RECOMPUTE_ALL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 10 },
  },
}
