import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
import { createNotificationWorkers, type NotificationWorkers } from '../../workers/notificationWorker'
import {
    emailTransactionalQueue,
    notificationFanoutQueue,
    notificationInAppQueue,
} from '../../queues/queueFactory'
import type { Connection } from 'mysql2/promise'

let db: Connection
let workers: NotificationWorkers

beforeAll(async () => {
    db = await setupTestDb()

    workers = createNotificationWorkers()
    await Promise.all([
        workers.fanout.getWorker().waitUntilReady(),
        workers.inApp.getWorker().waitUntilReady(),
    ])
})

afterAll(async () => {
    await workers.fanout.close()
    await workers.inApp.close()
    await teardownTestDb(db)
})

beforeEach(async () => {
    await clearTestData(db)
    await seedTestData(db)

    // `clearAll` reinicia el AUTO_INCREMENT de `reviews`, así que cada test
    // vuelve a generar el review id 1. El fan-out y el email usan jobIds
    // determinísticos (`review-published-<id>`); si el job del test anterior
    // sigue en Redis, BullMQ ignora el nuevo. Se vacían las colas antes de
    // cada test para que el jobId vuelva a estar libre.
    await notificationFanoutQueue.obliterate({ force: true })
    await notificationInAppQueue.obliterate({ force: true })
    await emailTransactionalQueue.obliterate({ force: true })
})

async function waitFor<T>(
    fn: () => Promise<T | null | undefined>,
    label: string,
    timeoutMs = 8000,
): Promise<T> {
    const deadline = Date.now() + timeoutMs
    while (Date.now() < deadline) {
        const value = await fn()
        if (value) return value
        await new Promise((resolve) => setTimeout(resolve, 50))
    }
    throw new Error(`Timeout esperando ${label}`)
}

async function findNotification(userId: string): Promise<any> {
    const [rows]: any = await db.query(
        'SELECT * FROM notifications WHERE user_id = ? LIMIT 1',
        [userId],
    )
    return rows[0] ?? null
}

function parsePayload(payload: unknown): Record<string, any> {
    return typeof payload === 'string' ? JSON.parse(payload) : (payload as Record<string, any>)
}

describe('Review -> notificación in-app (integración real con DB y Redis)', () => {
    test('crear review crea la notificación y encola el email', async () => {
        const res = await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 4.5, comment: 'Excelente' })

        expect(res.status).toBe(201)

        const row = await waitFor(() => findNotification(TEST_USER_ID), 'la notificación in-app')
        expect(row.type).toBe('review.published')
        expect(row.read_at).toBeNull()

        const payload = parsePayload(row.payload)
        expect(payload).toMatchObject({
            movieId: 1,
            movieTitle: 'Inception',
            reviewId: String(res.body.data.id),
        })

        // notify_email sin fila en user_settings => default true.
        const emailJob = await waitFor(
            () => emailTransactionalQueue.getJob(`review-published-${payload.reviewId}`),
            'el job de email',
        )
        expect(emailJob.data).toMatchObject({
            template: 'review-published',
            to: 'admin@example.com',
        })
    }, 20000)

    test('con notify_email=false crea la notificación pero no encola email', async () => {
        await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ notifyEmail: false })

        const res = await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 4, comment: 'Buena' })

        expect(res.status).toBe(201)

        const row = await waitFor(() => findNotification(TEST_USER_ID), 'la notificación in-app')
        const payload = parsePayload(row.payload)

        const emailJob = await emailTransactionalQueue.getJob(`review-published-${payload.reviewId}`)
        expect(emailJob).toBeUndefined()
    }, 20000)

    test('actualizar una review existente no crea otra notificación', async () => {
        const movieId = 2

        const first = await request(createApp())
            .post(`/movies/${movieId}/reviews`)
            .set(authHeader())
            .send({ rating: 4, comment: 'Primera' })
        expect(first.status).toBe(201)

        await waitFor(() => findNotification(TEST_USER_ID), 'la primera notificación')

        const second = await request(createApp())
            .post(`/movies/${movieId}/reviews`)
            .set(authHeader())
            .send({ rating: 5, comment: 'Actualizada' })
        expect(second.status).toBe(200)

        // Deja que el fan-out (si se hubiera encolado) tenga tiempo de correr.
        await new Promise((resolve) => setTimeout(resolve, 500))

        const [rows]: any = await db.query(
            'SELECT * FROM notifications WHERE user_id = ?',
            [TEST_USER_ID],
        )
        expect(rows).toHaveLength(1)
    }, 20000)
})