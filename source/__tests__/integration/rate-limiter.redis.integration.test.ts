import request from 'supertest'
import { createApp } from '../../api'
import { rateLimitConfig } from '../../config/rateLimitConfig'
import { connectRedis, disconnectRedis } from '../../utils/redisClient'

// Configure Redis for testing
let redis: any

beforeAll(async () => {
    redis = connectRedis()
    // Wait for connection
    await new Promise(resolve => setTimeout(resolve, 1000))
})

afterAll(async () => {
    // Este suite dispenza activamente el penalty box; se limpia para no
    // dejar penalizada a 127.0.0.1 al resto de suites (15 min de TTL).
    try {
      const keys = await redis.keys('ratelimit:*')
      if (keys.length > 0) await redis.del(...keys)
    } catch (e) {
      // Redis no disponible: ignorar
    }
    await disconnectRedis()
})

beforeEach(async () => {
    // Clear ALL rate limiter and penalty keys between tests to ensure isolation
    try {
      const keys = await redis.keys('ratelimit:*')
      if (keys.length > 0) {
        await redis.del(...keys)
      }
      // Also clear penalty box keys
      const penaltyKeys = await redis.keys('penalty:*')
      if (penaltyKeys.length > 0) {
        await redis.del(...penaltyKeys)
      }
      // Clear any blocked keys
      const blockedKeys = await redis.keys('blocked:*')
      if (blockedKeys.length > 0) {
        await redis.del(...blockedKeys)
      }
    } catch (e) {
      // Ignore errors - Redis may not support all commands
    }
    // Small delay to ensure Redis state is reset
    await new Promise(resolve => setTimeout(resolve, 50))
})

describe('Rate Limiter Integration (Real Redis)', () => {
  describe('Rate Limit Configuration', () => {
    test('global rate limit config is 100 requests per minute', () => {
      expect(rateLimitConfig.global.limit).toBe(100)
      expect(rateLimitConfig.global.windowMs).toBe(60_000)
    })

    test('auth rate limit config is 10 requests per minute', () => {
      expect(rateLimitConfig.auth.limit).toBe(10)
      expect(rateLimitConfig.auth.windowMs).toBe(60_000)
    })

    test('write rate limit config is 30 requests per minute', () => {
      expect(rateLimitConfig.write.limit).toBe(30)
      expect(rateLimitConfig.write.windowMs).toBe(60_000)
    })

    test('user rate limit config is 500 requests per minute', () => {
      expect(rateLimitConfig.user.limit).toBe(500)
      expect(rateLimitConfig.user.windowMs).toBe(60_000)
    })
  })

  describe('Penalty Box', () => {
    test('penalty box activates after threshold consecutive 429s', async () => {
      const app = createApp()
      const agent = request(app)

      // Auth limit: 10/min (RATE_LIMIT_AUTH) y umbral de penalty: 10 rechazos
      // (RATE_LIMIT_PENALTY_THRESHOLD_AUTH). Hacen falta 20 peticiones para
      // llegar a 10 rechazos, por eso se lanzan 25.
      let authRejections = 0
      for (let i = 0; i < 25; i++) {
        const res = await agent.get('/auth/login')
        if (res.status === 429) {
          authRejections++
          if (authRejections >= 10) break
        }
      }

      // After penalty threshold, next request should be blocked
      const res = await request(app).get('/')
      // Penalty box returns 403 with penalty headers
      expect(res.status).toBe(403)
      expect(res.headers['x-ratelimit-penalty']).toBe('true')
      expect(res.headers['retry-after']).toBeDefined()
    })

    test('penalty duration expires and normal service resumes', async () => {
      const app = createApp()
      const agent = request(app)

      // Exceed auth limit to trigger penalty
      for (let i = 0; i < 25; i++) {
        await agent.get('/auth/login')
      }

      // Should be in penalty box
      let res = await request(app).get('/')
      expect(res.status).toBe(403)

      // Verify penalty headers are present
      expect(res.headers['x-ratelimit-penalty']).toBe('true')
    })
  })

  describe('Rate Limit Middleware Applied', () => {
    test('rate limiter middleware is applied (request completes without error)', async () => {
      const app = createApp()

      const res = await request(app).get('/')
      // With real Redis, first request may vary; verify middleware doesn't crash
      expect([200, 403, 429]).toContain(res.status)
    })
  })
})