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

describe('POST /auth/refresh (integración real con DB)', () => {
    test('refresh válido rota el token y devuelve par nuevo con user', async () => {
        const app = createApp()
        const oldRefresh = await login(app)

        const res = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: oldRefresh })

        expect(res.status).toBe(200)
        expect(res.body.accessToken).toBeDefined()
        expect(res.body.refreshToken).toBeDefined()
        expect(res.body.refreshToken).not.toBe(oldRefresh)
        expect(res.body.user).toMatchObject({
            id: 'cfd74902-7d20-4653-bdf6-759bb4947956',
            email: 'admin@example.com',
            role: 'admin',
        })
        expect(res.body.user.passwordHash).toBeUndefined()
    })

    test('reusar un refresh ya consumido devuelve 401 y revoca todas las sesiones', async () => {
        const app = createApp()
        const oldRefresh = await login(app)

        const first = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: oldRefresh })
        expect(first.status).toBe(200)
        const newRefresh = first.body.refreshToken as string

        const reused = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: oldRefresh })
        expect(reused.status).toBe(401)

        const afterReuse = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: newRefresh })
        expect(afterReuse.status).toBe(401)
    })

    test('refresh con token basura devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: 'no-es-un-token-valido' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('refresh con body inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/refresh')
            .send({})

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})
