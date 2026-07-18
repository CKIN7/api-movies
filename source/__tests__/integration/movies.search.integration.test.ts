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

describe('GET /movies?title= (búsqueda por título)', () => {
    test('debe filtrar por título parcial (case-insensitive)', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=incept')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title.toLowerCase()).toMatch(/incept/)
    })

    test('debe devolver array vacío si no hay coincidencias', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=xyzxyz')

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
    })

    test('debe devolver múltiples resultados para término compartido', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=dark')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(3)
        res.body.data.forEach((m: any) => expect(m.title.toLowerCase()).toMatch(/dark/))
    })

    test('debe combinar title con rango de year reduciendo resultados', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=dark&minYear=1994&maxYear=1994')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('Dark Shadows')
        expect(res.body.data[0].year).toBe(1994)
    })

    test('debe combinar title con genre', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=dark&genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(2)
        res.body.data.forEach((m: any) => {
            expect(m.title.toLowerCase()).toMatch(/dark/)
            expect(m.genres.map((g: string) => g.toLowerCase())).toContain('action')
        })
    })

    test('debe combinar title, genre y rango de year simultáneamente', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?title=knight&genre=action&minYear=2008&maxYear=2008')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('The Dark Knight')
        expect(res.body.data[0].year).toBe(2008)
        expect(res.body.data[0].genres.map((g: string) => g.toLowerCase())).toContain('action')
    })
})

describe('GET /movies?q= (búsqueda full-text)', () => {
    test('?q=incept encuentra Inception por título', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=incept')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('Inception')
    })

    test('?q=Nolan encuentra películas por director', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=Nolan')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(3)
        res.body.data.forEach((m: any) => {
            expect(m.director).toBe('Christopher Nolan')
        })
    })

    test('?q=crime encuentra películas por género', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=crime')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(1)
        res.body.data.forEach((m: any) => {
            expect(m.genres.map((g: string) => g.toLowerCase())).toContain('crime')
        })
    })

    test('?q=xyzxyz devuelve array vacío', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=xyzxyz')

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
    })

    test('?q= (vacío) no filtra, devuelve todas', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
    })
})

describe('GET /movies?director= (búsqueda por director)', () => {
    test('?director=Nolan encuentra películas de Christopher Nolan', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?director=Nolan')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(4)
        res.body.data.forEach((m: any) => {
            expect(m.director).toBe('Christopher Nolan')
        })
    })

    test('?director=christ busca parcialmente en director_name', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?director=christ')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(1)
        res.body.data.forEach((m: any) => {
            expect(m.director.toLowerCase()).toMatch(/christ/)
        })
    })

    test('?director= (vacío) no filtra, devuelve todas', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?director=')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(8)
    })
})

describe('GET /movies?q=+director+rangos+genre (combinación total)', () => {
    test('todos los filtros juntos: q+director+minRating+genre', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=dark&director=Nolan&minRating=8&genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(2)
        res.body.data.forEach((m: any) => {
            expect(m.director).toBe('Christopher Nolan')
            expect(m.rating).toBeGreaterThanOrEqual(8)
            expect(m.genres.map((g: string) => g.toLowerCase())).toContain('action')
            expect(m.title.toLowerCase()).toMatch(/dark/)
        })
    })

    test('todos los filtros + multi-género AND + paginación', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies?q=knight&director=Nolan&minYear=2010&maxYear=2015&genre=action&genre=drama&genreMode=and&sort=year&order=desc&page=1&limit=1')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('The Dark Knight Rises')
        expect(res.body.data[0].year).toBe(2012)
        expect(res.body.data[0].director).toBe('Christopher Nolan')
        const genres = res.body.data[0].genres.map((g: string) => g.toLowerCase())
        expect(genres).toContain('action')
        expect(genres).toContain('drama')
    })
})
