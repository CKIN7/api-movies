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

async function getVerificationTokens(userId: string): Promise<{ token: string; used_at: string | null }[]> {
    const [rows] = await db.query(
        'SELECT token, used_at FROM email_verifications WHERE user_id = ? ORDER BY created_at DESC',
        [userId],
    ) as any
    return rows
}

async function getActiveTokens(userId: string): Promise<string[]> {
    const [rows] = await db.query(
        'SELECT token FROM email_verifications WHERE user_id = ? AND used_at IS NULL',
        [userId],
    ) as any
    return rows.map((r: any) => r.token)
}

describe('POST /auth/resend (integración real con DB)', () => {
    test('flujo completo: register → 403 → resend → verify con token nuevo → login 200', async () => {
        const app = createApp()

        const registerRes = await request(app)
            .post('/auth/register')
            .send({ email: 'resend@example.com', password: 'Password123!' })
        expect(registerRes.status).toBe(201)

        const oldToken = (await getActiveTokens(registerRes.body.id))[0]

        const loginBefore = await request(app)
            .post('/auth/login')
            .send({ email: 'resend@example.com', password: 'Password123!' })
        expect(loginBefore.status).toBe(403)

        const resendRes = await request(app)
            .post('/auth/resend')
            .send({ email: 'resend@example.com' })

        expect(resendRes.status).toBe(200)
        expect(resendRes.body.message).toBeDefined()

        const activeTokens = await getActiveTokens(registerRes.body.id)
        expect(activeTokens).toHaveLength(1)
        const newToken = activeTokens[0]

        const staleVerify = await request(app)
            .post('/auth/verify')
            .send({ token: oldToken })
        expect(staleVerify.status).toBe(401)

        const verifyRes = await request(app)
            .post('/auth/verify')
            .send({ token: newToken })
        expect(verifyRes.status).toBe(200)

        const loginAfter = await request(app)
            .post('/auth/login')
            .send({ email: 'resend@example.com', password: 'Password123!' })

        expect(loginAfter.status).toBe(200)
        expect(loginAfter.body.accessToken).toBeDefined()
        expect(loginAfter.body.refreshToken).toBeDefined()
    })

    test('email inexistente devuelve 200 con mensaje genérico (anti-enumeración)', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/resend')
            .send({ email: 'nadie@example.com' })

        expect(res.status).toBe(200)
        expect(res.body.message).toBeDefined()
    })

    test('email ya verificado devuelve 200 genérico y no crea tokens nuevos', async () => {
        const app = createApp()

        const registerRes = await request(app)
            .post('/auth/register')
            .send({ email: 'hecho@example.com', password: 'Password123!' })
        expect(registerRes.status).toBe(201)

        const token = (await getActiveTokens(registerRes.body.id))[0]

        const verifyRes = await request(app)
            .post('/auth/verify')
            .send({ token })
        expect(verifyRes.status).toBe(200)

        const resendRes = await request(app)
            .post('/auth/resend')
            .send({ email: 'hecho@example.com' })

        expect(resendRes.status).toBe(200)
        expect(resendRes.body.message).toBeDefined()

        const tokens = await getVerificationTokens(registerRes.body.id)
        expect(tokens).toHaveLength(1)
    })

    test('body con email inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/resend')
            .send({ email: 'no-es-un-email' })

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})