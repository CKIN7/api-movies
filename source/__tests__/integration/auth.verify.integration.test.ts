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

async function getVerificationToken(userId: string) {
    const [rows] = await db.query(
        'SELECT token FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 1',
        [userId],
    ) as any
    return rows[0]?.token as string
}

describe('POST /auth/verify (integración real con DB)', () => {
    test('token válido verifica el email y permite loguear', async () => {
        const app = createApp()

        const registerRes = await request(app)
            .post('/auth/register')
            .send({ email: 'verify@example.com', password: 'Password123!' })
        expect(registerRes.status).toBe(201)

        const token = await getVerificationToken(registerRes.body.user.id)
        expect(token).toBeDefined()

        const verifyRes = await request(app)
            .post('/auth/verify')
            .send({ token })

        expect(verifyRes.status).toBe(200)
        expect(verifyRes.body).toEqual({ message: 'Email verificado' })

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'verify@example.com', password: 'Password123!' })

        expect(loginRes.status).toBe(200)
        expect(loginRes.body.accessToken).toBeDefined()
    })

    test('token inexistente devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/verify')
            .send({ token: 'este-token-no-existe' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('token reutilizado devuelve 401 y no se puede verificar dos veces', async () => {
        const app = createApp()

        const registerRes = await request(app)
            .post('/auth/register')
            .send({ email: 'reusa@example.com', password: 'Password123!' })
        expect(registerRes.status).toBe(201)

        const token = await getVerificationToken(registerRes.body.user.id)

        const first = await request(app)
            .post('/auth/verify')
            .send({ token })
        expect(first.status).toBe(200)

        const second = await request(app)
            .post('/auth/verify')
            .send({ token })

        expect(second.status).toBe(401)
        expect(second.body.error).toBeDefined()
    })

    test('body sin token devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/verify')
            .send({})

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})