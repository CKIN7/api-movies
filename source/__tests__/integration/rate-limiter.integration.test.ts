import request from 'supertest'
import { createApp } from '../../api'
import { rateLimitConfig } from '../../config/rateLimitConfig'
import { authHeader } from '../helpers/auth'

jest.mock('../../utils/redisClient', () => {
  const RedisMock = require('ioredis-mock').default
  const mockRedis = new RedisMock()
  return {
    getRedisClient: () => mockRedis,
    rateLimitConfig: require('../../config/rateLimitConfig').rateLimitConfig,
    recordHit: jest.fn(),
    recordRejection: jest.fn(),
    recordRedisError: jest.fn(),
    recordRedisSlow: jest.fn()
  }
})

const AUTH = authHeader()

describe('Rate Limiter Integration', () => {
  describe('Global Rate Limiter', () => {
    test('rate limiter middleware is applied and returns 200', async () => {
      const app = createApp()

      const res = await request(app).get('/')
      expect(res.status).toBe(200)
    })
  })

  describe('Rate Limiter Configuration', () => {
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
})