import { Request, Response, NextFunction } from 'express'
import { getRedisClient, loadLuaScripts, rateLimitConfig } from '../utils/redisClient'
import { extractIp, normalizeIp } from '../utils/ipExtractor'
import { checkPenalty, registerPenaltyRejection, shouldActivatePenalty, activatePenalty } from './penaltyBox'

type Scope = 'global' | 'auth' | 'write' | 'user'

interface RateLimitStrategy {
  name: string
  scope: Scope
  limit: number
  windowMs: number
  getIdentifier: (req: Request) => string
  shouldApply: (req: Request) => boolean
  getHeaders: (result: { allowed: boolean; count: number; limit: number; resetAt: number }, req: Request) => Record<string, string>
}

interface LuaResult {
  allowed: boolean
  count: number
  limit: number
  resetAt: number
}

let luaSha: string | null = null

async function ensureLuaLoaded(): Promise<string> {
  if (luaSha) return luaSha
  const redis = getRedisClient()
  luaSha = await loadLuaScripts(redis)
  return luaSha
}

async function executeSlidingWindow(
  key: string,
  limit: number,
  windowMs: number
): Promise<LuaResult> {
  const redis = getRedisClient()
  const sha = await ensureLuaLoaded()
  const now = Date.now()

  const result = await redis.evalsha(sha, 1, key, now, windowMs, limit) as [number, number, number]
  const [allowed, count, limitReturned] = result
  const windowStart = now - windowMs
  const resetAt = now + (windowMs - (now - windowStart) % windowMs)

  return {
    allowed: allowed === 1,
    count,
    limit: limitReturned,
    resetAt
  }
}

function getWindowStartKey(scope: Scope, identifier: string): string {
  const now = Date.now()
  const windowMs = rateLimitConfig[scope].windowMs
  const windowStart = now - (now % windowMs)
  return `ratelimit:${scope}:${identifier}:${windowStart}`
}

function getScopeConfig(scope: Scope) {
  return rateLimitConfig[scope]
}

function createGlobalStrategy(): RateLimitStrategy {
  const { limit, windowMs } = getScopeConfig('global')
  return {
    name: 'global',
    scope: 'global',
    limit,
    windowMs,
    getIdentifier: (req) => normalizeIp(extractIp(req)),
    shouldApply: () => true,
    getHeaders: (result) => ({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, result.limit - result.count).toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    }),
  }
}

function createAuthStrategy(): RateLimitStrategy {
  const { limit, windowMs } = getScopeConfig('auth')
  return {
    name: 'auth',
    scope: 'auth',
    limit,
    windowMs,
    getIdentifier: (req) => normalizeIp(extractIp(req)),
    shouldApply: (req) => req.path.startsWith('/auth/'),
    getHeaders: (result) => ({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, result.limit - result.count).toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    }),
  }
}

function createWriteStrategy(): RateLimitStrategy {
  const { limit, windowMs } = getScopeConfig('write')
  return {
    name: 'write',
    scope: 'write',
    limit,
    windowMs,
    getIdentifier: (req) => req.user?.id ?? normalizeIp(extractIp(req)),
    shouldApply: (req) => {
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) return false
      return req.path.startsWith('/movies')
    },
    getHeaders: (result) => ({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': Math.max(0, result.limit - result.count).toString(),
      'X-RateLimit-Reset': Math.ceil(result.resetAt / 1000).toString(),
    }),
  }
}

function createUserStrategy(): RateLimitStrategy {
  const { limit, windowMs } = getScopeConfig('user')
  return {
    name: 'user',
    scope: 'user',
    limit,
    windowMs,
    getIdentifier: (req) => req.user?.id ?? '',
    shouldApply: (req) => !!req.user,
    getHeaders: (result) => ({
      'X-RateLimit-Limit-User': result.limit.toString(),
      'X-RateLimit-Remaining-User': Math.max(0, result.limit - result.count).toString(),
      'X-RateLimit-Reset-User': Math.ceil(result.resetAt / 1000).toString(),
    }),
  }
}

const strategies: RateLimitStrategy[] = [
  createGlobalStrategy(),
  createAuthStrategy(),
  createWriteStrategy(),
  createUserStrategy(),
]

export function getApplicableStrategies(req: Request): RateLimitStrategy[] {
  return strategies.filter(s => s.shouldApply(req))
}

export async function rateLimiterMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const applicable = getApplicableStrategies(req)

  for (const strategy of applicable) {
    const identifier = strategy.getIdentifier(req)
    if (!identifier) continue

    const penalty = await checkPenalty(identifier)
    if (penalty.blocked) {
      res.set({
        'Retry-After': (penalty.retryAfter ?? 900).toString(),
        'X-RateLimit-Penalty': 'true',
      })
      res.status(403).json({ error: 'Too many requests, penalty active', retryAfter: penalty.retryAfter })
      return
    }

    const key = getWindowStartKey(strategy.scope, identifier)
    const result = await executeSlidingWindow(key, strategy.limit, strategy.windowMs)

    const headers = strategy.getHeaders(result, req)
    Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v))

    if (!result.allowed) {
      await registerPenaltyRejection(strategy.scope, identifier)
      if (await shouldActivatePenalty(identifier)) {
        await activatePenalty(identifier)
      }

      const retryAfter = Math.ceil(strategy.windowMs / 1000)
      res.set('Retry-After', retryAfter.toString())
      res.status(429).json({ error: 'Rate limit exceeded', retryAfter })
      return
    }
  }

  next()
}

export { strategies, RateLimitStrategy }