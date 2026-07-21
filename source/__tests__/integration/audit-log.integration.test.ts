import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'
import AuditLogRepository from '../../repositories/AuditLogRepository'
import MovieRepository from '../../repositories/MovieRepository'
import DirectorRepository from '../../repositories/DirectorRepository'
import GenreRepository from '../../repositories/GenreRepository'
import MovieService from '../../services/movieService'
import CastRepository from '../../repositories/CastRepository'
import { Movie } from '../../domain/Movie'
import AppError from '../../utils/AppError'

let db: Connection

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) })

describe('AuditLogRepository — integración real con DB', () => {

    test('insert() guarda y findByMovieId recupera', async () => {
        const auditRepo = new AuditLogRepository(db)
        const snapshot = { title: 'Inception', rating: 8.8 }

        await auditRepo.record({
            movieId: 1,
            action: 'CREATE',
            oldSnapshot: null,
            newSnapshot: snapshot,
        })

        const entries = await auditRepo.findByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(1)
        expect(entries[0]).toMatchObject({
            movieId: 1,
            action: 'CREATE',
            oldSnapshot: null,
            newSnapshot: snapshot,
            changedBy: 'system',
        })
        expect(entries[0].id).toBeDefined()
        expect(entries[0].changedAt).toBeDefined()
    })

    test('findByMovieId devuelve array vacío si no hay entradas', async () => {
        const auditRepo = new AuditLogRepository(db)

        const entries = await auditRepo.findByMovieId({ movieId: 999, limit: 10, offset: 0 })
        expect(entries).toEqual([])
    })

    test('countByMovieId devuelve el total correcto', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record({ movieId: 1, action: 'CREATE', oldSnapshot: null, newSnapshot: { rating: 8.8 } })
        await auditRepo.record({ movieId: 1, action: 'UPDATE', oldSnapshot: { rating: 8.8 }, newSnapshot: { rating: 9.0 } })
        await auditRepo.record({ movieId: 2, action: 'CREATE', oldSnapshot: null, newSnapshot: { rating: 9.0 } })

        const total = await auditRepo.countByMovieId(1)
        expect(total).toBe(2)
    })

    test('paginación funciona correctamente', async () => {
        const auditRepo = new AuditLogRepository(db)

        for (let i = 0; i < 5; i++) {
            await auditRepo.record({ movieId: 1, action: 'UPDATE', oldSnapshot: { i }, newSnapshot: { i: i + 1 } })
        }

        const page1 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 0 })
        expect(page1).toHaveLength(2)

        const page2 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 2 })
        expect(page2).toHaveLength(2)

        const page3 = await auditRepo.findByMovieId({ movieId: 1, limit: 2, offset: 4 })
        expect(page3).toHaveLength(1)
    })

    test('findByMovieId devuelve entradas ordenadas por changed_at DESC', async () => {
        const auditRepo = new AuditLogRepository(db)

        await auditRepo.record({ movieId: 1, action: 'UPDATE', oldSnapshot: null, newSnapshot: { v: 'x' } })
        await auditRepo.record({ movieId: 1, action: 'UPDATE', oldSnapshot: null, newSnapshot: { v: 'y' } })
        await auditRepo.record({ movieId: 1, action: 'UPDATE', oldSnapshot: null, newSnapshot: { v: 'z' } })

        const entries = await auditRepo.findByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(3)
    })
})

describe('MovieService — integración real con DB', () => {

    function createService() {
        const movieRepo = new MovieRepository(db)
        const directorRepo = new DirectorRepository(db)
        const genreRepo = new GenreRepository(db)
        const auditRepo = new AuditLogRepository(db)
        const castRepo = new CastRepository(db)
        return new MovieService(movieRepo, directorRepo, genreRepo, auditRepo, castRepo)
    }

    test('getAuditLog retorna entries de una película existente', async () => {
        const auditRepo = new AuditLogRepository(db)
        const service = createService()

        await auditRepo.record({ movieId: 1, action: 'CREATE', oldSnapshot: null, newSnapshot: { title: 'Inception' } })

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)
        expect(result.meta).toMatchObject({ total: 1, page: 1, limit: 10, totalPages: 1 })
    })

    test('getAuditLog lanza AppError 404 si la película no existe', async () => {
        const service = createService()

        await expect(service.getAuditLog({ id: 99999, page: 1, limit: 10 }))
            .rejects.toThrow(AppError)
    })

    test('createMovie registra snapshot completo con CREATE', async () => {
        const service = createService()

        const input = {
            title: 'Audit Test',
            year: 2025,
            rating: 8,
            duration: 120,
            plot: 'Test plot',
            poster: 'http://example.com/p.jpg',
            director: 'Test Director',
            genre: ['drama'],
            available: true,
            ageRating: 'PG-13' as const,
            cast: [{ actor: 'Test Actor', character: 'Test Character' }],
        }
        const movie = await service.createMovie(input) as any

        const result = await service.getAuditLog({ id: movie.id, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)

        const entry = result.data[0]
        expect(entry.action).toBe('CREATE')
        expect(entry.oldSnapshot).toBeNull()
        expect(entry.newSnapshot).toMatchObject({
            title: 'Audit Test',
            year: 2025,
            rating: 8,
            director: 'Test Director',
            genres: ['drama'],
            cast: [{ actor: 'Test Actor', character: 'Test Character' }],
            ageRating: 'PG-13',
        })
    })

    test('updateMovie registra cambios con diff', async () => {
        const service = createService()
        const existing = await service.getMovieById(1)

        await service.updateMovie(1, { rating: 10 })

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)

        const entry = result.data[0]
        expect(entry.action).toBe('UPDATE')
        expect(entry.changes).toEqual(['rating'])
        expect(entry.oldSnapshot).toMatchObject({ rating: existing.rating })
        expect(entry.newSnapshot).toMatchObject({ rating: 10 })
    })

    test('updateMovie sin cambios no registra entrada', async () => {
        const service = createService()

        await service.updateMovie(1, { title: 'Inception' })

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(0)
    })

    test('updateMovie cambia genres y cast', async () => {
        const service = createService()

        await service.updateMovie(1, {
            genre: ['action', 'sci-fi', 'thriller'],
            cast: [
                { actor: 'Leonardo DiCaprio', character: 'Dom Cobb' },
            ],
        })

        const result = await service.getAuditLog({ id: 1, page: 1, limit: 10 })
        expect(result.data).toHaveLength(1)

        const entry = result.data[0]
        expect(entry.action).toBe('UPDATE')
        expect(entry.changes).toContain('genres')
        expect(entry.changes).toContain('cast')
        expect(entry.newSnapshot).toMatchObject({
            genres: expect.arrayContaining(['action', 'sci-fi', 'thriller']),
        })
    })

    test('deleteMovie registra snapshot final con DELETE', async () => {
        const auditRepo = new AuditLogRepository(db)
        const service = createService()
        const movie = await service.getMovieById(1)

        await service.deleteMovie(1)

        const entries = await auditRepo.findByMovieId({ movieId: 1, limit: 10, offset: 0 })
        expect(entries).toHaveLength(1)

        const entry = entries[0]
        expect(entry.action).toBe('DELETE')
        expect(entry.oldSnapshot).toMatchObject({ title: movie.title })
        expect(entry.newSnapshot).toBeNull()
    })
})
