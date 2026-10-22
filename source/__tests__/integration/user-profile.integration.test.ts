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

describe('User Profile API (integración real con DB)', () => {
    test('GET /users/me/profile sin token devuelve 401', async () => {
        const res = await request(createApp()).get('/users/me/profile')
        expect(res.status).toBe(401)
    })

    test('GET /users/me/profile devuelve defaults sin fila', async () => {
        const res = await request(createApp())
            .get('/users/me/profile')
            .set(authHeader())

        expect(res.status).toBe(200)
        expect(res.body.displayName).toBeNull()
        expect(res.body.isPublic).toBe(false)
    })

    test('PATCH /users/me/profile actualiza y devuelve el perfil', async () => {
        const res = await request(createApp())
            .patch('/users/me/profile')
            .set(authHeader())
            .send({ displayName: 'Ana', bio: 'Sci-fi fan', country: 'es' })

        expect(res.status).toBe(200)
        expect(res.body.displayName).toBe('Ana')
        expect(res.body.country).toBe('ES')
    })

    test('PATCH con displayName inválido devuelve 400', async () => {
        const res = await request(createApp())
            .patch('/users/me/profile')
            .set(authHeader())
            .send({ displayName: 'A' })

        expect(res.status).toBe(400)
    })

    test('PATCH con body vacío devuelve 400', async () => {
        const res = await request(createApp())
            .patch('/users/me/profile')
            .set(authHeader())
            .send({})

        expect(res.status).toBe(400)
    })

    test('GET /users/:id/profile devuelve tarjeta privada por defecto', async () => {
        const res = await request(createApp()).get(`/users/${TEST_USER_ID}/profile`)

        expect(res.status).toBe(200)
        expect(res.body.isPublic).toBe(false)
    })

    test('GET /users/:id/profile público incluye stats', async () => {
        await request(createApp())
            .patch('/users/me/profile')
            .set(authHeader())
            .send({ displayName: 'Ana', isPublic: true })

        const res = await request(createApp()).get(`/users/${TEST_USER_ID}/profile`)

        expect(res.status).toBe(200)
        expect(res.body.isPublic).toBe(true)
        expect(res.body.displayName).toBe('Ana')
        expect(res.body.stats).toBeDefined()
        expect(res.body.email).toBeUndefined()
    })

    test('GET /users/:id/profile con id inexistente devuelve 404', async () => {
        const res = await request(createApp()).get('/users/00000000-0000-0000-0000-000000000000/profile')
        expect(res.status).toBe(404)
    })

    test('GET /users/:id/profile con id no-UUID devuelve 400', async () => {
        const res = await request(createApp()).get('/users/not-a-uuid/profile')
        expect(res.status).toBe(400)
    })
})
