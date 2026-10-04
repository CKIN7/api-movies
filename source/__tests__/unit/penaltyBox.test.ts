const { rateLimitConfig } = require('../../config/rateLimitConfig')

const PENALTY_PREFIX = 'ratelimit:penalty:'
const BLOCKED_IPS_KEY = 'ratelimit:metrics:blockedIps'
const PENALTY_ACTIVATIONS_KEY = 'ratelimit:metrics:penaltyActivations'
const REJECTION_PREFIX = 'ratelimit:penaltyrejections:'

describe('penaltyBox', () => {
  let redis: any
  let checkPenalty: any
  let activatePenalty: any
  let clearPenalty: any
  let getPenaltyStats: any
  let registerPenaltyRejection: any
  let shouldActivatePenalty: any
  let cleanupExpiredPenalties: any

  beforeEach(async () => {
    jest.resetModules()

    const RedisMock = (await import('ioredis-mock')).default
    redis = new RedisMock()

    jest.doMock('../../utils/redisClient', () => ({
      getRedisClient: () => redis,
      rateLimitConfig: require('../../config/rateLimitConfig').rateLimitConfig,
      recordHit: jest.fn(),
      recordRejection: jest.fn(),
      recordRedisError: jest.fn(),
      recordRedisSlow: jest.fn()
    }))

    const module = await import('../../middleware/penaltyBox')
    checkPenalty = module.checkPenalty
    activatePenalty = module.activatePenalty
    clearPenalty = module.clearPenalty
    getPenaltyStats = module.getPenaltyStats
    registerPenaltyRejection = module.registerPenaltyRejection
    shouldActivatePenalty = module.shouldActivatePenalty
    cleanupExpiredPenalties = module.cleanupExpiredPenalties
  })

  const testIdentifier = 'test-ip-123'

  describe('checkPenalty', () => {
    it('should return blocked=false for non-existent identifier', async () => {
      const result = await checkPenalty('non-existent')
      expect(result).toEqual({ blocked: false })
    })

    it('should return blocked=true with retryAfter for active penalty', async () => {
      await redis.setex('ratelimit:penalty:' + testIdentifier, 60, '1')

      const result = await checkPenalty(testIdentifier)
      expect(result.blocked).toBe(true)
      expect(result.retryAfter).toBeGreaterThan(0)
      expect(result.retryAfter).toBeLessThanOrEqual(60)
    })

    it('should return blocked=false for expired penalty', async () => {
      await redis.setex('ratelimit:penalty:' + testIdentifier, 1, '1')
      await new Promise(resolve => setTimeout(resolve, 1100))

      const result = await checkPenalty(testIdentifier)
      expect(result.blocked).toBe(false)
    })
  })

  describe('activatePenalty', () => {
    it('should create penalty key with correct TTL', async () => {
      await activatePenalty(testIdentifier)

      const ttl = await redis.ttl('ratelimit:penalty:' + testIdentifier)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(rateLimitConfig.penalty.durationMs / 1000)
    })

    it('should add identifier to blockedIps set', async () => {
      await activatePenalty(testIdentifier)

      const isMember = await redis.sismember('ratelimit:metrics:blockedIps', testIdentifier)
      expect(isMember).toBe(1)
    })

    it('should increment penaltyActivations counter', async () => {
      const before = await redis.get('ratelimit:metrics:penaltyActivations').then((v: string | null) => Number(v) || 0)

      await activatePenalty(testIdentifier)

      const after = await redis.get('ratelimit:metrics:penaltyActivations').then((v: string | null) => Number(v) || 0)
      expect(after).toBe(before + 1)
    })

    it('should use atomic pipeline', async () => {
      await activatePenalty(testIdentifier)

      const [ttl, isMember, activations] = await Promise.all([
        redis.ttl('ratelimit:penalty:' + testIdentifier),
        redis.sismember('ratelimit:metrics:blockedIps', testIdentifier),
        redis.get('ratelimit:metrics:penaltyActivations').then((v: string | null) => Number(v) || 0)
      ])

      expect(ttl).toBeGreaterThan(0)
      expect(isMember).toBe(1)
      expect(activations).toBe(1)
    })
  })

  describe('clearPenalty', () => {
    it('should remove penalty key and blockedIps entry', async () => {
      await activatePenalty(testIdentifier)
      await clearPenalty(testIdentifier)

      const exists = await redis.exists('ratelimit:penalty:' + testIdentifier)
      const isMember = await redis.sismember('ratelimit:metrics:blockedIps', testIdentifier)

      expect(exists).toBe(0)
      expect(isMember).toBe(0)
    })

    it('should not throw for non-existent identifier', async () => {
      await expect(clearPenalty('non-existent')).resolves.toBeUndefined()
    })
  })

  describe('getPenaltyStats', () => {
    it('should return blockedCount=0 and activations=0 for empty state', async () => {
      const stats = await getPenaltyStats()
      expect(stats.blockedCount).toBe(0)
      expect(stats.activations).toBe(0)
    })

    it('should return correct blockedCount after activatePenalty', async () => {
      await activatePenalty(testIdentifier)

      const stats = await getPenaltyStats()
      expect(stats.blockedCount).toBe(1)
      expect(stats.activations).toBe(1)
    })

    it('should not count expired penalties', async () => {
      await redis.setex('ratelimit:penalty:expired-ip', 1, '1')
      await redis.sadd('ratelimit:metrics:blockedIps', 'expired-ip')
      await new Promise(resolve => setTimeout(resolve, 1100))

      const stats = await getPenaltyStats()
      expect(stats.blockedCount).toBe(0)
    })
  })

  describe('registerPenaltyRejection', () => {
    it('should increment rejection counter for scope', async () => {
      await registerPenaltyRejection('global', testIdentifier)

      const key = 'ratelimit:penaltyrejections:global:' + testIdentifier
      const value = await redis.get(key).then((v: string | null) => Number(v) || 0)
      expect(value).toBe(1)
    })

    it('should set TTL on first rejection', async () => {
      await registerPenaltyRejection('auth', testIdentifier)

      const key = 'ratelimit:penaltyrejections:auth:' + testIdentifier
      const ttl = await redis.ttl(key)
      expect(ttl).toBeGreaterThan(0)
      expect(ttl).toBeLessThanOrEqual(rateLimitConfig.penalty.windowMs / 1000)
    })

    it('should increment existing counter', async () => {
      await registerPenaltyRejection('write', testIdentifier)
      await registerPenaltyRejection('write', testIdentifier)
      await registerPenaltyRejection('write', testIdentifier)

      const key = 'ratelimit:penaltyrejections:write:' + testIdentifier
      const value = await redis.get(key).then((v: string | null) => Number(v) || 0)
      expect(value).toBe(3)
    })

    it('should work for all scopes', async () => {
      for (const scope of ['global', 'auth', 'write', 'user'] as const) {
        await registerPenaltyRejection(scope, 'test-' + scope)
        const key = 'ratelimit:penaltyrejections:' + scope + ':test-' + scope
        const value = await redis.get(key).then((v: string | null) => Number(v) || 0)
        expect(value).toBe(1)
      }
    })
  })

  describe('shouldActivatePenalty', () => {
    it('should return false when all scopes below threshold', async () => {
      const result = await shouldActivatePenalty(testIdentifier)
      expect(result).toBe(false)
    })

    it('should return true when any scope exceeds threshold', async () => {
      await redis.set('ratelimit:penaltyrejections:auth:' + testIdentifier, '21')

      const result = await shouldActivatePenalty(testIdentifier)
      expect(result).toBe(true)
    })

    it('should check all scopes independently', async () => {
      await redis.set('ratelimit:penaltyrejections:global:' + testIdentifier, '60')
      await redis.set('ratelimit:penaltyrejections:auth:' + testIdentifier, '10')
      await redis.set('ratelimit:penaltyrejections:write:' + testIdentifier, '20')
      await redis.set('ratelimit:penaltyrejections:user:' + testIdentifier, '50')

      const result = await shouldActivatePenalty(testIdentifier)
      expect(result).toBe(true)
    })

    it('should only trigger when threshold is exceeded (>=)', async () => {
      await redis.set('ratelimit:penaltyrejections:auth:' + testIdentifier, '19')
      let result = await shouldActivatePenalty(testIdentifier)
      expect(result).toBe(false)

      await redis.set('ratelimit:penaltyrejections:auth:' + testIdentifier, '20')
      result = await shouldActivatePenalty(testIdentifier)
      expect(result).toBe(true)
    })
  })

  describe('cleanupExpiredPenalties', () => {
    it('should return 0 when no expired penalties', async () => {
      const cleaned = await cleanupExpiredPenalties()
      expect(cleaned).toBe(0)
    })

    it('should clean up expired penalties and return count', async () => {
      // Use activatePenalty to properly set up the penalized IPs set
      await activatePenalty('expired-1')
      await redis.setex('ratelimit:penalty:expired-1', 1, '1')
      await activatePenalty('expired-2')
      await redis.setex('ratelimit:penalty:expired-2', 1, '1')
      await redis.sadd('ratelimit:metrics:blockedIps', 'expired-1', 'expired-2', 'active-ip')
      await new Promise(resolve => setTimeout(resolve, 1100))

      const cleaned = await cleanupExpiredPenalties()
      expect(cleaned).toBe(2)

      const activeIps = await redis.smembers('ratelimit:metrics:blockedIps')
      expect(activeIps).toContain('active-ip')
      expect(activeIps).not.toContain('expired-1')
      expect(activeIps).not.toContain('expired-2')
    })

    it('should not remove active penalties', async () => {
      await redis.setex('ratelimit:penalty:active-ip', 60, '1')
      await redis.sadd('ratelimit:metrics:blockedIps', 'active-ip')

      const cleaned = await cleanupExpiredPenalties()
      expect(cleaned).toBe(0)

      const isMember = await redis.sismember('ratelimit:metrics:blockedIps', 'active-ip')
      expect(isMember).toBe(1)
    })
  })

  describe('integration flow', () => {
    it('should track rejections and activate penalty when threshold exceeded', async () => {
      const identifier = 'integration-test-ip'

      for (let i = 0; i < 21; i++) {
        await registerPenaltyRejection('auth', identifier)
      }

      const shouldActivate = await shouldActivatePenalty(identifier)
      expect(shouldActivate).toBe(true)

      await activatePenalty(identifier)

      const stats = await getPenaltyStats()
      expect(stats.blockedCount).toBe(1)
      expect(stats.activations).toBe(1)

      const penaltyCheck = await checkPenalty(identifier)
      expect(penaltyCheck.blocked).toBe(true)
    })

    it('should clear penalty and allow requests again', async () => {
      const identifier = 'clear-test-ip'
      await activatePenalty(identifier)

      let penaltyCheck = await checkPenalty(identifier)
      expect(penaltyCheck.blocked).toBe(true)

      await clearPenalty(identifier)

      penaltyCheck = await checkPenalty(identifier)
      expect(penaltyCheck.blocked).toBe(false)
    })
  })
})