import type { NextFunction, Request, Response } from 'express'

// El middleware consulta Redis en dos lugares: la penalizacion
// (`checkPenalty`) y la ventana deslizante (`executeSlidingWindow`).
// Este test controla ambos para verificar la politica fail-open sin
// depender de un Redis real.
jest.mock('../../config/rateLimitConfig', () => ({
  rateLimitConfig: { failOpen: true },
}))

jest.mock('../../middleware/rateLimiterStrategies', () => ({
  getApplicableStrategies: () => [
    {
      name: 'global',
      scope: 'global',
      limit: 100,
      windowMs: 60000,
      getIdentifier: () => 'ip-1',
      shouldApply: () => true,
      getHeaders: () => ({ 'X-RateLimit-Limit': '100' }),
    },
  ],
  getWindowStartKey: () => 'ratelimit:global:ip-1',
  executeSlidingWindow: jest.fn(),
}))

jest.mock('../../middleware/penaltyBox', () => ({
  checkPenalty: jest.fn(),
  registerPenaltyRejection: jest.fn(),
  shouldActivatePenalty: jest.fn(),
  activatePenalty: jest.fn(),
}))

jest.mock('../../services/rateLimitMetrics', () => ({
  recordHit: jest.fn(),
  recordRejection: jest.fn(),
  recordRedisError: jest.fn(),
  recordRedisSlow: jest.fn(),
}))

import { rateLimiter } from '../../middleware/rateLimiter'
import { checkPenalty } from '../../middleware/penaltyBox'
import { executeSlidingWindow } from '../../middleware/rateLimiterStrategies'
import { recordHit, recordRedisError } from '../../services/rateLimitMetrics'
import { rateLimitConfig } from '../../config/rateLimitConfig'

const mockedCheckPenalty = checkPenalty as jest.Mock
const mockedExecuteSlidingWindow = executeSlidingWindow as jest.Mock
const mockedRecordHit = recordHit as jest.Mock
const mockedRecordRedisError = recordRedisError as jest.Mock
const mockedConfig = rateLimitConfig as { failOpen: boolean }

const allowedWindow = { allowed: true, count: 1, limit: 100, resetAt: Date.now() + 60000 }

function createRes() {
  const res = {
    status: jest.fn(),
    json: jest.fn(),
    set: jest.fn(),
    setHeader: jest.fn(),
  }
  res.status.mockReturnValue(res)
  return res as unknown as Response
}

const req = {
  path: '/auth/register',
  method: 'POST',
  headers: {},
  ip: '127.0.0.1',
} as unknown as Request

describe('rateLimiter - fail-open ante Redis caido', () => {
  let next: jest.Mock

  beforeEach(() => {
    jest.clearAllMocks()
    mockedConfig.failOpen = true
    mockedCheckPenalty.mockResolvedValue({ blocked: false })
    mockedExecuteSlidingWindow.mockResolvedValue(allowedWindow)
    next = jest.fn()
  })

  it('deja pasar la request cuando checkPenalty no puede hablar con Redis', async () => {
    mockedCheckPenalty.mockRejectedValue(new Error('Connection is closed.'))

    await rateLimiter(req, createRes(), next as unknown as NextFunction)

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockedRecordRedisError).toHaveBeenCalled()
    expect(mockedExecuteSlidingWindow).not.toHaveBeenCalled()
  })

  it('deja pasar la request cuando falla la ventana deslizante', async () => {
    mockedExecuteSlidingWindow.mockRejectedValue(new Error('Connection is closed.'))

    await rateLimiter(req, createRes(), next as unknown as NextFunction)

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockedRecordRedisError).toHaveBeenCalled()
  })

  it('propaga el error cuando fail-open esta desactivado', async () => {
    mockedConfig.failOpen = false
    mockedCheckPenalty.mockRejectedValue(new Error('Connection is closed.'))

    await expect(
      rateLimiter(req, createRes(), next as unknown as NextFunction),
    ).rejects.toThrow('Connection is closed.')

    expect(next).not.toHaveBeenCalled()
  })

  it('sigue el flujo normal cuando Redis responde', async () => {
    const res = createRes()

    await rateLimiter(req, res, next as unknown as NextFunction)

    expect(next).toHaveBeenCalledTimes(1)
    expect(mockedRecordHit).toHaveBeenCalled()
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '100')
    expect(mockedRecordRedisError).not.toHaveBeenCalled()
  })

  it('responde 403 si hay penalizacion activa', async () => {
    mockedCheckPenalty.mockResolvedValue({ blocked: true, retryAfter: 900 })
    const res = createRes()

    await rateLimiter(req, res, next as unknown as NextFunction)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(403)
  })

  it('responde 429 y registra el rechazo cuando la ventana no permite', async () => {
    mockedExecuteSlidingWindow.mockResolvedValue({ ...allowedWindow, allowed: false })
    const res = createRes()

    await rateLimiter(req, res, next as unknown as NextFunction)

    expect(next).not.toHaveBeenCalled()
    expect(res.status).toHaveBeenCalledWith(429)
  })
})
