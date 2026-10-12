import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
import type { Connection } from 'mysql2/promise'

let db: Connection

const asUser = () => authHeader(TEST_USER_ID, 'access', 'user')
const asPremium = () => authHeader(TEST_USER_ID, 'access', 'premium')
const asAdmin = () => authHeader(TEST_USER_ID, 'access', 'admin')

const validMovie = {
    title: 'Película RBAC',
    year: 2024,
    rating: 7.5,
    duration: 120,
    plot: '...',
    poster: 'https://example.com/rbac.jpg',
    director: 'Christopher Nolan',
    genre: ['drama'],
}

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

describe('Matriz de permisos RBAC (integración real con DB)', () => {
    describe('Catálogo de películas — solo admin', () => {
        test('POST /movies sin token → 401', async () => {
            const res = await request(createApp()).post('/movies').send(validMovie)
            expect(res.status).toBe(401)
        })

        test('POST /movies con role user → 403', async () => {
            const res = await request(createApp()).post('/movies').set(asUser()).send(validMovie)
            expect(res.status).toBe(403)
        })

        test('POST /movies con role premium → 403', async () => {
            const res = await request(createApp()).post('/movies').set(asPremium()).send(validMovie)
            expect(res.status).toBe(403)
        })

        test('POST /movies con role admin → 201', async () => {
            const res = await request(createApp()).post('/movies').set(asAdmin()).send(validMovie)
            expect(res.status).toBe(201)
        })

        test('PATCH /movies/:id con role user → 403 y con admin → 200', async () => {
            const denied = await request(createApp()).patch('/movies/1').set(asUser()).send({ title: 'Nope' })
            expect(denied.status).toBe(403)

            const allowed = await request(createApp()).patch('/movies/1').set(asAdmin()).send({ title: 'Updated' })
            expect(allowed.status).toBe(200)
        })

        test('DELETE /movies/:id con role premium → 403 y con admin → 200', async () => {
            const denied = await request(createApp()).delete('/movies/1').set(asPremium())
            expect(denied.status).toBe(403)

            const allowed = await request(createApp()).delete('/movies/1').set(asAdmin())
            expect(allowed.status).toBe(200)
        })
    })

    describe('Audit-log — solo admin', () => {
        test('GET /movies/:id/audit-log sin token → 401', async () => {
            const res = await request(createApp()).get('/movies/1/audit-log')
            expect(res.status).toBe(401)
        })

        test('GET /movies/:id/audit-log con user o premium → 403', async () => {
            expect((await request(createApp()).get('/movies/1/audit-log').set(asUser())).status).toBe(403)
            expect((await request(createApp()).get('/movies/1/audit-log').set(asPremium())).status).toBe(403)
        })

        test('GET /movies/:id/audit-log con admin → 200', async () => {
            const res = await request(createApp()).get('/movies/1/audit-log').set(asAdmin())
            expect(res.status).toBe(200)
        })
    })

    describe('Export del catálogo — premium y admin', () => {
        test('GET /movies/export/csv sin token → 401', async () => {
            const res = await request(createApp()).get('/movies/export/csv')
            expect(res.status).toBe(401)
        })

        test('GET /movies/export/csv con role user → 403', async () => {
            const res = await request(createApp()).get('/movies/export/csv').set(asUser())
            expect(res.status).toBe(403)
        })

        test('GET /movies/export/csv con role premium → 200', async () => {
            const res = await request(createApp()).get('/movies/export/csv').set(asPremium())
            expect(res.status).toBe(200)
        })

        test('GET /movies/export/csv con role admin → 200', async () => {
            const res = await request(createApp()).get('/movies/export/csv').set(asAdmin())
            expect(res.status).toBe(200)
        })
    })

    describe('Métricas de rate-limit — solo admin', () => {
        test('GET /metrics/rate-limit con user o premium → 403', async () => {
            expect((await request(createApp()).get('/metrics/rate-limit').set(asUser())).status).toBe(403)
            expect((await request(createApp()).get('/metrics/rate-limit').set(asPremium())).status).toBe(403)
        })

        test('GET /metrics/rate-limit con admin → 200', async () => {
            const res = await request(createApp()).get('/metrics/rate-limit').set(asAdmin())
            expect(res.status).toBe(200)
        })

        test('DELETE /metrics/rate-limit con user → 403 y con admin → 200', async () => {
            expect((await request(createApp()).delete('/metrics/rate-limit').set(asUser())).status).toBe(403)
            expect((await request(createApp()).delete('/metrics/rate-limit').set(asAdmin())).status).toBe(200)
        })
    })

    describe('Reviews y watchlist — todos los roles autenticados', () => {
        test('POST /movies/:id/reviews con role user → 201', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(asUser())
                .send({ rating: 4.5, comment: 'Como user' })
            expect(res.status).toBe(201)
        })

        test('POST /movies/:id/reviews con role premium → 201', async () => {
            const res = await request(createApp())
                .post('/movies/2/reviews')
                .set(asPremium())
                .send({ rating: 4, comment: 'Como premium' })
            expect(res.status).toBe(201)
        })

        test('POST /users/me/watchlist con role user → 201', async () => {
            const res = await request(createApp())
                .post('/users/me/watchlist')
                .set(asUser())
                .send({ movieId: 1 })
            expect(res.status).toBe(201)
        })

        test('GET /movies sin token sigue siendo público → 200', async () => {
            const res = await request(createApp()).get('/movies')
            expect(res.status).toBe(200)
        })
    })
})
