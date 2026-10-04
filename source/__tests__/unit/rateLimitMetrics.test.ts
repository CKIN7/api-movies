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

describe('rateLimitMetrics', () => {
  let redis: any

  beforeEach(() => {
    jest.resetModules()

    const RedisMock = require('ioredis-mock').default
    redis = new RedisMock()
  })

  describe('incrementMetric', () => {
    it('should increment totalHits counter', async () => {
      const { incrementMetric } = require('../../services/rateLimitMetrics')
      await incrementMetric('totalHits')
      const value = await redis.get('ratelimit:metrics:totalHits').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('should increment totalRejected counter', async () => {
      const { incrementMetric } = require('../../services/rateLimitMetrics')
      await incrementMetric('totalRejected')
      const value = await redis.get('ratelimit:metrics:totalRejected').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('should increment redisErrors counter', async () => {
      const { recordRedisError } = require('../../services/rateLimitMetrics')
      await recordRedisError()
      const value = await redis.get('ratelimit:metrics:redisErrors').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('should increment redisSlow counter', async () => {
      const { recordRedisSlow } = require('../../services/rateLimitMetrics')
      await recordRedisSlow()
      const value = await redis.get('ratelimit:metrics:redisSlow').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })

  describe('recordHit', () => {
    it('should increment totalHits', async () => {
      const { recordHit } = require('../../services/rateLimitMetrics')
      await recordHit()
      const value = await redis.get('ratelimit:metrics:totalHits').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })

  describe('recordRejection', () => {
    it('should increment totalRejected', async () => {
      const { recordRejection } = require('../../services/rateLimitMetrics')
      await recordRejection()
      const value = await redis.get('ratelimit:metrics:totalRejected').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })

  describe('recordRedisError', () => {
    it('should increment redisErrors', async () => {
      const { recordRedisError } = require('../../services/rateLimitMetrics')
      await recordRedisError()
      const value = await redis.get('ratelimit:metrics:redisErrors').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })

  describe('recordRedisSlow', () => {
    it('should increment redisSlow', async () => {
      const { recordRedisSlow } = require('../../services/rateLimitMetrics')
      await recordRedisSlow()
      const value = await redis.get('ratelimit:metrics:redisSlow').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })

  describe('getRateLimitMetrics', () => {
    it('should return zeroed metrics for empty state', async () => {
      const { getRateLimitMetrics } = require('../../services/rateLimitMetrics')
      const metrics = await getRateLimitMetrics()
      
      expect(metrics.totalHits).toBe(0)
      expect(metrics.totalRejected).toBe(0)
      expect(metrics.blockedIpsCount).toBe(0)
      expect(metrics.penaltyActivations).toBe(0)
      expect(metrics.redisErrors).toBe(0)
      expect(metrics.redisSlow).toBe(0)
      expect(metrics.rejectionRate).toBe(0)
      expect(metrics.activePenalties).toEqual([])
      expect(metrics.byScope.global.hits).toBe(0)
      expect(metrics.byScope.global.rejected).toBe(0)
      expect(metrics.byScope.auth.hits).toBe(0)
      expect(metrics.byScope.auth.rejected).toBe(0)
      expect(metrics.byScope.write.hits).toBe(0)
      expect(metrics.byScope.write.rejected).toBe(0)
      expect(metrics.byScope.user.hits).toBe(0)
      expect(metrics.byScope.user.rejected).toBe(0)
    })

    it('should calculate rejectionRate correctly', async () => {
      await redis.set('ratelimit:metrics:totalHits', '100')
      await redis.set('ratelimit:metrics:totalRejected', '5')

      const { getRateLimitMetrics } = require('../../services/rateLimitMetrics')
      const metrics = await getRateLimitMetrics()
      
      expect(metrics.totalHits).toBe(100)
      expect(metrics.totalRejected).toBe(5)
      expect(metrics.rejectionRate).toBe(5.0)
    })

    it('should handle division by zero for rejectionRate', async () => {
      await redis.set('ratelimit:metrics:totalHits', '0')
      await redis.set('ratelimit:metrics:totalRejected', '0')

      const { getRateLimitMetrics } = require('../../services/rateLimitMetrics')
      const metrics = await getRateLimitMetrics()
      
      expect(metrics.rejectionRate).toBe(0)
    })
  })

  describe('clearMetrics', () => {
    it('should reset all metrics to zero', async () => {
      await redis.incr('ratelimit:metrics:totalHits')
      await redis.incr('ratelimit:metrics:totalRejected')
      await redis.incr('ratelimit:metrics:penaltyActivations')
      await redis.incr('ratelimit:metrics:redisErrors')
      await redis.incr('ratelimit:metrics:redisSlow')
      await redis.sadd('ratelimit:metrics:blockedIps', 'ip1', 'ip2')

      const { clearMetrics } = require('../../services/rateLimitMetrics')
      await clearMetrics()

      const { getRateLimitMetrics } = require('../../services/rateLimitMetrics')
      const metrics = await getRateLimitMetrics()
      
      expect(metrics.totalHits).toBe(0)
      expect(metrics.totalRejected).toBe(0)
      expect(metrics.penaltyActivations).toBe(0)
      expect(metrics.redisErrors).toBe(0)
      expect(metrics.redisSlow).toBe(0)
      expect(metrics.blockedIpsCount).toBe(0)
      expect(metrics.activePenalties).toEqual([])
    })
  })

  describe('recordHit / recordRejection helpers', () => {
    it('recordHit should increment totalHits', async () => {
      const { recordHit } = require('../../services/rateLimitMetrics')
      await recordHit()
      const value = await redis.get('ratelimit:metrics:totalHits').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('recordRejection should increment totalRejected', async () => {
      const { recordRejection } = require('../../services/rateLimitMetrics')
      await recordRejection()
      const value = await redis.get('ratelimit:metrics:totalRejected').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('recordRedisError should increment redisErrors', async () => {
      const { recordRedisError } = require('../../services/rateLimitMetrics')
      await recordRedisError()
      const value = await redis.get('ratelimit:metrics:redisErrors').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('recordRedisSlow should increment redisSlow', async () => {
      const { recordRedisSlow } = require('../../services/rateLimitMetrics')
      await recordRedisSlow()
      const value = await redis.get('ratelimit:metrics:redisSlow').then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })
  })
})