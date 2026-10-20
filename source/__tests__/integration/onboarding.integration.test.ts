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

function completeOnboarding(body: object) {
    return request(createApp())
        .post('/users/me/onboarding')
        .set(authHeader())
        .send(body)
}

describe('Onboarding API (integración real con DB)', () => {
    test('sin token devuelve 401', async () => {
        const res = await request(createApp())
            .post('/users/me/onboarding')
            .send({ favoriteGenres: [1] })

        expect(res.status).toBe(401)
    })

    test('valida géneros requeridos, duplicados y existentes', async () => {
        const empty = await completeOnboarding({ favoriteGenres: [] })
        const duplicated = await completeOnboarding({ favoriteGenres: [1, 1] })
        const unknown = await completeOnboarding({ favoriteGenres: [999] })

        expect(empty.status).toBe(400)
        expect(duplicated.status).toBe(400)
        expect(unknown.status).toBe(400)
    })

    test('primera ejecución: persiste favoritos, siembra afinidad y marca la bandera', async () => {
        const res = await completeOnboarding({
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        })

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            onboardingCompleted: true,
            seeded: true,
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        })

        const prefs = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())
        const settings = await request(createApp())
            .get('/users/me/settings')
            .set(authHeader())

        expect(prefs.body.favoriteGenres).toEqual([1, 2])
        expect(prefs.body.favoriteDirectors).toEqual([10])
        expect(prefs.body.genreAffinity['1'].score).toBe(5)
        expect(prefs.body.genreAffinity['2'].score).toBe(5)
        expect(settings.body.onboardingCompleted).toBe(true)
    })

    test('cold start: tras el onboarding hybrid devuelve recomendaciones', async () => {
        await completeOnboarding({ favoriteGenres: [1, 2] })

        const res = await request(createApp())
            .get('/users/me/recommendations?type=hybrid&limit=10')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThan(0)
        expect(res.body[0]).toMatchObject({
            movie: { id: expect.any(Number) },
            score: expect.any(Number),
            reason: expect.any(String),
        })
    })

    test('segunda ejecución: no vuelve a sembrar afinidad', async () => {
        await completeOnboarding({ favoriteGenres: [1, 2] })

        const res = await completeOnboarding({ favoriteGenres: [2] })
        const prefs = await request(createApp())
            .get('/users/me/preferences')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.seeded).toBe(false)
        expect(res.body.favoriteGenres).toEqual([2])
        expect(prefs.body.genreAffinity['1'].score).toBe(5)
        expect(prefs.body.genreAffinity['2'].score).toBe(5)
    })

    test('PATCH de settings conserva onboardingCompleted', async () => {
        await completeOnboarding({ favoriteGenres: [1] })

        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ theme: 'dark' })

        expect(res.status).toBe(200)
        expect(res.body.theme).toBe('dark')
        expect(res.body.onboardingCompleted).toBe(true)
    })
})
