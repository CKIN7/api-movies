import request from 'supertest'
import { createApp } from '../../api'
import { rateLimitConfig } from '../../config/rateLimitConfig'
import { connectRedis, disconnectRedis, getRedisClient } from '../../utils/redisClient'

// Ejercita el limiter real contra Redis real en la DB 15 de tests.
// Antes este suite mockeaba utils/redisClient sin loadLuaScripts: el
// middleware lanzaba y hacia fail-open, asi que pasaba sin probar nada.
let redis: ReturnType<typeof getRedisClient>

beforeAll(async () => {
  process.env.RATE_LIMIT_ENABLED = 'true'
  redis = await connectRedis()
  await redis.flushdb()
})

beforeEach(async () => {
  await redis.flushdb()
})

afterAll(async () => {
  await redis.flushdb()
  await disconnectRedis()
  process.env.RATE_LIMIT_ENABLED = 'false'
})

describe('Rate Limiter Integration (real Redis, DB 15)', () => {
  test('applies the global limiter and exposes its headers', async () => {
    const app = createApp()

    const res = await request(app).get('/')

    expect(res.status).toBe(200)
    expect(res.headers['x-ratelimit-limit']).toBe(rateLimitConfig.global.limit.toString())
    expect(res.headers['x-ratelimit-remaining']).toBe((rateLimitConfig.global.limit - 1).toString())
  })

  test('rejects requests with 429 once the auth limit is exceeded', async () => {
    const app = createApp()
    const limit = rateLimitConfig.auth.limit

    for (let i = 0; i < limit; i++) {
      const res = await request(app).get('/auth/login')
      expect(res.status).not.toBe(429)
    }

    const res = await request(app).get('/auth/login')

    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBeDefined()
  })

  test('activates the penalty box and blocks every route afterwards', async () => {
    const app = createApp()

    let penaltyActivated = false
    for (let i = 0; i < 40; i++) {
      const res = await request(app).get('/auth/login')
      if (res.status === 403) {
        penaltyActivated = true
        break
      }
    }

    expect(penaltyActivated).toBe(true)

    const res = await request(app).get('/')
    expect(res.status).toBe(403)
    expect(res.headers['x-ratelimit-penalty']).toBe('true')
    expect(res.headers['retry-after']).toBeDefined()
  })

  test('a clean DB starts without an active penalty', async () => {
    const app = createApp()

    const res = await request(app).get('/')

    expect(res.status).not.toBe(403)
    expect(res.headers['x-ratelimit-penalty']).toBeUndefined()
  })
})
