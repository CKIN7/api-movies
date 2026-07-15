import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'
import AuditLogModel from '../../models/AuditLog'
import MovieModel from '../../models/Movie-mysql'
import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

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

describe('AuditLogModel — integración real con DB', () => {

    test('record() inserta una entrada y getByMovieId la devuelve', async () => {
        const auditLog = new AuditLogModel(db)

        await auditLog.record(1, 'rating', null, '8.8')

        const entries = await auditLog.getByMovieId({ movieId: 1, limit: 10, offset: 0 })
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

    test('getByMovieId filtra por field cuando se especifica', async () => {
        const auditLog = new AuditLogModel(db)

        await auditLog.record(1, 'rating', null, '8.8')
        await auditLog.record(1, 'title', null, 'Inception')

        const ratingEntries = await auditLog.getByMovieId({ movieId: 1, field: 'rating', limit: 10, offset: 0 })
        expect(ratingEntries).toHaveLength(1)
        expect(ratingEntries[0].fieldName).toBe('rating')
    })

    test('getByMovieId devuelve array vacío si no hay entradas', async () => {
        const auditLog = new AuditLogModel(db)

        const entries = await auditLog.getByMovieId({ movieId: 999, limit: 10, offset: 0 })
        expect(entries).toEqual([])
    })

    test('countByMovieId devuelve el total correcto', async () => {
        const auditLog = new AuditLogModel(db)

        await auditLog.record(1, 'rating', null, '8.8')
        await auditLog.record(1, 'rating', '8.8', '9.0')
        await auditLog.record(2, 'rating', null, '9.0')

        const total = await auditLog.countByMovieId(1)
        expect(total).toBe(2)

        const totalFiltered = await auditLog.countByMovieId(1, 'rating')
        expect(totalFiltered).toBe(2)
    })

    test('countByMovieId con field retorna solo las de ese campo', async () => {
        const auditLog = new AuditLogModel(db)

        await auditLog.record(1, 'rating', null, '8.8')
        await auditLog.record(1, 'title', null, 'Inception')

        const total = await auditLog.countByMovieId(1, 'rating')
        expect(total).toBe(1)
    })

    test('pagination funciona correctamente', async () => {
        const auditLog = new AuditLogModel(db)

        for (let i = 0; i < 5; i++) {
            await auditLog.record(1, 'rating', String(i), String(i + 1))
        }

        const page1 = await auditLog.getByMovieId({ movieId: 1, limit: 2, offset: 0 })
        expect(page1).toHaveLength(2)

        const page2 = await auditLog.getByMovieId({ movieId: 1, limit: 2, offset: 2 })
        expect(page2).toHaveLength(2)

        const page3 = await auditLog.getByMovieId({ movieId: 1, limit: 2, offset: 4 })
        expect(page3).toHaveLength(1)
    })

    test('getByMovieId devuelve múltiples entradas ordenadas', async () => {
        const auditLog = new AuditLogModel(db)

        const values = ['x', 'y', 'z']
        for (const v of values) {
            await auditLog.record(1, 'rating', null, v)
        }

        const entries = await auditLog.getByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(3)
        expect(entries.map(e => e.newValue).sort()).toEqual(['x', 'y', 'z'])
    })
})

describe('MovieService.getAuditLog — integración real con DB', () => {

    test('retorna el audit-log de una película existente', async () => {
        const auditLog = new AuditLogModel(db)
        const movieModel = new MovieModel(db, auditLog)
        const service = new MovieService(auditLog, movieModel)

        await auditLog.record(1, 'rating', null, '8.8')

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)
        expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 })
    })

    test('lanza AppError 404 si la película no existe', async () => {
        const auditLog = new AuditLogModel(db)
        const movieModel = new MovieModel(db, auditLog)
        const service = new MovieService(auditLog, movieModel)

        await expect(service.getAuditLog({ id: 99999, page: 1, limit: 10 }))
            .rejects.toThrow(AppError)
    })

    test('createMovie registra rating inicial en audit_log', async () => {
        const auditLog = new AuditLogModel(db)
        const movieModel = new MovieModel(db, auditLog)
        const service = new MovieService(auditLog, movieModel)

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
        const auditLog = new AuditLogModel(db)
        const movieModel = new MovieModel(db, auditLog)
        const service = new MovieService(auditLog, movieModel)

        const [rows] = await db.query('SELECT rating FROM movies WHERE id = 1') as any
        const currentRating = String(rows[0].rating)

        await movieModel.updateMovie({
            id: '1',
            result: { data: { rating: 9.5 } }
        })

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
        const auditLog = new AuditLogModel(db)
        const movieModel = new MovieModel(db, auditLog)
        const service = new MovieService(auditLog, movieModel)

        await movieModel.updateMovie({
            id: '1',
            result: { data: { title: 'Solo título' } }
        })

        const result = await service.getAuditLog({ id: 1, field: 'rating', page: 1, limit: 10 })
        expect(result.data).toHaveLength(0)
    })
})
