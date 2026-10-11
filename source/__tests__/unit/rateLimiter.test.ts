
describe('rateLimiterStrategies', () => {
  describe('getWindowStartKey', () => {
    it('should generate correct key format', () => {
      const { getWindowStartKey } = require('../../middleware/rateLimiterStrategies')
      const { rateLimitConfig } = require('../../config/rateLimitConfig')
      
      const now = Date.now()
      const windowMs = rateLimitConfig.global.windowMs
      const windowStart = now - (now % windowMs)
      const expectedKey = `ratelimit:global:test-ip:${windowStart}`
      
      const key = getWindowStartKey('global', 'test-ip')
      expect(key).toBe(expectedKey)
    })
  })

  describe('strategy shouldApply logic', () => {
    it('global strategy should always apply', () => {
      const { getApplicableStrategies } = require('../../middleware/rateLimiterStrategies')
      const req = { path: '/movies', method: 'GET', user: undefined }
      const strategies = require('../../middleware/rateLimiterStrategies').getApplicableStrategies(req)
      
      const globalStrategy = strategies.find((s: any) => s.name === 'global')
      expect(globalStrategy).toBeDefined()
      expect(globalStrategy.shouldApply({ path: '/anything', method: 'GET' })).toBe(true)
    })

    it('auth strategy should apply only to /auth/* paths', () => {
      const { getApplicableStrategies } = require('../../middleware/rateLimiterStrategies')
      
      const authReq = { path: '/auth/login', method: 'POST' }
      const strategies = require('../../middleware/rateLimiterStrategies').getApplicableStrategies(authReq)
      const authStrategy = strategies.find((s: any) => s.name === 'auth')
      expect(authStrategy).toBeDefined()
      expect(authStrategy.shouldApply({ path: '/auth/login', method: 'POST' })).toBe(true)
      expect(authStrategy.shouldApply({ path: '/movies', method: 'GET' })).toBe(false)
    })

    it('write strategy should apply to POST/PUT/PATCH/DELETE on /movies', () => {
      const { getApplicableStrategies } = require('../../middleware/rateLimiterStrategies')
      
      const writeReq = { path: '/movies', method: 'POST' }
      const strategies = require('../../middleware/rateLimiterStrategies').getApplicableStrategies(writeReq)
      const writeStrategy = strategies.find((s: any) => s.name === 'write')
      expect(writeStrategy).toBeDefined()
      
      expect(writeStrategy.shouldApply({ path: '/movies', method: 'POST' })).toBe(true)
      expect(writeStrategy.shouldApply({ path: '/movies', method: 'PUT' })).toBe(true)
      expect(writeStrategy.shouldApply({ path: '/movies', method: 'PATCH' })).toBe(true)
      expect(writeStrategy.shouldApply({ path: '/movies', method: 'DELETE' })).toBe(true)
      expect(writeStrategy.shouldApply({ path: '/movies', method: 'GET' })).toBe(false)
      expect(writeStrategy.shouldApply({ path: '/auth/login', method: 'POST' })).toBe(false)
    })

    it('user strategy should apply when user is authenticated', () => {
      const { getApplicableStrategies } = require('../../middleware/rateLimiterStrategies')
      
      const userReq = { path: '/movies', method: 'GET', user: { id: 'user-123' } }
      const strategies = require('../../middleware/rateLimiterStrategies').getApplicableStrategies(userReq)
      const userStrategy = strategies.find((s: any) => s.name === 'user')
      expect(userStrategy).toBeDefined()
      expect(userStrategy.shouldApply(userReq)).toBe(true)
    })

    it('user strategy should not apply for anonymous users', () => {
      const { getApplicableStrategies, strategies } = require('../../middleware/rateLimiterStrategies')
      
      const anonReq = { path: '/movies', method: 'GET', user: undefined }
      const applicableStrategies = require('../../middleware/rateLimiterStrategies').getApplicableStrategies(anonReq)
      const userStrategy = strategies.find((s: any) => s.name === 'user')
      expect(userStrategy).toBeDefined()
      expect(userStrategy.shouldApply({ path: '/movies', method: 'GET', user: undefined })).toBe(false)
      expect(applicableStrategies.find((s: any) => s.name === 'user')).toBeUndefined()
    })
  })
})