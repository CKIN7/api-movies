import { rateLimitConfig } from '../config/rateLimitConfig'

function getHeaderAsString(headers: Record<string, string | string[] | undefined> | undefined, name: string): string | undefined {
  const value = headers?.[name.toLowerCase()]
  if (Array.isArray(value)) return value[0]
  return value
}

export function extractIp(req: { ip?: string; headers?: Record<string, string | string[] | undefined> }): string {
  if (rateLimitConfig.trustProxy) {
    const forwardedFor = getHeaderAsString(req.headers, 'x-forwarded-for')
    if (forwardedFor) {
      const firstIp = forwardedFor.split(',')[0].trim()
      if (isValidIp(firstIp)) return firstIp
    }

    const realIp = getHeaderAsString(req.headers, 'x-real-ip')
    if (realIp && isValidIp(realIp.trim())) return realIp.trim()
  }

  const directIp = req.ip ?? getHeaderAsString(req.headers, 'x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1'
  return isValidIp(directIp) ? directIp : '127.0.0.1'
}

function isValidIp(ip: string): boolean {
  if (!ip || ip === 'unknown') return false

  const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/
  const ipv6CompressedRegex = /^(([0-9a-fA-F]{1,4}:){1,7}:|::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})$/

  if (ipv4Regex.test(ip)) {
    return ip.split('.').every(octet => parseInt(octet, 10) <= 255)
  }

  return ipv6Regex.test(ip) || ipv6CompressedRegex.test(ip)
}

export function normalizeIp(ip: string): string {
  if (ip.startsWith('::ffff:')) {
    return ip.slice(7)
  }
  return ip
}