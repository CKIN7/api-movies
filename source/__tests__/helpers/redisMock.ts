import RedisMock from 'ioredis-mock'

let mockRedis: InstanceType<typeof RedisMock>

export function getMockRedis() {
  if (!mockRedis) {
    mockRedis = new RedisMock()
  }
  return mockRedis
}

export function resetMockRedis() {
  if (mockRedis) {
    mockRedis.flushall()
  }
}

export function createMockRedisClient() {
  return new RedisMock()
}