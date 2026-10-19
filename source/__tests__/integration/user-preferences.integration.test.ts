import request from 'supertest'
import { createApp } from '../../api'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { authHeader, TEST_USER_ID } from '../helpers/auth'
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

describe('User Preferences API (integración real con DB)', () => {
    test('GET /users/me/preferences sin token devuelve 401', async () => {
        const res = await request(createApp())
            .get('/users/me/preferences')

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('GET /users/me/preferences con token válido devuelve preferencias vacías', async () => {
        const res = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.favoriteGenres).toEqual([])
        expect(res.body.favoriteDirectors).toEqual([])
        expect(res.body.favoriteActors).toEqual([])
        expect(res.body.genreAffinity).toEqual({})
        expect(res.body.updatedAt).toBeNull()
    })

    test('PUT /users/me/preferences actualiza géneros favoritos', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: [1, 3] })

        expect(res.status).toBe(200)
        expect(res.body.favoriteGenres).toEqual([1, 3])
    })

    test('PUT /users/me/preferences con genre_id inválido devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: [99999] })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('no existen')
    })

    test('PUT /users/me/preferences con body vacío devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({})

        expect(res.status).toBe(400)
    })

    test('GET /users/me/preferences/stats retorna estadísticas', async () => {
        const res = await request(createApp())
            .get('/users/me/preferences/stats')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.totalReviews).toEqual(0)
        expect(res.body.totalWatchlist).toEqual(0)
        expect(res.body.topGenres).toEqual([])
        expect(res.body.topDirectors).toEqual([])
    })

    test('GET /users/me/preferences/stats sin token devuelve 401', async () => {
        const res = await request(createApp())
            .get('/users/me/preferences/stats')

        expect(res.status).toBe(401)
    })

    test('PUT /users/me/preferences con director_id inválido devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteDirectors: [99999] })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('no existen')
    })

    test('PUT /users/me/preferences con actor_id inválido devuelve 400', async () => {
        const res = await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteActors: [99999] })

        expect(res.status).toBe(400)
        expect(res.body.error).toContain('no existen')
    })

    test('GET /users/me/preferences retorna preferencias después de actualizar', async () => {
        await request(createApp())
            .put('/users/me/preferences')
            .set(authHeader())
            .send({ favoriteGenres: [1], favoriteDirectors: [2], favoriteActors: [10] })

        const res = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.favoriteGenres).toEqual([1])
        expect(res.body.favoriteDirectors).toEqual([2])
        expect(res.body.favoriteActors).toEqual([10])
    })
})
