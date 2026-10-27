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

export const queueOptions: Record<QueueName, Partial<QueueOptions>> = {
  [QueueNames.EMAIL_CRITICAL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 10 },
  },
  [QueueNames.EMAIL_TRANSACTIONAL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 5 },
  },
  [QueueNames.EMAIL_MARKETING]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 1 },
  },
  [QueueNames.NOTIFICATION_FANOUT]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 5 },
  },
  [QueueNames.NOTIFICATION_INAPP]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 3 },
  },
  [QueueNames.RECS_RECOMPUTE_USER]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 5 },
  },
  [QueueNames.RECS_RECOMPUTE_ALL]: {
    defaultJobOptions: { ...defaultJobOptions, priority: 1 },
  },
}
