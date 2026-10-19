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

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) }, 30000)

describe('GET /movies/suggest — field=title', () => {
    test('?q=Inc&field=title devuelve Inception', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=Inc&field=title')

        expect(res.status).toBe(200)
        expect(res.body).toEqual(['Inception'])
    })

    test('?q=ince&field=title es case-insensitive', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=ince&field=title')

        expect(res.status).toBe(200)
        expect(res.body).toContain('Inception')
    })

    test('?q=The&field=title devuelve múltiples resultados limitados por defecto', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=The&field=title')

        expect(res.status).toBe(200)
        expect(res.body.length).toBeGreaterThanOrEqual(1)
        expect(res.body.length).toBeLessThanOrEqual(8)
        res.body.forEach((title: string) => {
            expect(title.toLowerCase()).toMatch(/^the/)
        })
    })

    test('?q=The&field=title&limit=3 respeta el límite', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=The&field=title&limit=3')

        expect(res.status).toBe(200)
        expect(res.body.length).toBeLessThanOrEqual(3)
    })

    test('?q=Dark&field=title devuelve Dark Shadows y Dark City', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=Dark&field=title')

        expect(res.status).toBe(200)
        expect(res.body).toContain('Dark Shadows')
        expect(res.body).toContain('Dark City')
    })

    test('?q=Zzz&field=title devuelve array vacío', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=Zzz&field=title')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })
})

describe('GET /movies/suggest — field=director', () => {
    test('?q=Christ&field=director devuelve Christopher Nolan', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=Christ&field=director')

        expect(res.status).toBe(200)
        expect(res.body).toContain('Christopher Nolan')
    })

    test('?q=christ&field=director es case-insensitive', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=christ&field=director')

        expect(res.status).toBe(200)
        expect(res.body).toContain('Christopher Nolan')
    })

    test('?q=Frank&field=director devuelve Frank Darabont', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=Frank&field=director')

        expect(res.status).toBe(200)
        expect(res.body).toContain('Frank Darabont')
    })
})

describe('GET /movies/suggest — field=genre', () => {
    test('?q=act&field=genre devuelve action', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=act&field=genre')

        expect(res.status).toBe(200)
        expect(res.body).toContain('action')
    })

    test('?q=sci&field=genre devuelve sci-fi', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=sci&field=genre')

        expect(res.status).toBe(200)
        expect(res.body).toContain('sci-fi')
    })

    test('?q=dra&field=genre devuelve drama', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=dra&field=genre')

        expect(res.status).toBe(200)
        expect(res.body).toContain('drama')
    })

    test('?q=noi&field=genre devuelve noir', async () => {
        const app = createApp(createTestService())

        const res = await request(app).get('/movies/suggest?q=noi&field=genre')

        expect(res.status).toBe(200)
        expect(res.body).toContain('noir')
    })
})

describe('GET /movies/suggest — validación', () => {
    test('q menor a 3 caracteres devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=In&field=title')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('field inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=actor')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('sin field devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('sin q devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?field=title')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit negativo devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=title&limit=-1')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('limit mayor a 20 devuelve 400', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=title&limit=21')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})
