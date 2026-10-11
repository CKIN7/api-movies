import { getRedisClient } from '../utils/redisClient'
import { rateLimitConfig } from '../config/rateLimitConfig'

const METRICS_KEYS = {
  totalHits: 'ratelimit:metrics:totalHits',
  totalRejected: 'ratelimit:metrics:totalRejected',
  blockedIps: 'ratelimit:metrics:blockedIps',
  penaltyActivations: 'ratelimit:metrics:penaltyActivations',
  redisErrors: 'ratelimit:metrics:redisErrors',
  redisSlow: 'ratelimit:metrics:redisSlow',
}

export interface RateLimitMetrics {
  totalHits: number
  totalRejected: number
  blockedIpsCount: number
  penaltyActivations: number
  redisErrors: number
  redisSlow: number
  rejectionRate: number
  activePenalties: string[]
  byScope: {
    global: { hits: number; rejected: number }
    auth: { hits: number; rejected: number }
    write: { hits: number; rejected: number }
    user: { hits: number; rejected: number }
  }
}

export async function getRateLimitMetrics(): Promise<RateLimitMetrics> {
  const redis = getRedisClient()

  const [
    totalHits,
    totalRejected,
    blockedIpsCount,
    penaltyActivations,
    redisErrors,
    redisSlow,
    blockedIps,
    byScope,
  ] = await Promise.all([
    redis.get(METRICS_KEYS.totalHits).then(v => Number(v) || 0),
    redis.get(METRICS_KEYS.totalRejected).then(v => Number(v) || 0),
    redis.scard(METRICS_KEYS.blockedIps),
    redis.get(METRICS_KEYS.penaltyActivations).then(v => Number(v) || 0),
    redis.get(METRICS_KEYS.redisErrors).then(v => Number(v) || 0),
    redis.get(METRICS_KEYS.redisSlow).then(v => Number(v) || 0),
    redis.smembers(METRICS_KEYS.blockedIps),
    getMetricsByScope(redis),
  ])

  const rejectionRate = totalHits > 0 ? (totalRejected / totalHits) * 100 : 0

  return {
    totalHits,
    totalRejected,
    blockedIpsCount,
    penaltyActivations,
    redisErrors,
    redisSlow,
    rejectionRate: Math.round(rejectionRate * 100) / 100,
    activePenalties: blockedIps,
    byScope,
  }
}

async function getMetricsByScope(redis: ReturnType<typeof getRedisClient>): Promise<RateLimitMetrics['byScope']> {
  const scopes: Array<'global' | 'auth' | 'write' | 'user'> = ['global', 'auth', 'write', 'user']
  const result: RateLimitMetrics['byScope'] = {
    global: { hits: 0, rejected: 0 },
    auth: { hits: 0, rejected: 0 },
    write: { hits: 0, rejected: 0 },
    user: { hits: 0, rejected: 0 },
  }

  for (const scope of scopes) {
    const pattern = `ratelimit:${scope}:*`
    let cursor = '0'
    let hits = 0

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      for (const key of keys) {
        const count = await redis.zcard(key)
        hits += count
      }
    } while (cursor !== '0')

    const rejectedKey = `ratelimit:penaltyrejections:${scope}`
    const rejected = await redis.get(rejectedKey).then(v => Number(v) || 0)

    result[scope] = { hits, rejected }
  }

  return result
}

export async function incrementMetric(key: keyof typeof METRICS_KEYS): Promise<void> {
  const redis = getRedisClient()
  await redis.incr(METRICS_KEYS[key])
}

export async function recordRedisError(): Promise<void> {
  await incrementMetric('redisErrors')
}

export async function recordRedisSlow(): Promise<void> {
  await incrementMetric('redisSlow')
}

export async function recordHit(): Promise<void> {
  await incrementMetric('totalHits')
}

export async function recordRejection(): Promise<void> {
  await incrementMetric('totalRejected')
}

export async function clearMetrics(): Promise<void> {
  const redis = getRedisClient()
  const allKeys = Object.values(METRICS_KEYS)
  await redis.del(...allKeys)
}