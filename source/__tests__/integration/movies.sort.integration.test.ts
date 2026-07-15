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

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) })

function createTestService() {
    const movieRepo = new MovieRepository(db)
    const directorRepo = new DirectorRepository(db)
    const genreRepo = new GenreRepository(db)
    const auditRepo = new AuditLogRepository(db)
    return new MovieService(movieRepo, directorRepo, genreRepo, auditRepo)
}

describe('GET /movies?sort=&order= (integración)', () => {

    test('debe ordenar por año descendente: GET /movies?sort=year&order=desc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=year&order=desc')

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
        }
    })

    test('debe ordenar por rating ascendente: GET /movies?sort=rating&order=asc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=rating&order=asc')

        expect(res.status).toBe(200)

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(Number(movies[i].rating)).toBeLessThanOrEqual(Number(movies[i + 1].rating))
        }
    })

    test('debe ordenar por título ascendente por defecto: GET /movies?sort=title', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=title')

        expect(res.status).toBe(200)

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].title.localeCompare(movies[i + 1].title)).toBeLessThanOrEqual(0)
        }
    })

    test('debe devolver 400 si sort es inválido: GET /movies?sort=invalido', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=invalido')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe funcionar sin sort (comportamiento actual): GET /movies', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
    })

    test('debe combinar sort con filtros existentes: GET /movies?sort=year&order=desc&genre=action', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=year&order=desc&genre=action')

        expect(res.status).toBe(200)

        const movies = res.body.data
        expect(movies.length).toBeGreaterThan(0)
        movies.forEach((m: any) => expect(m.genres.map((g: string) => g.toLowerCase())).toContain('action'))

        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
        }
    })

    test('debe ordenar por rating descendente: GET /movies?sort=rating&order=desc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=rating&order=desc')

        expect(res.status).toBe(200)

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(Number(movies[i].rating)).toBeGreaterThanOrEqual(Number(movies[i + 1].rating))
        }
    })

    test('debe ordenar por título descendente: GET /movies?sort=title&order=desc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=title&order=desc')

        expect(res.status).toBe(200)

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].title.localeCompare(movies[i + 1].title)).toBeGreaterThanOrEqual(0)
        }
    })

    test('debe ordenar por año ascendente: GET /movies?sort=year&order=asc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=year&order=asc')

        expect(res.status).toBe(200)

        const movies = res.body.data
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeLessThanOrEqual(movies[i + 1].year)
        }
    })

    test('debe ignorar order si no hay sort: GET /movies?order=desc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?order=desc')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
    })

    test('debe combinar sort=year con filtro year: GET /movies?sort=year&order=desc&year=1994', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=year&order=desc&year=1994')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)
        res.body.data.forEach((m: any) => expect(m.year).toBe(1994))
    })

    test('debe combinar sort=year con filtro title: GET /movies?sort=year&order=desc&title=dark', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?sort=year&order=desc&title=dark')

        expect(res.status).toBe(200)

        const movies = res.body.data
        expect(movies.length).toBeGreaterThan(0)
        movies.forEach((m: any) => expect(m.title.toLowerCase()).toMatch(/dark/))

        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
        }
    })

    describe('Corner cases agresivos — intentos de romper', () => {

        test('SQL injection en sort: ?sort=year; DROP TABLE movies;-- debe dar 400', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=year; DROP TABLE movies;--')

            expect(res.status).toBe(400)
        })

        test('SQL injection en order: ?sort=year&order=desc; DROP TABLE movies;-- debe dar 400', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get("/movies?sort=year&order=desc'; DROP TABLE movies;--")

            expect(res.status).toBe(400)
        })

        test('order=DESC mayúsculas debe ordenar descendente igual que desc', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=year&order=DESC')

            expect(res.status).toBe(200)

            const movies = res.body.data
            for (let i = 0; i < movies.length - 1; i++) {
                expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
            }
        })

        test('sort con espacio al inicio: ?sort=%20year debe dar 400', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=%20year')

            expect(res.status).toBe(400)
        })

        test('sort vacío: ?sort= debe ser tratado como si no hubiera sort', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=')

            expect(res.status).toBe(200)
            expect(res.body.data).toHaveLength(8)
        })

        test('sort duplicado: ?sort=year&sort=rating debe dar 400 (valor array)', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=year&sort=rating')

            expect(res.status).toBe(400)
        })

        test('sort con caracteres especiales: ?sort=year\'" OR 1=1 -- debe dar 400', async () => {
            const app = createApp(createTestService())

            const res = await request(app).get('/movies?sort=year%27%22%20OR%201=1%20--')

            expect(res.status).toBe(400)
        })
    })
})
