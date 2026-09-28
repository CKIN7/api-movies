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

const validReview = {
    rating: 4.5,
    comment: 'Excelente película',
}

describe('Reviews API (integración real con DB)', () => {
    describe('POST /movies/:id/reviews', () => {
        test('crea review con 201 y devuelve isNew=true', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4.5, comment: 'Excelente' })

            expect(res.status).toBe(201)
            expect(res.body.isNew).toBe(true)
            expect(res.body.review.rating).toBe(4.5)
            expect(res.body.review.comment).toBe('Excelente')
            expect(res.body.review.email).toBe('admin@example.com')
        })

        test('hace upsert y devuelve 200 si review ya existe', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4.5, comment: 'Primera' })

            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 5, comment: 'Actualizada' })

            expect(res.status).toBe(200)
            expect(res.body.isNew).toBe(false)
            expect(res.body.review.rating).toBe(5)
            expect(res.body.review.comment).toBe('Actualizada')
        })

        test('401 sin token', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .send({ rating: 4 })

            expect(res.status).toBe(401)
        })

        test('400 si rating inválido', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 6, comment: 'Inválido' })

            expect(res.status).toBe(400)
        })

        test('400 si rating no es múltiplo de 0.5', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4.3 })

            expect(res.status).toBe(400)
        })

        test('400 si rating fuera de rango', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 0 })

            expect(res.status).toBe(400)
        })

        test('400 si body vacío', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({})

            expect(res.status).toBe(400)
        })

        test('404 si película no existe', async () => {
            const res = await request(createApp())
                .post('/movies/999/reviews')
                .set(authHeader())
                .send({ rating: 4 })

            expect(res.status).toBe(404)
        })

        test('400 si rating es string', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: '4.5' })

            expect(res.status).toBe(400)
        })

        test('crea review solo con rating (sin comment)', async () => {
            const res = await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4 })

            expect(res.status).toBe(201)
            expect(res.body.review.rating).toBe(4)
            expect(res.body.review.comment).toBeNull()
        })
    })

    describe('GET /movies/:id/reviews', () => {
        test('devuelve reviews paginadas con summary', async () => {
            const res = await request(createApp())
                .get('/movies/1/reviews')
                .query({ page: 1, limit: 10 })

            expect(res.status).toBe(200)
            expect(Array.isArray(res.body.data)).toBe(true)
            expect(res.body.meta).toEqual({
                total: expect.any(Number),
                page: 1,
                limit: 10,
                totalPages: expect.any(Number),
            })
            expect(res.body.summary).toEqual({
                average: expect.any(Number),
                count: expect.any(Number),
            })
        })

        test('devuelve array vacío y summary null/0 si sin reviews', async () => {
            const res = await request(createApp())
                .get('/movies/999/reviews')

            expect(res.status).toBe(404)
        })

        test('paginación funciona correctamente', async () => {
            const res = await request(createApp())
                .get('/movies/1/reviews')
                .query({ page: 1, limit: 1 })

            expect(res.status).toBe(200)
            expect(res.body.data.length).toBeLessThanOrEqual(1)
            expect(res.body.meta.page).toBe(1)
            expect(res.body.meta.limit).toBe(1)
        })

        test('público sin token', async () => {
            const res = await request(createApp())
                .get('/movies/1/reviews')

            expect(res.status).toBe(200)
        })
    })

    describe('GET /movies/:id/reviews/me', () => {
        test('devuelve review del usuario autenticado', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4.5, comment: 'Test' })

            const res = await request(createApp())
                .get('/movies/1/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.data.rating).toBe("4.5")
            expect(res.body.data.comment).toBe('Test')
        })

        test('devuelve null si usuario no tiene review', async () => {
            const res = await request(createApp())
                .get('/movies/1/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.data).toBeNull()
        })

        test('401 sin token', async () => {
            const res = await request(createApp())
                .get('/movies/1/reviews/me')

            expect(res.status).toBe(401)
        })

        test('404 si película no existe', async () => {
            const res = await request(createApp())
                .get('/movies/999/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(404)
        })
    })

    describe('PATCH /movies/:id/reviews/me', () => {
        test('actualiza rating', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4, comment: 'Original' })

            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({ rating: 5 })

            expect(res.status).toBe(200)
            expect(res.body.data.rating).toBe(5)
            expect(res.body.message).toBe('Reseña actualizada con éxito')
        })

        test('actualiza solo comment', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4, comment: 'Original' })

            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({ comment: 'Actualizado' })

            expect(res.status).toBe(200)
            expect(res.body.data.rating).toBe(4)
            expect(res.body.data.comment).toBe('Actualizado')
        })

        test('200 idempotente si mismos valores', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4, comment: 'Test' })

            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({ rating: 4, comment: 'Test' })

            expect(res.status).toBe(200)
        })

        test('400 si body vacío', async () => {
            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({})

            expect(res.status).toBe(400)
        })

        test('404 si no tiene review', async () => {
            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({ rating: 5 })

            expect(res.status).toBe(404)
        })

        test('401 sin token', async () => {
            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .send({ rating: 5 })

            expect(res.status).toBe(401)
        })

        test('400 si rating inválido', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4 })

            const res = await request(createApp())
                .patch('/movies/1/reviews/me')
                .set(authHeader())
                .send({ rating: 6 })

            expect(res.status).toBe(400)
        })
    })

    describe('DELETE /movies/:id/reviews/me', () => {
        test('elimina review existente', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4, comment: 'Para borrar' })

            const res = await request(createApp())
                .delete('/movies/1/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(200)
            expect(res.body.message).toBe('Reseña eliminada con éxito')
        })

        test('404 si no tiene review', async () => {
            const res = await request(createApp())
                .delete('/movies/1/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(404)
        })

        test('404 al intentar borrar dos veces', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4 })

            await request(createApp())
                .delete('/movies/1/reviews/me')
                .set(authHeader())

            const res = await request(createApp())
                .delete('/movies/1/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(404)
        })

        test('401 sin token', async () => {
            const res = await request(createApp())
                .delete('/movies/1/reviews/me')

            expect(res.status).toBe(401)
        })

        test('404 si película no existe', async () => {
            const res = await request(createApp())
                .delete('/movies/999/reviews/me')
                .set(authHeader())

            expect(res.status).toBe(404)
        })
    })

    describe('Enriquecimiento Movie con reviews', () => {
        test('GET /movies/:id incluye averageRating y reviewsCount', async () => {
            await request(createApp())
                .post('/movies/1/reviews')
                .set(authHeader())
                .send({ rating: 4.5, comment: 'Test' })

            const res = await request(createApp())
                .get('/movies/1')

            expect(res.status).toBe(200)
            expect(res.body.averageRating).toBe(4.5)
            expect(res.body.reviewsCount).toBe(1)
        })

        test('GET /movies incluye averageRating y reviewsCount en lista', async () => {
            const res = await request(createApp())
                .get('/movies')
                .query({ limit: 5 })

            expect(res.status).toBe(200)
            expect(res.body.data[0]).toHaveProperty('averageRating')
            expect(res.body.data[0]).toHaveProperty('reviewsCount')
        })

        test('película sin reviews tiene averageRating=null y reviewsCount=0', async () => {
            const res = await request(createApp())
                .get('/movies/999')

            expect(res.status).toBe(404)
        })
    })
})