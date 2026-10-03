import type { Request, Response, NextFunction } from 'express'
import { getApplicableStrategies, executeSlidingWindow, getWindowStartKey } from './rateLimiterStrategies'
import { checkPenalty, registerPenaltyRejection, shouldActivatePenalty, activatePenalty } from './penaltyBox'
import { recordHit, recordRejection, recordRedisError, recordRedisSlow } from '../services/rateLimitMetrics'
import { rateLimitConfig } from '../config/rateLimitConfig'

interface RateLimitRequest {
  ip?: string
  path: string
  method: string
  headers: Record<string, string | string[] | undefined>
  user?: { id: string }
}

export async function rateLimiter(req: Request, res: Response, next: NextFunction): Promise<void> {
  const strategies = getApplicableStrategies(req as unknown as RateLimitRequest)

  for (const strategy of strategies) {
    const identifier = strategy.getIdentifier(req as unknown as RateLimitRequest)
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
    const start = Date.now()
    let result
    try {
      result = await executeSlidingWindow(key, strategy.limit, strategy.windowMs)
    } catch (err) {
      await recordRedisError()
      if (rateLimitConfig.failOpen) return next()
      throw err
    }
    const latency = Date.now() - start
    if (latency > 100) {
      await recordRedisSlow()
    }

    const headers = strategy.getHeaders(result, req as unknown as RateLimitRequest)
    const entries = Object.entries(headers)

    for (const entry of entries) {
      const k = entry[0]
      const v = entry[1]
      res.setHeader(k, v)
    }

    if (!result.allowed) {
      await recordRejection()
      await registerPenaltyRejection(strategy.scope, identifier)
      if (await shouldActivatePenalty(identifier)) {
        await activatePenalty(identifier)
      }
      const retryAfter = Math.ceil(strategy.windowMs / 1000)
      res.set('Retry-After', retryAfter.toString())
      res.status(429).json({ error: 'Rate limit exceeded', retryAfter })
      return
    }

    await recordHit()
  }

  next()
}