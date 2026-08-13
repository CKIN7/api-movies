import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

const ADMIN_ID = 'cfd74902-7d20-4653-bdf6-759bb4947956'

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

async function createResetToken(app: any): Promise<string> {
    await request(app).post('/auth/forgot').send({ email: 'admin@example.com' })
    const [rows] = await db.query(
        `SELECT token FROM email_verifications
         WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
        [ADMIN_ID],
    ) as any
    expect(rows.length).toBe(1)
    return rows[0].token
}

describe('POST /auth/reset (integración real con DB)', () => {
    test('reset exitoso cambia el password, marca el token usado y fuerza re-login', async () => {
        const app = createApp()
        const token = await createResetToken(app)

        const res = await request(app)
            .post('/auth/reset')
            .send({ token, newPassword: 'NuevaPass123!' })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({ message: 'Contraseña actualizada' })

        const oldLogin = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@example.com', password: 'password123' })
        expect(oldLogin.status).toBe(401)

        const newLogin = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@example.com', password: 'NuevaPass123!' })
        expect(newLogin.status).toBe(200)

        const [rows] = await db.query(
            'SELECT used_at FROM email_verifications WHERE token = ? LIMIT 1',
            [token],
        ) as any
        expect(rows[0].used_at).not.toBeNull()
    })

    test('las sesiones activas previas quedan invalidadas tras el reset', async () => {
        const app = createApp()

        const login = await request(app)
            .post('/auth/login')
            .send({ email: 'admin@example.com', password: 'password123' })
        expect(login.status).toBe(200)
        const oldRefreshToken = login.body.refreshToken

        const token = await createResetToken(app)
        const reset = await request(app)
            .post('/auth/reset')
            .send({ token, newPassword: 'NuevaPass123!' })
        expect(reset.status).toBe(200)

        const refresh = await request(app)
            .post('/auth/refresh')
            .send({ refreshToken: oldRefreshToken })

        expect(refresh.status).toBe(401)
    })

    test('token reutilizado devuelve 401 y no cambia la contraseña dos veces', async () => {
        const app = createApp()
        const token = await createResetToken(app)

        const first = await request(app)
            .post('/auth/reset')
            .send({ token, newPassword: 'NuevaPass123!' })
        expect(first.status).toBe(200)

        const second = await request(app)
            .post('/auth/reset')
            .send({ token, newPassword: 'OtraPass123!' })

        expect(second.status).toBe(401)
        expect(second.body.error).toBeDefined()
    })

    test('token inexistente devuelve 401', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/reset')
            .send({ token: 'este-token-no-existe', newPassword: 'NuevaPass123!' })

        expect(res.status).toBe(401)
    })

    test('token expirado devuelve 401', async () => {
        const app = createApp()
        const token = await createResetToken(app)

        await db.query(
            'UPDATE email_verifications SET expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE) WHERE token = ?',
            [token],
        )

        const res = await request(app)
            .post('/auth/reset')
            .send({ token, newPassword: 'NuevaPass123!' })

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('newPassword que no cumple las reglas devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/reset')
            .send({ token: 'cualquier-cosa', newPassword: 'corta' })

        expect(res.status).toBe(400)
    })
})