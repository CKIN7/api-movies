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

describe('POST /auth/login (integración real con DB)', () => {
    test('login exitoso devuelve accessToken, refreshToken y user sin passwordHash', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@example.com', password: 'password123' })

        expect(res.status).toBe(200)
        expect(res.body.accessToken).toBeDefined()
        expect(res.body.refreshToken).toBeDefined()
        expect(res.body.user).toMatchObject({
            id: 'cfd74902-7d20-4653-bdf6-759bb4947956',
            email: 'admin@example.com',
            role: 'admin',
        })
        expect(res.body.user.passwordHash).toBeUndefined()
    })

    test('login con email inexistente devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'nadie@example.com', password: 'password123' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('login con password incorrecta devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@example.com', password: 'passwordIncorrecta' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('login con body inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/login')
            .send({ email: 'no-es-un-email', password: '' })

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})
