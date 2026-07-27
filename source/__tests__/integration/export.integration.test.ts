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

describe('GET /movies/export/:format (integración real con DB)', () => {
    test('debe exportar CSV con header y datos', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/export/csv')

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toContain('text/csv')
        expect(res.headers['content-disposition']).toContain('attachment')
        expect(res.headers['content-disposition']).toContain('.csv')
        expect(res.text).toContain('\uFEFF')
        expect(res.text).toContain('Título,Año,Rating,Géneros,Duración,Director,Reparto')
        expect(res.text).toContain('Inception')
    })

    test('debe exportar CSV filtrado', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/export/csv?minRating=9')

        expect(res.status).toBe(200)
        expect(res.text).toContain('Título')
    })

    test('debe exportar JSON con datos', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/export/json')

        expect(res.status).toBe(200)
        expect(res.headers['content-type']).toContain('application/json')
        expect(res.headers['content-disposition']).toContain('attachment')
        expect(res.headers['content-disposition']).toContain('.json')

        const body = JSON.parse(res.text)
        expect(Array.isArray(body)).toBe(true)
        expect(body.length).toBeGreaterThanOrEqual(1)
        expect(body[0]).toHaveProperty('title')
        expect(body[0]).toHaveProperty('genres')
        expect(body[0]).toHaveProperty('cast')
    })

    test('debe devolver 400 si el formato no es válido', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/export/xml')

        expect(res.status).toBe(400)
    })

    test('debe devolver 400 si los filtros son inválidos', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/export/csv?minYear=abc')

        expect(res.status).toBe(400)
    })
})
