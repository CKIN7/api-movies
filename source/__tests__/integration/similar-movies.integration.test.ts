import request from 'supertest'
import { createApp } from '../../api'
import MovieService from '../../services/movieService'
import MovieRepository from '../../repositories/MovieRepository'
import DirectorRepository from '../../repositories/DirectorRepository'
import GenreRepository from '../../repositories/GenreRepository'
import AuditLogRepository from '../../repositories/AuditLogRepository'
import CastRepository from '../../repositories/CastRepository'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

let db: Connection

function createTestService() {
    const movieRepo = new MovieRepository(db)
    const directorRepo = new DirectorRepository(db)
    const genreRepo = new GenreRepository(db)
    const auditRepo = new AuditLogRepository(db)
    const castRepo = new CastRepository(db)
    return new MovieService(movieRepo, directorRepo, genreRepo, auditRepo, castRepo)
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

describe('GET /movies/:id/similar (integración con DB)', () => {
    test('debe devolver películas similares con similarityScore > 0', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/2/similar')

        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data)).toBe(true)
        expect(res.body.data.length).toBeGreaterThan(0)
        expect(res.body.data[0]).toHaveProperty('similarityScore')
        expect(res.body.data[0].similarityScore).toBeGreaterThan(0)
        expect(res.body).toHaveProperty('meta')
        expect(res.body.meta).toHaveProperty('total')
        expect(res.body.meta).toHaveProperty('page', 1)
        expect(res.body.meta).toHaveProperty('limit', 10)
        expect(res.body.meta).toHaveProperty('totalPages')
    })

    test('debe excluir la película origen', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/2/similar')

        const ids = res.body.data.map((m: any) => m.id)
        expect(ids).not.toContain(2)
    })

    test('debe ordenar por score DESC y rating DESC', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/1/similar')

        for (let i = 1; i < res.body.data.length; i++) {
            const prev = res.body.data[i - 1]
            const curr = res.body.data[i]
            if (prev.similarityScore === curr.similarityScore) {
                expect(prev.rating).toBeGreaterThanOrEqual(curr.rating)
            } else {
                expect(prev.similarityScore).toBeGreaterThan(curr.similarityScore)
            }
        }
    })

    test('debe calcular correctamente scores para Inception (múltiples géneros + director)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/1/similar?limit=50')

        const inception = res.body.data.find((m: any) => m.id === 2)
        expect(inception).toBeDefined()
        expect(inception.similarityScore).toBe(6)
    })

    test('debe paginar correctamente', async () => {
        const app = createApp(createTestService())

        const page1 = await request(app).get('/movies/1/similar?page=1&limit=3')
        const page2 = await request(app).get('/movies/1/similar?page=2&limit=3')

        expect(page1.status).toBe(200)
        expect(page2.status).toBe(200)
        expect(page1.body.data.length).toBeLessThanOrEqual(3)
        expect(page2.body.data.length).toBeLessThanOrEqual(3)

        const ids1 = page1.body.data.map((m: any) => m.id)
        const ids2 = page2.body.data.map((m: any) => m.id)
        const overlap = ids1.filter((id: number) => ids2.includes(id))
        expect(overlap).toHaveLength(0)
    })

    test('debe devolver 404 si la película no existe', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/9999/similar')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver resultados con la estructura de respuesta correcta', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/2/similar')

        expect(res.body).toHaveProperty('data')
        expect(res.body).toHaveProperty('meta')
        expect(Array.isArray(res.body.data)).toBe(true)

        if (res.body.data.length > 0) {
            const movie = res.body.data[0]
            expect(movie).toHaveProperty('id')
            expect(movie).toHaveProperty('title')
            expect(movie).toHaveProperty('year')
            expect(movie).toHaveProperty('rating')
            expect(movie).toHaveProperty('genres')
            expect(movie).toHaveProperty('director')
            expect(movie).toHaveProperty('similarityScore')
            expect(Array.isArray(movie.genres)).toBe(true)
            expect(typeof movie.similarityScore).toBe('number')
        }
    })
})
