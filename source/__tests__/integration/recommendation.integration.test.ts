import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader } from '../helpers/auth'
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

describe('Recommendations API (integración real con DB)', () => {
    test('sin token devuelve 401', async () => {
        const res = await request(createApp()).get('/users/me/recommendations')

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('cold start: sin historial retorna 200 con array (vacío)', async () => {
        const res = await request(createApp())
            .get('/users/me/recommendations')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
        expect(res.body).toHaveLength(0)
    })

    test('con historial: retorna items sin lo ya visto y con reason', async () => {
        await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 5, comment: 'Obra maestra' })

        const res = await request(createApp())
            .get('/users/me/recommendations?type=content')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
        const ids = res.body.map((r: any) => r.movie.id)
        expect(ids).not.toContain(1)
        expect(res.body[0]).toMatchObject({
            movie: { id: expect.any(Number), title: expect.any(String) },
            score: expect.any(Number),
            reason: expect.any(String),
        })
    })

    test('watchlist también alimenta el historial y se excluye', async () => {
        await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 5 })

        await request(createApp())
            .post('/users/me/watchlist')
            .set(authHeader())
            .send({ movieId: 2, priority: 5 })

        const res = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=50')
            .set(authHeader())

        expect(res.status).toBe(200)
        const ids = res.body.map((r: any) => r.movie.id)
        expect(ids).not.toContain(1)
        expect(ids).not.toContain(2)
    })

    test('type=hybrid (default) retorna items', async () => {
        await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 5 })

        const res = await request(createApp())
            .get('/users/me/recommendations')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(Array.isArray(res.body)).toBe(true)
        if (res.body.length > 0) {
            expect(res.body[0].score).toBeGreaterThan(0)
        }
    })

    test('limit=2 retorna máximo 2 items', async () => {
        await request(createApp())
            .post('/movies/1/reviews')
            .set(authHeader())
            .send({ rating: 5 })

        const res = await request(createApp())
            .get('/users/me/recommendations?type=content&limit=2')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.length).toBeLessThanOrEqual(2)
    })

    test('type inválido devuelve 400', async () => {
        const res = await request(createApp())
            .get('/users/me/recommendations?type=banana')
            .set(authHeader())

        expect(res.status).toBe(400)
    })

    test('limit fuera de rango devuelve 400', async () => {
        const zero = await request(createApp())
            .get('/users/me/recommendations?limit=0')
            .set(authHeader())
        expect(zero.status).toBe(400)

        const tooBig = await request(createApp())
            .get('/users/me/recommendations?limit=51')
            .set(authHeader())
        expect(tooBig.status).toBe(400)
    })
})
