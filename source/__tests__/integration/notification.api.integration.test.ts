import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
import type { Connection } from 'mysql2/promise'

let db: Connection

const OTHER_USER_ID = '00000000-0000-4000-8000-000000000001'

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

async function insertNotification(options: {
    userId?: string
    dedupeKey: string
    payload?: Record<string, unknown>
    readAt?: string | null
    createdAt: string
}): Promise<void> {
    await db.execute(
        `INSERT INTO notifications (user_id, type, dedupe_key, payload, read_at, created_at)
         VALUES (?, 'review.published', ?, ?, ?, ?)`,
        [
            options.userId ?? TEST_USER_ID,
            options.dedupeKey,
            JSON.stringify(options.payload ?? { movieId: 27205, movieTitle: 'Inception', reviewId: options.dedupeKey }),
            options.readAt ?? null,
            options.createdAt,
        ]
    )
}

describe('Notifications API (integración real con DB)', () => {
    describe('autenticación', () => {
        test.each([
            ['get', '/users/me/notifications'],
            ['get', '/users/me/notifications/unread-count'],
            ['patch', '/users/me/notifications/read-all'],
            ['patch', '/users/me/notifications/1/read'],
        ])('%s %s sin token devuelve 401', async (method, path) => {
            const res = await (request(createApp()) as any)[method](path)
            expect(res.status).toBe(401)
        })
    })

    describe('GET /users/me/notifications', () => {
        test('devuelve la lista paginada ordenada por created_at DESC', async () => {
            await insertNotification({ dedupeKey: '1', createdAt: '2026-10-29 10:00:00' })
            await insertNotification({ dedupeKey: '2', createdAt: '2026-10-29 12:00:00', readAt: '2026-10-29 12:30:00' })

            const res = await request(createApp())
                .get('/users/me/notifications')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.total).toBe(2)
            expect(res.body.page).toBe(1)
            expect(res.body.limit).toBe(20)
            expect(res.body.notifications).toHaveLength(2)
            expect(res.body.notifications[0].payload.reviewId).toBe('2')
            expect(res.body.notifications[0].readAt).not.toBeNull()
            expect(res.body.notifications[1].readAt).toBeNull()
            expect(typeof res.body.notifications[0].id).toBe('string')
        })

        test('unread_only=true filtra y su total es el filtrado', async () => {
            await insertNotification({ dedupeKey: '1', createdAt: '2026-10-29 10:00:00' })
            await insertNotification({ dedupeKey: '2', createdAt: '2026-10-29 11:00:00' })
            await insertNotification({ dedupeKey: '3', createdAt: '2026-10-29 12:00:00', readAt: '2026-10-29 12:30:00' })

            const res = await request(createApp())
                .get('/users/me/notifications?unread_only=true')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.total).toBe(2)
            expect(res.body.notifications).toHaveLength(2)
            expect(res.body.notifications.every((n: any) => n.readAt === null)).toBe(true)
        })

        test('paginación page/limit', async () => {
            for (let i = 1; i <= 3; i++) {
                await insertNotification({ dedupeKey: String(i), createdAt: `2026-10-29 1${i}:00:00` })
            }

            const res = await request(createApp())
                .get('/users/me/notifications?page=2&limit=2')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.page).toBe(2)
            expect(res.body.limit).toBe(2)
            expect(res.body.total).toBe(3)
            expect(res.body.notifications).toHaveLength(1)
        })

        test('limit mayor a 100 devuelve 400', async () => {
            const res = await request(createApp())
                .get('/users/me/notifications?limit=500')
                .set(authHeader())

            expect(res.status).toBe(400)
        })

        test('aísla las notificaciones por usuario', async () => {
            await db.execute(
                `INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, 'other@example.com', 'x', 'user', 1)`,
                [OTHER_USER_ID]
            )
            await insertNotification({ userId: OTHER_USER_ID, dedupeKey: 'other', createdAt: '2026-10-29 10:00:00' })

            const res = await request(createApp())
                .get('/users/me/notifications')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.total).toBe(0)
            expect(res.body.notifications).toEqual([])
        })
    })

    describe('GET /users/me/notifications/unread-count', () => {
        test('devuelve el contador de no leídas', async () => {
            await insertNotification({ dedupeKey: '1', createdAt: '2026-10-29 10:00:00' })
            await insertNotification({ dedupeKey: '2', createdAt: '2026-10-29 11:00:00' })
            await insertNotification({ dedupeKey: '3', createdAt: '2026-10-29 12:00:00', readAt: '2026-10-29 12:30:00' })

            const res = await request(createApp())
                .get('/users/me/notifications/unread-count')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ unread: 2 })
        })
    })

    describe('PATCH /users/me/notifications/:id/read', () => {
        test('marca leída y es idempotente', async () => {
            await insertNotification({ dedupeKey: '1', createdAt: '2026-10-29 10:00:00' })
            const [rows]: any = await db.query('SELECT id FROM notifications LIMIT 1')
            const id = String(rows[0].id)

            const first = await request(createApp())
                .patch(`/users/me/notifications/${id}/read`)
                .set(authHeader())

            expect(first.status).toBe(200)
            expect(first.body.notification.readAt).not.toBeNull()

            const second = await request(createApp())
                .patch(`/users/me/notifications/${id}/read`)
                .set(authHeader())

            expect(second.status).toBe(200)
            expect(second.body.notification.readAt).toBe(first.body.notification.readAt)
        })

        test('id inexistente devuelve 404', async () => {
            const res = await request(createApp())
                .patch('/users/me/notifications/999999/read')
                .set(authHeader())

            expect(res.status).toBe(404)
            expect(res.body.error).toBe('Notificación no encontrada')
        })

        test('id no numérico devuelve 400', async () => {
            const res = await request(createApp())
                .patch('/users/me/notifications/abc/read')
                .set(authHeader())

            expect(res.status).toBe(400)
        })

        test('notificación de otro usuario devuelve 404', async () => {
            await db.execute(
                `INSERT INTO users (id, email, password_hash, role, email_verified) VALUES (?, 'other@example.com', 'x', 'user', 1)`,
                [OTHER_USER_ID]
            )
            await insertNotification({ userId: OTHER_USER_ID, dedupeKey: 'other', createdAt: '2026-10-29 10:00:00' })
            const [rows]: any = await db.query('SELECT id FROM notifications LIMIT 1')
            const id = String(rows[0].id)

            const res = await request(createApp())
                .patch(`/users/me/notifications/${id}/read`)
                .set(authHeader())

            expect(res.status).toBe(404)
        })
    })

    describe('PATCH /users/me/notifications/read-all', () => {
        test('marca todas como leídas y devuelve las actualizadas', async () => {
            await insertNotification({ dedupeKey: '1', createdAt: '2026-10-29 10:00:00' })
            await insertNotification({ dedupeKey: '2', createdAt: '2026-10-29 11:00:00' })
            await insertNotification({ dedupeKey: '3', createdAt: '2026-10-29 12:00:00', readAt: '2026-10-29 12:30:00' })

            const res = await request(createApp())
                .patch('/users/me/notifications/read-all')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body).toEqual({ updated: 2 })

            const count = await request(createApp())
                .get('/users/me/notifications/unread-count')
                .set(authHeader())
            expect(count.body).toEqual({ unread: 0 })
        })
    })
})
