import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
import { invalidateUserRecommendations } from '../../utils/cache'
import type { Connection } from 'mysql2/promise'

let db: Connection

beforeAll(async () => {
    db = await setupTestDb()
})

afterAll(async () => {
    await teardownTestDb(db)
})

beforeEach(async () => {
    await invalidateUserRecommendations(TEST_USER_ID)
    await clearTestData(db)
    await seedTestData(db)
})

function sendFeedback(movieId: number, action: string) {
    return request(createApp())
        .post('/users/me/recommendations/feedback')
        .set(authHeader())
        .send({ movieId, action })
}

async function reviewMovie(movieId: number, rating = 5) {
    return request(createApp())
        .post(`/movies/${movieId}/reviews`)
        .set(authHeader())
        .send({ rating, comment: 'Buenísima' })
}

describe('Recommendation feedback API (integración real con DB)', () => {
    test('sin token devuelve 401', async () => {
        const res = await request(createApp())
            .post('/users/me/recommendations/feedback')
            .send({ movieId: 1, action: 'like' })

        expect(res.status).toBe(401)
    })

    test('valida movieId y action', async () => {
        const missingAction = await request(createApp())
            .post('/users/me/recommendations/feedback')
            .set(authHeader())
            .send({ movieId: 1 })

        const invalidAction = await sendFeedback(1, 'super_like')

        expect(missingAction.status).toBe(400)
        expect(invalidAction.status).toBe(400)
    })

    test('película inexistente devuelve 404', async () => {
        const res = await sendFeedback(999999, 'like')

        expect(res.status).toBe(404)
    })

    test('like es idempotente y suma afinidad por género', async () => {
        const first = await sendFeedback(1, 'like')
        const second = await sendFeedback(1, 'like')

        expect(first.status).toBe(201)
        expect(first.body).toEqual({ movieId: 1, action: 'like', applied: true })
        expect(second.status).toBe(200)
        expect(second.body).toEqual({ movieId: 1, action: 'like', applied: false })

        const [genres] = await db.query('SELECT genre_id FROM movie_genres WHERE movie_id = 1') as any
        const prefs = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(genres.length).toBeGreaterThan(0)
        expect(prefs.status).toBe(200)
        for (const genre of genres) {
            expect(prefs.body.genreAffinity[String(genre.genre_id)].score).toBe(1)
        }

        const [rows] = await db.query(
            'SELECT COUNT(*) AS total FROM recommendation_feedback WHERE user_id = ? AND movie_id = ? AND action = ?',
            [TEST_USER_ID, 1, 'like']
        ) as any
        expect(rows[0].total).toBe(1)
    })

    test('vista no modifica afinidad', async () => {
        const res = await sendFeedback(1, 'view')

        expect(res.status).toBe(201)
        expect(res.body.applied).toBe(true)

        const prefs = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(prefs.body.genreAffinity).toEqual({})
    })

    test('not_interested excluye la película de las recomendaciones', async () => {
        await reviewMovie(1)

        const before = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=50')
            .set(authHeader())

        expect(before.status).toBe(200)
        expect(before.body.length).toBeGreaterThan(0)

        const target = before.body[0].movie.id
        const feedback = await sendFeedback(target, 'not_interested')
        expect(feedback.status).toBe(201)

        const after = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=50')
            .set(authHeader())

        expect(after.status).toBe(200)
        expect(after.body.map((item: any) => item.movie.id)).not.toContain(target)
    })

    test('hide no excluye la película', async () => {
        await reviewMovie(1)

        const before = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=50')
            .set(authHeader())
        const target = before.body[0].movie.id

        await sendFeedback(target, 'hide')

        const after = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=50')
            .set(authHeader())

        expect(after.body.map((item: any) => item.movie.id)).toContain(target)
    })
})
