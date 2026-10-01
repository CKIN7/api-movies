import { getRedisClient } from '../utils/redisClient'
import { rateLimitConfig } from '../config/rateLimitConfig'

const PENALTY_PREFIX = 'ratelimit:penalty:'
const BLOCKED_IPS_KEY = 'ratelimit:metrics:blockedIps'
const PENALTY_ACTIVATIONS_KEY = 'ratelimit:metrics:penaltyActivations'

export async function checkPenalty(identifier: string): Promise<{ blocked: boolean; retryAfter?: number }> {
  const redis = getRedisClient()
  const penaltyKey = `${PENALTY_PREFIX}${identifier}`

  const ttl = await redis.ttl(penaltyKey)
  if (ttl > 0) {
    return { blocked: true, retryAfter: ttl }
  }

  return { blocked: false }
}

export async function activatePenalty(identifier: string): Promise<void> {
  const redis = getRedisClient()
  const penaltyKey = `${PENALTY_PREFIX}${identifier}`
  const { durationMs } = rateLimitConfig.penalty

  await redis.setex(penaltyKey, Math.ceil(durationMs / 1000), '1')
  await redis.sadd(BLOCKED_IPS_KEY, identifier)
  await redis.incr(PENALTY_ACTIVATIONS_KEY)
}

export async function shouldActivatePenalty(identifier: string): Promise<boolean> {
  const redis = getRedisClient()
  const { global, penalty } = rateLimitConfig

  const windowStart = Date.now() - penalty.windowMs
  let totalHits = 0

  const scopes = ['global', 'auth', 'write', 'user'] as const
  for (const scope of scopes) {
    const pattern = `ratelimit:${scope}:${identifier}:*`
    let cursor = '0'
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
      cursor = nextCursor
      for (const key of keys) {
        const count = await redis.zcount(key, windowStart, '+inf')
        totalHits += count
      }
    } while (cursor !== '0')
  }

  const threshold = global.limit * penalty.multiplier
  return totalHits > threshold
}

export async function clearPenalty(identifier: string): Promise<void> {
  const redis = getRedisClient()
  await redis.del(`${PENALTY_PREFIX}${identifier}`)
  await redis.srem(BLOCKED_IPS_KEY, identifier)
}

export async function getPenaltyStats(): Promise<{ blockedCount: number; activations: number }> {
  const redis = getRedisClient()
  const [blockedCount, activations] = await Promise.all([
    redis.scard(BLOCKED_IPS_KEY),
    redis.get(PENALTY_ACTIVATIONS_KEY).then(v => Number(v) || 0),
  ])
  return { blockedCount, activations }
}