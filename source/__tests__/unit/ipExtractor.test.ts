import { isValidIp, normalizeIp } from '../../utils/ipExtractor'

function loadExtractor(trustProxy: boolean) {
  jest.resetModules()
  process.env.TRUST_PROXY = trustProxy ? 'true' : 'false'
  const { extractIp } = require('../../utils/ipExtractor')
  return extractIp
}

describe('ipExtractor', () => {
  const originalEnv = process.env

  beforeEach(() => {
    jest.resetModules()
    process.env = { ...process.env }
  })

  afterAll(() => {
    process.env = process.env
  })

  function makeReq(overrides: { ip?: string; headers?: Record<string, string | string[] | undefined> } = {}) {
    return {
      ip: overrides.ip || '127.0.0.1',
      headers: overrides.headers || {},
    }
  }

  describe('extractIp', () => {
    describe('without trustProxy (default)', () => {
      it('should use req.ip', () => {
        const extractIp = loadExtractor(false)
        const req = { ip: '1.2.3.4', headers: {} }
        expect(extractIp(req)).toBe('1.2.3.4')
      })

      it('should fallback to X-Forwarded-For first IP if no ip', () => {
        const extractIp = loadExtractor(false)
        const req = { ip: undefined, headers: { 'x-forwarded-for': '5.6.7.8, 9.10.11.12' } }
        expect(extractIp(req)).toBe('5.6.7.8')
      })

      it('should fallback to localhost if nothing available', () => {
        const extractIp = loadExtractor(false)
        const req = { ip: undefined, headers: {} }
        expect(extractIp(req)).toBe('127.0.0.1')
      })
    })

    describe('with trustProxy=true', () => {
      it('should use first IP from X-Forwarded-For', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '127.0.0.1', headers: { 'x-forwarded-for': '203.0.113.45, 198.51.100.1' } }
        expect(extractIp(req)).toBe('203.0.113.45')
      })

      it('should use X-Real-IP if X-Forwarded-For not present', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '127.0.0.1', headers: { 'x-real-ip': '198.51.100.1' } }
        expect(extractIp(req)).toBe('198.51.100.1')
      })

      it('should prefer X-Forwarded-For over X-Real-IP', () => {
        const extractIp = loadExtractor(true)
        const req = {
          ip: '127.0.0.1',
          headers: {
            'x-forwarded-for': '203.0.113.45',
            'x-real-ip': '198.51.100.1'
          }
        }
        expect(extractIp(req)).toBe('203.0.113.45')
      })

      it('should trim whitespace from X-Forwarded-For', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '127.0.0.1', headers: { 'x-forwarded-for': '  203.0.113.45  , 198.51.100.1' } }
        expect(extractIp(req)).toBe('203.0.113.45')
      })

      it('should fallback to req.ip if X-Forwarded-For invalid', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '1.2.3.4', headers: { 'x-forwarded-for': 'invalid-ip' } }
        expect(extractIp(req)).toBe('1.2.3.4')
      })

      it('should fallback to req.ip if X-Real-IP invalid', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '1.2.3.4', headers: { 'x-real-ip': 'not-an-ip' } }
        expect(extractIp(req)).toBe('1.2.3.4')
      })

      it('should handle array headers (Express behavior)', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '127.0.0.1', headers: { 'x-forwarded-for': ['203.0.113.45', '198.51.100.1'] } }
        expect(extractIp(req)).toBe('203.0.113.45')
      })
    })

    describe('edge cases', () => {
      it('should return localhost for unknown header value', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: undefined, headers: { 'x-forwarded-for': 'unknown' } }
        expect(extractIp(req)).toBe('127.0.0.1')
      })

      it('should handle empty string headers', () => {
        const extractIp = loadExtractor(true)
        const req = { ip: '1.2.3.4', headers: { 'x-forwarded-for': '' } }
        expect(extractIp(req)).toBe('1.2.3.4')
      })
    })
  })

  describe('normalizeIp', () => {
    it('should strip ::ffff: prefix from IPv4-mapped IPv6', () => {
      expect(normalizeIp('::ffff:1.2.3.4')).toBe('1.2.3.4')
      expect(normalizeIp('::ffff:203.0.113.45')).toBe('203.0.113.45')
    })

    it('should leave regular IPv4 unchanged', () => {
      expect(normalizeIp('1.2.3.4')).toBe('1.2.3.4')
      expect(normalizeIp('203.0.113.45')).toBe('203.0.113.45')
    })

    it('should leave regular IPv6 unchanged', () => {
      expect(normalizeIp('2001:db8::1')).toBe('2001:db8::1')
      expect(normalizeIp('::1')).toBe('::1')
    })
  })

  describe('isValidIp', () => {
    describe('IPv4', () => {
      it('should accept valid IPv4', () => {
        expect(isValidIp('1.2.3.4')).toBe(true)
        expect(isValidIp('203.0.113.45')).toBe(true)
        expect(isValidIp('0.0.0.0')).toBe(true)
        expect(isValidIp('255.255.255.255')).toBe(true)
      })

      it('should reject invalid IPv4', () => {
        expect(isValidIp('256.1.2.3')).toBe(false)
        expect(isValidIp('1.2.3')).toBe(false)
        expect(isValidIp('1.2.3.4.5')).toBe(false)
        expect(isValidIp('abc.def.ghi.jkl')).toBe(false)
        expect(isValidIp('999.999.999.999')).toBe(false)
      })
    })

    describe('IPv6', () => {
      it('should accept valid full IPv6', () => {
        expect(isValidIp('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
        expect(isValidIp('2001:db8:85a3:0:0:8a2e:370:7334')).toBe(true)
      })

      it('should accept compressed IPv6', () => {
        expect(isValidIp('::1')).toBe(true)
        expect(isValidIp('2001:db8::1')).toBe(true)
        expect(isValidIp('::ffff:1.2.3.4')).toBe(true)
        expect(isValidIp('::')).toBe(true)
      })

      it('should reject invalid IPv6', () => {
        expect(isValidIp('2001:db8::1::2')).toBe(false)
        expect(isValidIp('gggg::1')).toBe(false)
      })
    })

    describe('edge cases', () => {
      it('should reject empty string', () => {
        expect(isValidIp('')).toBe(false)
      })

      it('should reject undefined/null', () => {
        expect(isValidIp(undefined as any)).toBe(false)
        expect(isValidIp(null as any)).toBe(false)
      })

      it('should reject "unknown"', () => {
        expect(isValidIp('unknown')).toBe(false)
      })
    })
  })
})