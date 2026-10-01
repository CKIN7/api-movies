import Redis from 'ioredis'
import { rateLimitConfig } from '../config/rateLimitConfig'

let redisClient: Redis | null = null
let isShuttingDown = false

export function getRedisClient(): Redis {
  if (redisClient) return redisClient

  const url = process.env.REDIS_URL ?? 'redis://localhost:6379'

  redisClient = new Redis(url, {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 3) return null
      return Math.min(times * 200, 2000)
    },
    lazyConnect: true,
    enableReadyCheck: true,
    connectTimeout: 10000,
    commandTimeout: 5000,
  })

  redisClient.on('error', (err) => {
    if (!isShuttingDown) {
      console.error('[Redis] Connection error:', err.message)
    }
  })

  redisClient.on('connect', () => {
    console.log('[Redis] Connected')
  })

  redisClient.on('close', () => {
    if (!isShuttingDown) {
      console.warn('[Redis] Connection closed')
    }
  })

  return redisClient
}

export async function connectRedis(): Promise<Redis> {
  const client = getRedisClient()
  if (client.status === 'wait') {
    await client.connect()
  }
  return client
}

export async function disconnectRedis(): Promise<void> {
  isShuttingDown = true
  if (redisClient) {
    await redisClient.quit()
    redisClient = null
  }
}

export function isRedisHealthy(): boolean {
  return redisClient?.status === 'ready'
}

export const LUA_SLIDING_WINDOW = `
local key = KEYS[1]
local now = tonumber(ARGV[1])
local window = tonumber(ARGV[2])
local limit = tonumber(ARGV[3])
local windowStart = now - window

redis.call('ZREMRANGEBYSCORE', key, '-inf', windowStart)
local count = redis.call('ZCARD', key)

if count >= limit then
  return {0, count, limit}
end

local member = now .. '-' .. math.random()
redis.call('ZADD', key, now, member)
redis.call('EXPIRE', key, math.ceil(window / 1000) + 1)

return {1, count + 1, limit}
`

export async function loadLuaScripts(client: Redis): Promise<string> {
  const sha = await client.script('LOAD', LUA_SLIDING_WINDOW)
  return sha as string
}

export { rateLimitConfig }