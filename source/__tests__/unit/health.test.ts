import express from 'express'
import request from 'supertest'

jest.mock('../../db/connection', () => ({
  __esModule: true,
  default: { query: jest.fn() },
}))

jest.mock('../../utils/redisClient', () => ({
  getRedisClient: jest.fn(),
}))

import connection from '../../db/connection'
import { getRedisClient } from '../../utils/redisClient'
import { healthRouter } from '../../routes/healthRoutes'

const queryMock = connection.query as unknown as jest.Mock
const getRedisClientMock = getRedisClient as unknown as jest.Mock

function createHealthApp() {
  const app = express()
  app.use('/health', healthRouter)
  return app
}

beforeEach(() => {
  jest.clearAllMocks()
})

describe('GET /health', () => {
  test('responde ok sin tocar dependencias', async () => {
    const response = await request(createHealthApp()).get('/health')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok' })
    expect(queryMock).not.toHaveBeenCalled()
    expect(getRedisClientMock).not.toHaveBeenCalled()
  })
})

describe('GET /health/ready', () => {
  test('responde 200 cuando MySQL y Redis estan listos', async () => {
    queryMock.mockResolvedValue([[], []])
    getRedisClientMock.mockReturnValue({
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
    })

    const response = await request(createHealthApp()).get('/health/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({
      status: 'ready',
      checks: { mysql: true, redis: true },
    })
  })

  test('responde 503 cuando MySQL falla', async () => {
    queryMock.mockRejectedValue(new Error('db down'))
    getRedisClientMock.mockReturnValue({
      status: 'ready',
      ping: jest.fn().mockResolvedValue('PONG'),
    })

    const response = await request(createHealthApp()).get('/health/ready')

    expect(response.status).toBe(503)
    expect(response.body.checks).toEqual({ mysql: false, redis: true })
  })

  test('responde 503 cuando Redis falla', async () => {
    queryMock.mockResolvedValue([[], []])
    getRedisClientMock.mockReturnValue({
      status: 'ready',
      ping: jest.fn().mockRejectedValue(new Error('redis down')),
    })

    const response = await request(createHealthApp()).get('/health/ready')

    expect(response.status).toBe(503)
    expect(response.body.checks).toEqual({ mysql: true, redis: false })
  })

  test('conecta un cliente Redis lazy antes del ping', async () => {
    queryMock.mockResolvedValue([[], []])
    const connect = jest.fn().mockResolvedValue(undefined)
    const ping = jest.fn().mockResolvedValue('PONG')
    getRedisClientMock.mockReturnValue({ status: 'wait', connect, ping })

    const response = await request(createHealthApp()).get('/health/ready')

    expect(connect).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })
})
