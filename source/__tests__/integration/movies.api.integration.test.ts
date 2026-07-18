import request from 'supertest'
import { createApp } from '../../api'
import MovieService from '../../services/movieService'
import MovieRepository from '../../repositories/MovieRepository'
import DirectorRepository from '../../repositories/DirectorRepository'
import GenreRepository from '../../repositories/GenreRepository'
import AuditLogRepository from '../../repositories/AuditLogRepository'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

let db: Connection

function createTestService() {
    const movieRepo = new MovieRepository(db)
    const directorRepo = new DirectorRepository(db)
    const genreRepo = new GenreRepository(db)
    const auditRepo = new AuditLogRepository(db)
    return new MovieService(movieRepo, directorRepo, genreRepo, auditRepo)
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

describe('GET /movies (integración real con DB)', () => {
    test('debe devolver todas las películas', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(Array.isArray(res.body.data)).toBe(true)
        expect(res.body.data.length).toBeGreaterThanOrEqual(8)
    })

    test('debe filtrar por año', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?minYear=1994&maxYear=1994')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)
        res.body.data.forEach((m: any) => expect(m.year).toBe(1994))
    })

    test('debe filtrar por género', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(1)
        res.body.data.forEach((m: any) => expect(m.genres.map((g: string) => g.toLowerCase())).toContain('action'))
    })
})

describe('GET /movies/:id (integración con DB)', () => {
    test('debe devolver una película existente', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/1')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('id', 1)
        expect(res.body).toHaveProperty('title')
    })

    test('debe devolver 404 si no existe', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/9999')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies (integración con DB)', () => {
    test('debe crear y devolver la película completa con id', async () => {
        const app = createApp(createTestService())

        const newMovie = {
            title: 'Test Movie',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'A test plot',
            poster: 'https://example.com/test.jpg',
            director: 'Test Director',
            genre: ['drama'],
            available: true
        }

        const res = await request(app).post('/movies').send(newMovie)

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('message', 'Pelicula creada con exito')
        expect(res.body.data).toMatchObject({
            id: 9,
            title: 'Test Movie',
            year: 2024,
            director: 'Test Director',
            rating: expect.any(Number),
            duration: 120,
            plot: 'A test plot',
            poster: 'https://example.com/test.jpg',
            genres: expect.arrayContaining(['drama'])
        })
    })

    test('debe crear con director y género nuevos y devolverlos en la respuesta', async () => {
        const app = createApp(createTestService())

        const newMovie = {
            title: 'Brand New',
            year: 2025,
            rating: 6.0,
            duration: 90,
            plot: 'Brand new plot',
            poster: 'https://example.com/brandnew.jpg',
            director: 'Director Inexistente',
            genre: ['thriller', 'comedy'],
            available: true
        }

        const res = await request(app).post('/movies').send(newMovie)

        expect(res.status).toBe(201)
        expect(res.body.data).toMatchObject({
            id: 9,
            title: 'Brand New',
            year: 2025,
            director: 'Director Inexistente',
            rating: expect.any(Number),
            duration: 90,
            plot: 'Brand new plot',
            poster: 'https://example.com/brandnew.jpg',
            genres: expect.arrayContaining(['thriller'])
        })
        expect(res.body.data.genres).toContain('comedy')
    })

    test('debe devolver 400 con datos inválidos', async () => {
        const app = createApp(createTestService())

        const res = await request(app).post('/movies').send({ title: 'Incomplete' })

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

describe('PATCH /movies/:id (integración con DB)', () => {
    test('debe actualizar el título de una película', async () => {
        const app = createApp(createTestService())

        const res = await request(app).patch('/movies/1').send({ title: 'Updated Title' })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
    })

    test('debe devolver 404 si no existe', async () => {
        const app = createApp(createTestService())

        const res = await request(app).patch('/movies/9999').send({ title: 'Nope' })

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})

describe('DELETE /movies/:id (integración con DB)', () => {
    test('debe borrar una película existente', async () => {
        const app = createApp(createTestService())

        const res = await request(app).delete('/movies/1')

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message', 'Pelicula borrada con exito')
    })

    test('debe devolver 404 si no existe', async () => {
        const app = createApp(createTestService())

        const res = await request(app).delete('/movies/9999')

        expect(res.status).toBe(404)
    })
})
