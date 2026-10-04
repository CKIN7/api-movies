import { getRedisClient } from '../utils/redisClient'
import { rateLimitConfig } from '../config/rateLimitConfig'

const PENALTY_PREFIX = 'ratelimit:penalty:'
const BLOCKED_IPS_KEY = 'ratelimit:metrics:blockedIps'
const PENALTY_ACTIVATIONS_KEY = 'ratelimit:metrics:penaltyActivations'
const REJECTION_PREFIX = 'ratelimit:penaltyrejections:'

type Scope = 'global' | 'auth' | 'write' | 'user'

// ---------- Penalización ----------

export async function checkPenalty(
  identifier: string
): Promise<{ blocked: boolean; retryAfter?: number }> {
  const redis = getRedisClient()
  const ttl = await redis.ttl(`${PENALTY_PREFIX}${identifier}`)
  return ttl > 0 ? { blocked: true, retryAfter: ttl } : { blocked: false }
}

export async function activatePenalty(identifier: string): Promise<void> {
  const redis = getRedisClient()
  const { durationMs } = rateLimitConfig.penalty

  await redis
    .multi()
    .setex(`${PENALTY_PREFIX}${identifier}`, Math.ceil(durationMs / 1000), '1')
    .sadd(BLOCKED_IPS_KEY, identifier)
    .incr(PENALTY_ACTIVATIONS_KEY)
    .exec()
}

export async function clearPenalty(identifier: string): Promise<void> {
  const redis = getRedisClient()
  await redis
    .multi()
    .del(`${PENALTY_PREFIX}${identifier}`)
    .srem(BLOCKED_IPS_KEY, identifier)
    .exec()
}

export async function getPenaltyStats(): Promise<{ blockedCount: number; activations: number }> {
  const redis = getRedisClient()
  const blockedIps = await redis.smembers(BLOCKED_IPS_KEY)
  
  // Solo lectura: filtrar sin limpiar
  let blockedCount = 0
  for (const ip of blockedIps) {
    const ttl = await redis.ttl(`${PENALTY_PREFIX}${ip}`)
    if (ttl > 0) blockedCount++
  }
  
  const activations = await redis.get(PENALTY_ACTIVATIONS_KEY).then(v => Number(v) || 0)
  
  return { blockedCount, activations }
}

export async function cleanupExpiredPenalties(): Promise<number> {
  const redis = getRedisClient()
  const blockedIps = await redis.smembers(BLOCKED_IPS_KEY)
  let cleaned = 0
  
  for (const ip of blockedIps) {
    const ttl = await redis.ttl(`${PENALTY_PREFIX}${ip}`)
    if (ttl <= 0) {
      await redis.srem(BLOCKED_IPS_KEY, ip)
      cleaned++
    }
  }
  return cleaned
}

// ---------- Contador de rechazos (429) ----------

/**
 * Registra un rechazo (429) en un scope concreto.
 * Solo debe llamarse cuando el rate limiter ya devolvió 429.
 */
export async function registerPenaltyRejection(scope: Scope, identifier: string): Promise<void> {
  const redis = getRedisClient()
  const key = `${REJECTION_PREFIX}${scope}:${identifier}`
  const { windowMs } = rateLimitConfig.penalty

  const rejections = await redis.incr(key)
  if (rejections === 1) {
    await redis.pexpire(key, windowMs)
  }
}

// ---------- Decisión O(1) ----------

/**
 * Penaliza si CUALQUIER scope acumula >= su umbral de rechazos.
 * Coste: 1 MGET. O(1).
 */
export async function shouldActivatePenalty(identifier: string): Promise<boolean> {
  const redis = getRedisClient()
  const { penalty } = rateLimitConfig

  const scopes: Array<{ name: Scope; threshold: number }> = [
    { name: 'auth', threshold: penalty.thresholds.auth },
    { name: 'write', threshold: penalty.thresholds.write },
    { name: 'user', threshold: penalty.thresholds.user },
    { name: 'global', threshold: penalty.thresholds.global },
  ]

  const keys = scopes.map(s => `${REJECTION_PREFIX}${s.name}:${identifier}`)
  const values = await redis.mget(...keys)

  for (let i = 0; i < scopes.length; i++) {
    const rejections = Number(values[i]) || 0
    const { name, threshold } = scopes[i]

    if (rejections >= threshold) {
      console.warn(
        `[penalty] ${identifier} penalizado por scope "${name}": ${rejections} rechazos (>= ${threshold})`
      )
      return true
    }
  }

  return false
}