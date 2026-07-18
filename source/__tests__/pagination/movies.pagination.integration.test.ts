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

describe('GET /movies?page=&limit= (integración)', () => {

    // --- CASOS BÁSICOS DE PAGINACIÓN ---

    test('page=1&limit=3 debe devolver 3 películas en data y meta correcta', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=3')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)
        expect(res.body.meta).toEqual({ total: 8, page: 1, limit: 3, totalPages: 3 })
        res.body.data.forEach((movie: any) => {
            expect(movie).toHaveProperty('id')
            expect(movie).toHaveProperty('title')
            expect(movie).toHaveProperty('year')
            expect(movie).toHaveProperty('director')
            expect(movie).toHaveProperty('rating')
            expect(movie).toHaveProperty('genres')
        })
    })

    test('page=2&limit=3 debe devolver las siguientes 3 películas', async () => {
        const app = createApp(createTestService())

        const res1 = await request(app).get('/movies?page=1&limit=3')
        const res2 = await request(app).get('/movies?page=2&limit=3')

        expect(res2.status).toBe(200)
        expect(res2.body.data).toHaveLength(3)
        expect(res2.body.meta).toEqual({ total: 8, page: 2, limit: 3, totalPages: 3 })

        const idsPage1 = res1.body.data.map((m: any) => m.id)
        const idsPage2 = res2.body.data.map((m: any) => m.id)
        idsPage2.forEach((id: number) => {
            expect(idsPage1).not.toContain(id)
        })
    })

    test('page=3&limit=3 debe devolver las últimas 2 películas', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=3&limit=3')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(2)
        expect(res.body.meta).toEqual({ total: 8, page: 3, limit: 3, totalPages: 3 })
    })

    test('sin parámetros debe usar defaults page=1 limit=10, devolver 8 películas', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
        expect(res.body.meta).toEqual({ total: 8, page: 1, limit: 10, totalPages: 1 })
    })

    test('page mayor al total debe devolver data vacío y meta correcta', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=99&limit=10')

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
        expect(res.body.meta).toEqual({ total: 8, page: 99, limit: 10, totalPages: 1 })
    })

    // --- VALIDACIONES: page ---

    test('page=0 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=0')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('page=-1 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=-1')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('page=abc debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=abc')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('page=1.5 debe devolver 400 (decimal no entero)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1.5')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('page vacío debe usar default page=1', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=&limit=5')

        expect(res.status).toBe(200)
        expect(res.body.meta.page).toBe(1)
        expect(res.body.data).toHaveLength(5)
    })

    test('params duplicados page=1&page=2 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&page=2&limit=5')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    // --- VALIDACIONES: limit ---

    test('limit=0 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=0')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit=101 debe devolver 400 (excede máximo)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=101')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit=100 debe funcionar correctamente (máximo permitido)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=100')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
    })

    test('limit=abc debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=abc')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit vacío debe usar default limit=10', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=')

        expect(res.status).toBe(200)
        expect(res.body.meta.limit).toBe(10)
    })

    test('limit=-5 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=-5')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit=5.5 debe devolver 400 (decimal no entero)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=5.5')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('params duplicados limit=5&limit=10 debe devolver 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=5&limit=10')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    // --- COMBINACIÓN CON FILTROS ---

    test('combinar paginación con filtro genre: page=1&limit=2&genre=action', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=2&genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(2)
        res.body.data.forEach((movie: any) => {
            expect(movie.genres.map((g: string) => g.toLowerCase())).toContain('action')
        })
        expect(res.body.meta.total).toBe(3)
    })

    test('combinar paginación con filtro year: page=1&limit=5&minYear=1994&maxYear=1994', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=5&minYear=1994&maxYear=1994')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)
        res.body.data.forEach((movie: any) => {
            expect(movie.year).toBe(1994)
        })
        expect(res.body.meta.total).toBe(3)
    })

    test('combinar paginación con filtro title: page=1&limit=2&title=dark', async () => {
        const app = createApp(createTestService())

        const res1 = await request(app).get('/movies?page=1&limit=2&title=dark')
        const res2 = await request(app).get('/movies?page=2&limit=2&title=dark')

        expect(res1.status).toBe(200)
        expect(res1.body.data).toHaveLength(2)
        expect(res1.body.meta.total).toBe(4)

        expect(res2.status).toBe(200)
        expect(res2.body.data).toHaveLength(2)

        const idsPage1 = res1.body.data.map((m: any) => m.id)
        const idsPage2 = res2.body.data.map((m: any) => m.id)
        idsPage2.forEach((id: number) => {
            expect(idsPage1).not.toContain(id)
        })
    })

    // --- COMBINACIÓN CON SORT ---

    test('combinar paginación con sort: page=1&limit=3&sort=year&order=desc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=3&sort=year&order=desc')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)
        expect(res.body.meta.total).toBe(8)

        const years = res.body.data.map((m: any) => m.year)
        for (let i = 0; i < years.length - 1; i++) {
            expect(years[i]).toBeGreaterThanOrEqual(years[i + 1])
        }
    })

    test('combinar paginación con sort ascendente: page=1&limit=3&sort=year&order=asc', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=3&sort=year&order=asc')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(3)

        const years = res.body.data.map((m: any) => m.year)
        for (let i = 0; i < years.length - 1; i++) {
            expect(years[i]).toBeLessThanOrEqual(years[i + 1])
        }
    })

    test('combinar paginación con sort descendente en page=2: page=2&limit=3&sort=year&order=desc', async () => {
        const app = createApp(createTestService())

        const res1 = await request(app).get('/movies?page=1&limit=3&sort=year&order=desc')
        const res2 = await request(app).get('/movies?page=2&limit=3&sort=year&order=desc')

        expect(res2.status).toBe(200)
        expect(res2.body.data).toHaveLength(3)

        const idsPage1 = res1.body.data.map((m: any) => m.id)
        const idsPage2 = res2.body.data.map((m: any) => m.id)
        idsPage2.forEach((id: number) => {
            expect(idsPage1).not.toContain(id)
        })
    })

    // --- COMBINACIÓN COMPLETA ---

    test('combinación completa: page=1&limit=2&sort=year&order=desc&genre=action', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=2&sort=year&order=desc&genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(2)
        res.body.data.forEach((movie: any) => {
            expect(movie.genres.map((g: string) => g.toLowerCase())).toContain('action')
        })

        const years = res.body.data.map((m: any) => m.year)
        for (let i = 0; i < years.length - 1; i++) {
            expect(years[i]).toBeGreaterThanOrEqual(years[i + 1])
        }
        expect(res.body.meta.total).toBe(3)
    })

    // --- EDGE CASES ---

    test('SQL injection en page: ?page=1; DROP TABLE movies;-- debe dar 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1; DROP TABLE movies;--&limit=5')

        expect(res.status).toBe(400)
    })

    test('SQL injection en limit: ?limit=10; DROP TABLE movies;-- debe dar 400', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get("/movies?page=1&limit=10; DROP TABLE movies;--")

        expect(res.status).toBe(400)
    })

    test('page con leading zero: ?page=01 debe ser tratado como page=1', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=01&limit=5')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(5)
    })

    test('page con espacios: ?page=%201 debe funcionar (JS auto-trim)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=%201&limit=5')

        expect(res.status).toBe(200)
    })

    test('limit con signo positivo: ?limit=+5 debe funcionar', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=+5')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(5)
    })

    test('combinar paginación con todos los filtros: genre+minYear/maxYear+title+sort+page+limit', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?page=1&limit=2&genre=action&minYear=2008&maxYear=2008&title=knight&sort=rating&order=desc')

        expect(res.status).toBe(200)

        res.body.data.forEach((movie: any) => {
            expect(movie.genres.map((g: string) => g.toLowerCase())).toContain('action')
            expect(movie.year).toBe(2008)
            expect(movie.title.toLowerCase()).toMatch(/knight/)
        })
    })
})
