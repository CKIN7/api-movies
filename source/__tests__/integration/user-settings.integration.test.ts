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

describe('User Settings API (integración real con DB)', () => {
    test('GET /users/me/settings sin token devuelve 401', async () => {
        const res = await request(createApp()).get('/users/me/settings')
        expect(res.status).toBe(401)
    })

    test('GET /users/me/settings devuelve defaults sin fila', async () => {
        const res = await request(createApp())
            .get('/users/me/settings')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.theme).toBe('system')
        expect(res.body.notifyEmail).toBe(true)
        expect(res.body.onboardingCompleted).toBe(false)
        expect(res.body.updatedAt).toBeNull()
    })

    test('PATCH /users/me/settings crea y persiste la config', async () => {
        const patch = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ theme: 'dark', region: 'es' })

        expect(patch.status).toBe(200)
        expect(patch.body.theme).toBe('dark')
        expect(patch.body.region).toBe('ES')

        const get = await request(createApp())
            .get('/users/me/settings')
            .set(authHeader())

        expect(get.body.theme).toBe('dark')
        expect(get.body.region).toBe('ES')
        expect(get.body.updatedAt).not.toBeNull()
    })

    test('PATCH parcial conserva los campos previos', async () => {
        await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ theme: 'light', language: 'en' })

        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ spoilerFree: true })

        expect(res.status).toBe(200)
        expect(res.body.theme).toBe('light')
        expect(res.body.language).toBe('en')
        expect(res.body.spoilerFree).toBe(true)
    })

    test('PATCH con theme inválido devuelve 400', async () => {
        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ theme: 'neon' })

        expect(res.status).toBe(400)
    })

    test('PATCH con privacy inválida devuelve 400', async () => {
        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ privacyActivity: 'secret' })

        expect(res.status).toBe(400)
    })

    test('PATCH con body vacío devuelve 400', async () => {
        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({})

        expect(res.status).toBe(400)
    })

    test('PATCH puede limpiar la región con null', async () => {
        await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ region: 'ES' })

        const res = await request(createApp())
            .patch('/users/me/settings')
            .set(authHeader())
            .send({ region: null })

        expect(res.status).toBe(200)
        expect(res.body.region).toBeNull()
    })
})
