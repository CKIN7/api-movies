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

describe('User Preferences v2 API (integración real con DB)', () => {
    test('PUT con dislikedGenres persiste y lo devuelve', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: [1], dislikedGenres: [5] })

        expect(res.status).toBe(200)
        expect(res.body.dislikedGenres).toEqual([5])

        const get = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(get.body.dislikedGenres).toEqual([5])
        expect(get.body.contentFilters).toEqual({})
    })

    test('PUT con body vacío devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({})

        expect(res.status).toBe(400)
    })

    test('PUT con favorito y dislike del mismo id devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: [1], dislikedGenres: [1] })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('favorito y dislike')
    })

    test('PUT con más de 50 elementos devuelve 400', async () => {
        const ids = Array.from({ length: 51 }, (_, i) => i + 1)
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: ids })

        expect(res.status).toBe(400)
    })

    test('PUT con dislikes duplicados deduplica', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ dislikedActors: [10, 10, 11] })

        expect(res.status).toBe(200)
        expect(res.body.dislikedActors).toEqual([10, 11])
    })

    test('PUT con contentFilters válidos persiste', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ contentFilters: { minRating: 7, maxAgeRating: 'PG-13', decades: [1990, 2000] } })

        expect(res.status).toBe(200)
        expect(res.body.contentFilters).toEqual({ minRating: 7, maxAgeRating: 'PG-13', decades: [1990, 2000] })
    })

    test('PUT con runtimeMin mayor que runtimeMax devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ contentFilters: { runtimeMin: 200, runtimeMax: 100 } })

        expect(res.status).toBe(400)
    })

    test('PUT con genre_id inexistente en dislikes devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ dislikedGenres: [99999] })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('no existen')
    })
})
