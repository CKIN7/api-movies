// Simula la caida de Redis en el cliente compartido: todo comando
// rechaza con el mismo error que produce ioredis cuando la conexion
// se cierra ("Connection is closed."). El resto del bootstrap sigue
// usando MySQL real.
jest.mock('../../utils/redisClient', () => {
    const fail = () => Promise.reject(new Error('Connection is closed.'))
    const client = {
        ttl: jest.fn(fail),
        incr: jest.fn(fail),
        evalsha: jest.fn(fail),
        script: jest.fn(fail),
        del: jest.fn(fail),
        get: jest.fn(fail),
        set: jest.fn(fail),
        quit: jest.fn().mockResolvedValue('OK'),
    }

    return {
        getRedisClient: () => client,
        connectRedis: jest.fn().mockResolvedValue(client),
        disconnectRedis: jest.fn().mockResolvedValue(undefined),
        isRedisHealthy: () => false,
        loadLuaScripts: jest.fn(fail),
        LUA_SLIDING_WINDOW: '',
        rateLimitConfig: require('../../config/rateLimitConfig').rateLimitConfig,
    }
})

import request from 'supertest'
import { createApp } from '../../api'
import { rateLimiter } from '../../middleware/rateLimiter'
import { rateLimitConfig } from '../../config/rateLimitConfig'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

let db: Connection
const originalFailOpen = rateLimitConfig.failOpen
const originalDeliveryMode = process.env.EMAIL_DELIVERY_MODE

beforeAll(async () => {
    db = await setupTestDb()
    // Sin colas reales: al encolar se dejarian jobs en la DB 15 que otras
    // suites levantan con su propio worker.
    process.env.EMAIL_DELIVERY_MODE = 'dev'
})

afterAll(async () => {
    process.env.EMAIL_DELIVERY_MODE = originalDeliveryMode
    await teardownTestDb(db)
})

beforeEach(async () => {
    await clearTestData(db)
    await seedTestData(db)
})

afterEach(() => {
    ;(rateLimitConfig as { failOpen: boolean }).failOpen = originalFailOpen
})

// El limiter real se inyecta a proposito: en tests `RATE_LIMIT_ENABLED`
// suele estar en "false" y createApp usaria el noop.
function appWithRealLimiter() {
    return createApp(undefined, undefined, rateLimiter)
}

describe('rate limiter con Redis caido', () => {
    test('fail-open: POST /auth/register responde 201 y no 500', async () => {
        const res = await request(appWithRealLimiter())
            .post('/auth/register')
            .send({ email: 'failopen@example.com', password: 'Password123!' })

        expect(res.status).toBe(201)
        expect(res.body.user).toMatchObject({ email: 'failopen@example.com' })
    })

    test('fail-closed: con RATE_LIMIT_FAIL_OPEN=false el error si se propaga', async () => {
        ;(rateLimitConfig as { failOpen: boolean }).failOpen = false

        const res = await request(appWithRealLimiter())
            .post('/auth/register')
            .send({ email: 'failclosed@example.com', password: 'Password123!' })

        expect(res.status).toBe(500)
        expect(res.body.error).toContain('Connection is closed')
    })

    test('una ruta de lectura tampoco se cae con Redis caido', async () => {
        const res = await request(appWithRealLimiter()).get('/movies?limit=1')

        expect(res.status).toBe(200)
    })
})
