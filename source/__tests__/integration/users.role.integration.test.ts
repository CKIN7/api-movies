import request from 'supertest'
import { randomUUID } from 'crypto'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
import type { Connection } from 'mysql2/promise'

const TARGET_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee'
const MISSING_ID = '99999999-9999-4999-8999-999999999999'

let db: Connection

const asUser = () => authHeader(TEST_USER_ID, 'access', 'user')
const asPremium = () => authHeader(TEST_USER_ID, 'access', 'premium')
const asAdmin = () => authHeader(TEST_USER_ID, 'access', 'admin')

beforeAll(async () => {
    db = await setupTestDb()
})

afterAll(async () => {
    await teardownTestDb(db)
})

beforeEach(async () => {
    await clearTestData(db)
    await seedTestData(db)
    await db.query(
        `INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, ?, 'hash', 'user', 1)`,
        [TARGET_ID, 'target@example.com']
    )
})

async function insertRefreshToken(userId: string): Promise<void> {
    const id = randomUUID()
    await db.query(
        `INSERT INTO refresh_tokens(id, user_id, token, expires_at) VALUES (?, ?, ?, ?)`,
        [id, userId, `token-${id}`, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)]
    )
}

async function getRole(userId: string): Promise<string> {
    const [rows] = await db.query(`SELECT role FROM users WHERE id = ?`, [userId])
    return (rows as any[])[0].role
}

async function countActiveTokens(userId: string): Promise<number> {
    const [rows] = await db.query(
        `SELECT COUNT(*) AS total FROM refresh_tokens WHERE user_id = ? AND revoked_at IS NULL`, [userId])
    return Number((rows as any[])[0].total)
}

describe('PATCH /users/:id/role (integración real con DB)', () => {
    test('sin token → 401', async () => {
        const res = await request(createApp()).patch(`/users/${TARGET_ID}/role`).send({ role: 'premium' })
        expect(res.status).toBe(401)
    })

    test('con role user → 403', async () => {
        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asUser()).send({ role: 'premium' })
        expect(res.status).toBe(403)
    })

    test('con role premium → 403', async () => {
        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asPremium()).send({ role: 'premium' })
        expect(res.status).toBe(403)
    })

    test('admin promueve a premium y la BD queda actualizada', async () => {
        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({ role: 'premium' })

        expect(res.status).toBe(200)
        expect(res.body.user).toMatchObject({ id: TARGET_ID, email: 'target@example.com', role: 'premium' })
        expect(await getRole(TARGET_ID)).toBe('premium')
    })

    test('promoción NO revoca las sesiones activas del usuario', async () => {
        await insertRefreshToken(TARGET_ID)

        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({ role: 'premium' })

        expect(res.status).toBe(200)
        expect(await countActiveTokens(TARGET_ID)).toBe(1)
    })

    test('degradación SÍ revoca las sesiones activas del usuario', async () => {
        await db.query(`UPDATE users SET role = 'premium' WHERE id = ?`, [TARGET_ID])
        await insertRefreshToken(TARGET_ID)

        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({ role: 'user' })

        expect(res.status).toBe(200)
        expect(await getRole(TARGET_ID)).toBe('user')
        expect(await countActiveTokens(TARGET_ID)).toBe(0)
    })

    test('cambio al mismo rol es idempotente (no revoca sesiones)', async () => {
        await insertRefreshToken(TARGET_ID)

        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({ role: 'user' })

        expect(res.status).toBe(200)
        expect(await getRole(TARGET_ID)).toBe('user')
        expect(await countActiveTokens(TARGET_ID)).toBe(1)
    })

    test('rol desconocido en el body → 400', async () => {
        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({ role: 'root' })
        expect(res.status).toBe(400)
        expect(await getRole(TARGET_ID)).toBe('user')
    })

    test('body vacío → 400', async () => {
        const res = await request(createApp())
            .patch(`/users/${TARGET_ID}/role`).set(asAdmin()).send({})
        expect(res.status).toBe(400)
    })

    test('id que no es UUID → 400', async () => {
        const res = await request(createApp())
            .patch('/users/no-es-uuid/role').set(asAdmin()).send({ role: 'premium' })
        expect(res.status).toBe(400)
    })

    test('id UUID inexistente → 404', async () => {
        const res = await request(createApp())
            .patch(`/users/${MISSING_ID}/role`).set(asAdmin()).send({ role: 'premium' })
        expect(res.status).toBe(404)
    })

    test('admin cambiando su propio rol → 400 y la BD no cambia', async () => {
        const res = await request(createApp())
            .patch(`/users/${TEST_USER_ID}/role`).set(asAdmin()).send({ role: 'user' })

        expect(res.status).toBe(400)
        expect(await getRole(TEST_USER_ID)).toBe('admin')
    })
})
