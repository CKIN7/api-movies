import request from 'supertest'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

// UUID v4 válido (Zod z.uuid() exige versión 1-8 y variante 89ab)
const TARGET_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const CREDENTIALS = { email: 'target@example.com', password: 'password123' }

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
    const hash = await bcrypt.hash(CREDENTIALS.password, 10)
    await db.query(
        `INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, ?, ?, 'user', 1)`,
        [TARGET_ID, CREDENTIALS.email, hash]
    )
})

function decode(token: string): { sub?: string; type?: string; role?: string } {
    return jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string; type?: string; role?: string }
}

describe('Claims de rol en el JWT (integración real con DB)', () => {
    test('login emite access token con sub, type y claim role', async () => {
        const res = await request(createApp())
            .post('/auth/login')
            .send(CREDENTIALS)

        expect(res.status).toBe(200)
        expect(res.body.user.role).toBe('user')
        const payload = decode(res.body.accessToken)
        expect(payload.sub).toBe(TARGET_ID)
        expect(payload.type).toBe('access')
        expect(payload.role).toBe('user')
    })

    test('el refresh token NO lleva claim role (solo el access token)', async () => {
        const res = await request(createApp())
            .post('/auth/login')
            .send(CREDENTIALS)

        expect(res.status).toBe(200)
        const refreshPayload = jwt.verify(
            res.body.refreshToken,
            process.env.JWT_REFRESH_SECRET!
        ) as { role?: string }
        expect(refreshPayload.role).toBeUndefined()
    })

    test('refresh relee el rol vigente de la BD en el nuevo access token', async () => {
        const app = createApp()
        const login = await request(app).post('/auth/login').send(CREDENTIALS)
        expect(decode(login.body.accessToken).role).toBe('user')

        // El rol cambia en BD (lo haría PATCH /users/:id/role de un admin)
        await db.query(`UPDATE users SET role = 'premium' WHERE id = ?`, [TARGET_ID])

        const refreshed = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: login.body.refreshToken })

        expect(refreshed.status).toBe(200)
        expect(decode(refreshed.body.accessToken).role).toBe('premium')
        expect(refreshed.body.user.role).toBe('premium')
    })
})
