import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

const ADMIN_ID = 'cfd74902-7d20-4653-bdf6-759bb4947956'
const GENERIC_MESSAGE = 'Si el email está registrado y verificado, recibirás un enlace para restablecer tu contraseña'

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

async function getActiveResetTokens(userId: string) {
    const [rows] = await db.query(
        `SELECT token FROM email_verifications
         WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW()`,
        [userId],
    ) as any
    return rows
}

describe('POST /auth/forgot (integración real con DB)', () => {
    test('email verificado genera un reset token de un solo uso y responde genérico', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/forgot')
            .send({ email: 'admin@example.com' })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe(GENERIC_MESSAGE)

        const tokens = await getActiveResetTokens(ADMIN_ID)
        expect(tokens.length).toBe(1)
    })

    test('Guards A+B: llamadas seguidas no reemplazan el token ni crean más filas', async () => {
        const app = createApp()

        await request(app).post('/auth/forgot').send({ email: 'admin@example.com' })
        const first = await getActiveResetTokens(ADMIN_ID)
        expect(first.length).toBe(1)

        const res = await request(app)
            .post('/auth/forgot')
            .send({ email: 'admin@example.com' })

        expect(res.status).toBe(200)
        const second = await getActiveResetTokens(ADMIN_ID)
        expect(second.length).toBe(1)
        expect(second[0].token).toBe(first[0].token)
    })

    test('Guard A: aunque la ventana del cooldown haya pasado, el token vigente no se reemplaza', async () => {
        const app = createApp()

        await request(app).post('/auth/forgot').send({ email: 'admin@example.com' })
        const first = await getActiveResetTokens(ADMIN_ID)
        expect(first.length).toBe(1)

        // Simula que pasó la ventana de B moviendo created_at al pasado
        await db.query(
            'UPDATE email_verifications SET created_at = DATE_SUB(NOW(), INTERVAL 1 HOUR) WHERE user_id = ?',
            [ADMIN_ID],
        )

        const res = await request(app)
            .post('/auth/forgot')
            .send({ email: 'admin@example.com' })

        expect(res.status).toBe(200)
        const after = await getActiveResetTokens(ADMIN_ID)
        expect(after.length).toBe(1)
        expect(after[0].token).toBe(first[0].token)
    })

    test('email no registrado responde genérico y no crea filas', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/forgot')
            .send({ email: 'nadie@example.com' })

        expect(res.status).toBe(200)
        expect(res.body.message).toBe(GENERIC_MESSAGE)

        const [rows] = await db.query('SELECT COUNT(*) as c FROM email_verifications') as any
        expect(rows[0].c).toBe(0)
    })

    test('body inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/forgot')
            .send({ email: 'no-es-un-email' })

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })
})