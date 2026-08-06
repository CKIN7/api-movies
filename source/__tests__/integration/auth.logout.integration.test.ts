import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

let db: Connection

beforeAll(async () => {
    db = await setupTestDb()
})

afterAll(async () => {
    await teardownTestDb(db)
})

beforeEach(async () => {
    await clearTestData(db)
    await seedTestData(db)
})

async function login(app: ReturnType<typeof createApp>) {
    const res = await request(app)
        .post('/auth/login')
        .send({ email: 'admin@example.com', password: 'password123' })
    expect(res.status).toBe(200)
    expect(res.body.refreshToken).toBeDefined()
    return res.body.refreshToken as string
}

describe('POST /auth/logout (integración real con DB)', () => {
    test('logout revoca la sesión y el refresh posterior devuelve 401', async () => {
        const app = createApp()
        const refreshToken = await login(app)

        const logout = await request(app)
            .post('/auth/logout')
            .send({ refreshToken })

        expect(logout.status).toBe(200)

        const afterLogout = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken })

        expect(afterLogout.status).toBe(401)
    })

    test('logout con token inválido devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/logout')
            .send({ refreshToken: 'token-basura' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('logout con body inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/logout')
            .send({})

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})
