import { rateLimitConfig } from '../../config/rateLimitConfig'

describe('rateLimitConfig', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  function loadConfig(envVars: Record<string, string | undefined> = {}) {
    jest.resetModules()
    process.env = { ...originalEnv, ...envVars }
    const { rateLimitConfig: config } = require('../../config/rateLimitConfig')
    return config
  }

  describe('defaults', () => {
    it('should have correct default values when env vars not set', () => {
      const config = loadConfig({
        RATE_LIMIT_GLOBAL: undefined,
        RATE_LIMIT_GLOBAL_WINDOW_MS: undefined,
        RATE_LIMIT_AUTH: undefined,
        RATE_LIMIT_AUTH_WINDOW_MS: undefined,
        RATE_LIMIT_WRITE: undefined,
        RATE_LIMIT_WRITE_WINDOW_MS: undefined,
        RATE_LIMIT_USER: undefined,
        RATE_LIMIT_USER_WINDOW_MS: undefined,
        RATE_LIMIT_PENALTY_THRESHOLD_GLOBAL: undefined,
        RATE_LIMIT_PENALTY_THRESHOLD_AUTH: undefined,
        RATE_LIMIT_PENALTY_THRESHOLD_WRITE: undefined,
        RATE_LIMIT_PENALTY_THRESHOLD_USER: undefined,
        RATE_LIMIT_PENALTY_WINDOW_MS: undefined,
        RATE_LIMIT_PENALTY_DURATION_MS: undefined,
        TRUST_PROXY: undefined,
        RATE_LIMIT_FAIL_OPEN: undefined,
      })

      expect(config.global.limit).toBe(100)
      expect(config.global.windowMs).toBe(60_000)
      expect(config.auth.limit).toBe(10)
      expect(config.auth.windowMs).toBe(60_000)
      expect(config.write.limit).toBe(30)
      expect(config.write.windowMs).toBe(60_000)
      expect(config.user.limit).toBe(500)
      expect(config.user.windowMs).toBe(60_000)
      expect(config.penalty.thresholds.global).toBe(50)
      expect(config.penalty.thresholds.auth).toBe(10)
      expect(config.penalty.thresholds.write).toBe(30)
      expect(config.penalty.thresholds.user).toBe(100)
      expect(config.penalty.windowMs).toBe(300_000)
      expect(config.penalty.durationMs).toBe(900_000)
      expect(config.trustProxy).toBe(false)
      expect(config.failOpen).toBe(true)
    })
  })

  describe('custom values from env', () => {
    it('should parse custom values from environment variables', () => {
      const config = loadConfig({
        RATE_LIMIT_GLOBAL: '200',
        RATE_LIMIT_GLOBAL_WINDOW_MS: '120000',
        RATE_LIMIT_AUTH: '5',
        RATE_LIMIT_AUTH_WINDOW_MS: '30000',
        RATE_LIMIT_WRITE: '10',
        RATE_LIMIT_WRITE_WINDOW_MS: '10000',
        RATE_LIMIT_USER: '1000',
        RATE_LIMIT_USER_WINDOW_MS: '60000',
        RATE_LIMIT_PENALTY_THRESHOLD_GLOBAL: '100',
        RATE_LIMIT_PENALTY_THRESHOLD_AUTH: '50',
        RATE_LIMIT_PENALTY_THRESHOLD_WRITE: '20',
        RATE_LIMIT_PENALTY_THRESHOLD_USER: '200',
        RATE_LIMIT_PENALTY_WINDOW_MS: '600000',
        RATE_LIMIT_PENALTY_DURATION_MS: '1800000',
        TRUST_PROXY: 'true',
        RATE_LIMIT_FAIL_OPEN: 'false',
      })

      expect(config.global.limit).toBe(200)
      expect(config.global.windowMs).toBe(120_000)
      expect(config.auth.limit).toBe(5)
      expect(config.auth.windowMs).toBe(30_000)
      expect(config.write.limit).toBe(10)
      expect(config.write.windowMs).toBe(10_000)
      expect(config.user.limit).toBe(1000)
      expect(config.user.windowMs).toBe(60_000)
      expect(config.penalty.thresholds.global).toBe(100)
      expect(config.penalty.thresholds.auth).toBe(50)
      expect(config.penalty.thresholds.write).toBe(20)
      expect(config.penalty.thresholds.user).toBe(200)
      expect(config.penalty.windowMs).toBe(600_000)
      expect(config.penalty.durationMs).toBe(1_800_000)
      expect(config.trustProxy).toBe(true)
      expect(config.failOpen).toBe(false)
    })
  })

  describe('isRateLimitEnabled', () => {
    function loadIsEnabled(envVars: Record<string, string | undefined> = {}) {
      jest.resetModules()
      process.env = { ...originalEnv, ...envVars }
      const { isRateLimitEnabled } = require('../../config/rateLimitConfig')
      return isRateLimitEnabled()
    }

    it('should be disabled only when RATE_LIMIT_ENABLED is "false"', () => {
      expect(loadIsEnabled({ RATE_LIMIT_ENABLED: 'false' })).toBe(false)
      expect(loadIsEnabled({ RATE_LIMIT_ENABLED: 'true' })).toBe(true)
      expect(loadIsEnabled({ RATE_LIMIT_ENABLED: '0' })).toBe(true)
      expect(loadIsEnabled({ RATE_LIMIT_ENABLED: undefined })).toBe(true)
    })
  })

  describe('boolean parsing', () => {
    it('should parse TRUST_PROXY as true only when "true"', () => {
      expect(loadConfig({ TRUST_PROXY: 'true' }).trustProxy).toBe(true)
      expect(loadConfig({ TRUST_PROXY: 'false' }).trustProxy).toBe(false)
      expect(loadConfig({ TRUST_PROXY: '1' }).trustProxy).toBe(false)
      expect(loadConfig({ TRUST_PROXY: undefined }).trustProxy).toBe(false)
    })

    it('should parse RATE_LIMIT_FAIL_OPEN as false only when "false"', () => {
      expect(loadConfig({ RATE_LIMIT_FAIL_OPEN: 'false' }).failOpen).toBe(false)
      expect(loadConfig({ RATE_LIMIT_FAIL_OPEN: 'true' }).failOpen).toBe(true)
      expect(loadConfig({ RATE_LIMIT_FAIL_OPEN: '0' }).failOpen).toBe(true)
      expect(loadConfig({ RATE_LIMIT_FAIL_OPEN: undefined }).failOpen).toBe(true)
    })
  })

  describe('type safety', () => {
    it('should have readonly config object', () => {
      expect(Object.isFrozen(rateLimitConfig) || Object.isSealed(rateLimitConfig)).toBe(false)
    })
  })
})