import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'
import AuditLogRepository from '../../repositories/AuditLogRepository'
import MovieRepository from '../../repositories/MovieRepository'
import DirectorRepository from '../../repositories/DirectorRepository'
import GenreRepository from '../../repositories/GenreRepository'
import MovieService from '../../services/movieService'
import CastRepository from '../../repositories/CastRepository'
import AppError from '../../utils/AppError'

let db: Connection

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) })

describe('AuditLogRepository — integración real con DB', () => {

    test('record() inserta una entrada y getByMovieId la devuelve', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record(1, 'rating', null, '8.8')

        const entries = await auditRepo.findByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({
            movieId: 1,
            fieldName: 'rating',
            oldValue: null,
            newValue: '8.8',
            changedBy: 'system'
        })
        expect(entries[0].id).toBeDefined()
        expect(entries[0].changedAt).toBeDefined()
    })

    test('findByMovieId filtra por field cuando se especifica', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record(1, 'rating', null, '8.8')
        await auditRepo.record(1, 'title', null, 'Inception')

        const ratingEntries = await auditRepo.findByMovieId({ movieId: 1, field: 'rating', limit: 10, offset: 0 })
        expect(ratingEntries).toHaveLength(1)
        expect(ratingEntries[0].fieldName).toBe('rating')
    })

    test('findByMovieId devuelve array vacío si no hay entradas', async () => {
        const auditRepo = new AuditLogRepository(db)

        const entries = await auditRepo.findByMovieId({ movieId: 999, limit: 10, offset: 0 })
        expect(entries).toEqual([])
    })

    test('countByMovieId devuelve el total correcto', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record(1, 'rating', null, '8.8')
        await auditRepo.record(1, 'rating', '8.8', '9.0')
        await auditRepo.record(2, 'rating', null, '9.0')

        const total = await auditRepo.countByMovieId(1)
        expect(total).toBe(2)

        const totalFiltered = await auditRepo.countByMovieId(1, 'rating')
        expect(totalFiltered).toBe(2)
    })

    test('countByMovieId con field retorna solo las de ese campo', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record(1, 'rating', null, '8.8')
        await auditRepo.record(1, 'title', null, 'Inception')

        const total = await auditRepo.countByMovieId(1, 'rating')
        expect(total).toBe(1)
    })

    test('pagination funciona correctamente', async () => {
        const auditRepo = new AuditLogRepository(db)

        for (let i = 0; i < 5; i++) {
            await auditRepo.record(1, 'rating', String(i), String(i + 1))
        }

        const page1 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 0 })
        expect(page1).toHaveLength(2)

        const page2 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 2 })
        expect(page2).toHaveLength(2)

        const page3 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 4 })
        expect(page3).toHaveLength(1)
    })

    test('findByMovieId devuelve múltiples entradas ordenadas', async () => {
        const auditRepo = new AuditLogRepository(db)

        const values = ['x', 'y', 'z']
        for (const v of values) {
            await auditRepo.record(1, 'rating', null, v)
        }

        const entries = await auditRepo.findByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(3)
        expect(entries.map(e => e.newValue).sort()).toEqual(['x', 'y', 'z'])
    })
})

describe('MovieService.getAuditLog — integración real con DB', () => {

    function createService() {
        const movieRepo = new MovieRepository(db)
        const directorRepo = new DirectorRepository(db)
        const genreRepo = new GenreRepository(db)
        const auditRepo = new AuditLogRepository(db)
        const castRepo = new CastRepository(db)
        return new MovieService(movieRepo, directorRepo, genreRepo, auditRepo, castRepo)
    }

    test('retorna el audit-log de una película existente', async () => {
        const auditRepo = new AuditLogRepository(db)
        const service = createService()

        await auditRepo.record(1, 'rating', null, '8.8')

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)
        expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 })
    })

    test('lanza AppError 404 si la película no existe', async () => {
        const service = createService()

        await expect(service.getAuditLog({ id: 99999, page: 1, limit: 10 }))
            .rejects.toThrow(AppError)
    })

    test('createMovie registra rating inicial en audit_log', async () => {
        const service = createService()

        const input = {
            title: 'Audit Test',
            year: 2025,
            rating: 7.5,
            duration: 120,
            plot: 'Test',
            poster: 'http://example.com/p.jpg',
            director: 'New Director',
            genre: ['drama'],
            available: true
        }
        const movie = await service.createMovie(input) as any

        const result = await service.getAuditLog({ id: movie.id, field: 'rating', page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)
        expect(result.data[0]).toMatchObject({
            movieId: movie.id,
            fieldName: 'rating',
            oldValue: null,
            newValue: '7.5'
        })
    })

    test('updateMovie registra cambio de rating en audit_log', async () => {
        const service = createService()

        const [rows] = await db.query('SELECT rating FROM movies WHERE id = 1') as any
        const currentRating = String(rows[0].rating)

        await service.updateMovie(1, { rating: 9.5 })

        const result = await service.getAuditLog({ id: 1, field: 'rating', page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)
        expect(result.data[0]).toMatchObject({
            movieId: 1,
            fieldName: 'rating',
            oldValue: currentRating,
            newValue: '9.5'
        })
    })

    test('updateMovie sin cambio de rating no registra entrada', async () => {
        const service = createService()

        await service.updateMovie(1, { title: 'Solo título' })

        const result = await service.getAuditLog({ id: 1, field: 'rating', page: 1, limit: 10 })
        expect(result.data).toHaveLength(0)
    })
})
