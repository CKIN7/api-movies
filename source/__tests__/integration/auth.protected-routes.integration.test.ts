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

const validPayload = {
    title: 'Otra de Nolan',
    year: 2023,
    rating: 7.0,
    duration: 130,
    plot: '...',
    poster: 'https://example.com/nolan.jpg',
    director: 'Christopher Nolan',
    genre: ['drama'],
}

describe('Rutas protegidas con requireAuth (integración real con DB)', () => {
    test('POST /movies sin token devuelve 401', async () => {
        const res = await request(createApp()).post('/movies').send(validPayload)

        expect(res.status).toBe(401)
        expect(res.body.error).toBeDefined()
    })

    test('POST /movies con token válido devuelve 201', async () => {
        const res = await request(createApp()).post('/movies').set(authHeader()).send(validPayload)

        expect(res.status).toBe(201)
    })

    test('PATCH /movies/:id sin token devuelve 401', async () => {
        const res = await request(createApp()).patch('/movies/1').send({ title: 'Cambiado' })

        expect(res.status).toBe(401)
    })

    test('DELETE /movies/:id sin token devuelve 401', async () => {
        const res = await request(createApp()).delete('/movies/1')

        expect(res.status).toBe(401)
    })

    test('GET /movies sin token sigue siendo público (200)', async () => {
        const res = await request(createApp()).get('/movies')

        expect(res.status).toBe(200)
    })

    test('GET /movies/:id sin token sigue siendo público (200)', async () => {
        const res = await request(createApp()).get('/movies/1')

        expect(res.status).toBe(200)
    })

    test('GET /movies/export/csv sin token devuelve 401', async () => {
        const res = await request(createApp()).get('/movies/export/csv')

        expect(res.status).toBe(401)
    })

    test('GET /movies/export/csv con token válido devuelve 200', async () => {
        const res = await request(createApp()).get('/movies/export/csv').set(authHeader())

        expect(res.status).toBe(200)
    })

    test('POST /movies con token de tipo refresh devuelve 401', async () => {
        const res = await request(createApp())
            .post('/movies')
            .set(authHeader(TEST_USER_ID, 'refresh'))
            .send(validPayload)

        expect(res.status).toBe(401)
    })
})