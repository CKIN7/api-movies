import request from 'supertest'
import { createApp } from '../../api'
import MovieService from '../../services/movieService'
import MovieRepository from '../../repositories/MovieRepository'
import DirectorRepository from '../../repositories/DirectorRepository'
import GenreRepository from '../../repositories/GenreRepository'
import AuditLogRepository from '../../repositories/AuditLogRepository'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection, RowDataPacket } from 'mysql2/promise'

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

describe('POST /movies — director y género en DB', () => {

    test('crear con director existente NO duplica fila en directors', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Otra de Nolan',
            year: 2023,
            rating: 7.0,
            duration: 130,
            plot: '...',
            poster: 'https://example.com/nolan.jpg',
            director: 'Christopher Nolan',
            genre: ['drama'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)
        const [rows] = await db.execute(
            `SELECT COUNT(*) AS count FROM directors WHERE director_name = 'Christopher Nolan'`
        ) as unknown as [RowDataPacket[], unknown]

        expect(res.status).toBe(201)
        expect(rows[0].count).toBe(1)
        expect(res.body.data.director).toBe('Christopher Nolan')
    })

    test('crear con mezcla de género existente + nuevo', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Género Mixto',
            year: 2024,
            rating: 6.5,
            duration: 110,
            plot: 'Mezcla de géneros',
            poster: 'https://example.com/mixto.jpg',
            director: 'Director Mezcla',
            genre: ['drama', 'thriller'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)
        const [genreRows] = await db.execute(
            `SELECT COUNT(*) AS count FROM genres WHERE genre_name = 'drama'`
        ) as unknown as [RowDataPacket[], unknown]

        expect(res.status).toBe(201)
        expect(res.body.data.genres).toContain('drama')
        expect(res.body.data.genres).toContain('thriller')
        expect(genreRows[0].count).toBe(1)
    })

    test('crear con director nuevo + género nuevo', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Todo Nuevo',
            year: 2025,
            rating: 8.0,
            duration: 95,
            plot: 'Todo nuevo',
            poster: 'https://example.com/nuevo.jpg',
            director: 'Directora Nova',
            genre: ['musical', 'biography'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)

        expect(res.status).toBe(201)
        expect(res.body.data.director).toBe('Directora Nova')
        expect(res.body.data.genres).toContain('musical')
        expect(res.body.data.genres).toContain('biography')
    })
})

describe('POST /movies — duplicados', () => {

    test('crear dos películas con el mismo título debe permitirse (sin unique)', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Título Repetido',
            year: 2020,
            rating: 5.0,
            duration: 100,
            plot: 'Primera',
            poster: 'https://example.com/a.jpg',
            director: 'Director A',
            genre: ['drama'],
            available: true
        }

        const res1 = await request(app).post('/movies').send(payload)
        const res2 = await request(app).post('/movies').send({ ...payload, plot: 'Segunda' })

        expect(res1.status).toBe(201)
        expect(res2.status).toBe(201)
        expect(res1.body.data.id).not.toBe(res2.body.data.id)
    })

    test('mismo género con distinto casing se normaliza a lowercase — no duplica', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Casing Genres',
            year: 2022,
            rating: 5.0,
            duration: 100,
            plot: '...',
            poster: 'https://example.com/casing.jpg',
            director: 'Dir Casing',
            genre: ['DRAMA', 'Drama', 'drama'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)
        const [mgRows] = await db.execute(
            'SELECT COUNT(*) AS count FROM movie_genres WHERE movie_id = ?', [res.body.data.id]
        ) as unknown as [RowDataPacket[], unknown]

        expect(res.status).toBe(201)
        expect(mgRows[0].count).toBe(1)
        expect(res.body.data.genres).toEqual(['drama'])
    })
})

describe('POST /movies — caracteres especiales', () => {

    test('título con acentos y unicode debe persistir correctamente', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Película Época Ñoña 🎬',
            year: 2024,
            rating: 7.0,
            duration: 120,
            plot: 'Aventura épica ñoña con emoji',
            poster: 'https://example.com/epica.jpg',
            director: 'José Martínez',
            genre: ['drama'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)

        expect(res.status).toBe(201)
        expect(res.body.data.title).toBe('Película Época Ñoña 🎬')
        expect(res.body.data.director).toBe('José Martínez')
    })

    test('inyección SQL en director no debe romper la DB', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'SQL Injection Test',
            year: 2024,
            rating: 5.0,
            duration: 100,
            plot: 'Safe plot',
            poster: 'https://example.com/sql.jpg',
            director: "Robert'; DROP TABLE movies; --",
            genre: ['drama'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)

        expect(res.status).toBe(201)
        const [movieRows] = await db.execute(
            'SELECT * FROM movies WHERE title = ?', ['SQL Injection Test']
        ) as unknown as [RowDataPacket[], unknown]
        expect(movieRows).toHaveLength(1)
        const [dirRows] = await db.execute(
            'SELECT * FROM directors WHERE director_name = ?', ["Robert'; DROP TABLE movies; --"]
        ) as unknown as [RowDataPacket[], unknown]
        expect(dirRows).toHaveLength(1)
    })
})

describe('POST /movies — year límite en DB', () => {

    test('year = 2026 (máximo) debe persistir correctamente', async () => {
        const app = createApp(createTestService())
        const payload = {
            title: 'Futuro Cercano',
            year: 2026,
            rating: 6.0,
            duration: 90,
            plot: '...',
            poster: 'https://example.com/2026.jpg',
            director: 'Director Futuro',
            genre: ['sci-fi'],
            available: true
        }

        const res = await request(app).post('/movies').send(payload)

        expect(res.status).toBe(201)
        expect(Number(res.body.data.year)).toBe(2026)
    })
})
