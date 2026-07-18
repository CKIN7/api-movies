import request from 'supertest'
import { createApp } from '../../api'
import MovieService from '../../services/movieService'
import MovieRepository from '../../repositories/MovieRepository'
import AppError from '../../utils/AppError'

describe('GET /movies?sort=&order= (controlador)', () => {
    function createMockService() {
        return {
            getMovies: jest.fn().mockName('getMovies'),
            getMovieById: jest.fn().mockName('getMovieById'),
            createMovie: jest.fn().mockName('createMovie'),
            updateMovie: jest.fn().mockName('updateMovie'),
            deleteMovie: jest.fn().mockName('deleteMovie'),
            getAuditLog: jest.fn().mockName('getAuditLog'),
        }
    }

    afterEach(() => { jest.restoreAllMocks() })

    test('debe pasar sort y order al servicio', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?sort=year&order=desc')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'm.year', order: 'desc', page: 1, limit: 10 })
        )
    })

    test('debe pasar sort sin order por defecto (Zod no lo añade)', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?sort=title')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'm.title', page: 1, limit: 10 })
        )
    })

    test('debe pasar sort y order junto con filtros existentes', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?sort=rating&genre=action&title=dark')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'm.rating', genre: ['action'], genreMode: 'and', title: 'dark', page: 1, limit: 10 })
        )
    })

    test('no debe pasar sort si no está en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 10 })
        )
    })
})

describe('MovieService - getMovies con sort/order (servicio)', () => {
    function createMockRepos() {
        return {
            movieRepo: {
                findMany: jest.fn().mockName('findMany'),
                findById: jest.fn().mockName('findById'),
                insert: jest.fn().mockName('insert'),
                update: jest.fn().mockName('update'),
                delete: jest.fn().mockName('delete'),
                transaction: jest.fn().mockName('transaction'),
                countAll: jest.fn().mockName('countAll'),
            },
            directorRepo: {
                findByName: jest.fn().mockName('findByName'),
                create: jest.fn().mockName('create'),
                findOrCreate: jest.fn().mockName('findOrCreate'),
            },
            genreRepo: {
                findByName: jest.fn().mockName('findByName'),
                create: jest.fn().mockName('create'),
                findOrCreate: jest.fn().mockName('findOrCreate'),
                deleteByMovieId: jest.fn().mockName('deleteByMovieId'),
                linkToMovie: jest.fn().mockName('linkToMovie'),
            },
            auditRepo: {
                findByMovieId: jest.fn().mockName('findByMovieId'),
                countByMovieId: jest.fn().mockName('countByMovieId'),
                record: jest.fn().mockName('record'),
            },
        }
    }

    function createService(repos: ReturnType<typeof createMockRepos>) {
        return new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any)
    }

    test('debe pasar sort y order al repositorio', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = createService(repos)

        await service.getMovies({ genreMode: 'and', sort: 'm.year' as any, order: 'desc', page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'm.year', order: 'desc', limit: 10, offset: 0 })
        )
    })

    test('debe pasar order por defecto ASC si sort presente sin order', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = createService(repos)

        await service.getMovies({ genreMode: 'and', sort: 'm.year' as any, page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'm.year', order: 'asc', limit: 10, offset: 0 })
        )
    })

    test('debe pasar order aunque no haya sort', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = createService(repos)

        await service.getMovies({ genreMode: 'and', order: 'desc', page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ order: 'desc', limit: 10, offset: 0 })
        )
    })
})

describe('MovieRepository - getMovies con sort (repositorio)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir ORDER BY year DESC', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ sort: 'm.year', order: 'desc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.year DESC')
    })

    test('debe incluir ORDER BY rating ASC por defecto', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ sort: 'm.rating', order: 'asc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.rating ASC')
    })

    test('debe incluir ORDER BY title ASC', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ sort: 'm.title', order: 'asc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.title ASC')
    })

    test('debe manejar order=DESC mayúscula como descendente', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ sort: 'm.year', order: 'DESC', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.year DESC')
    })

    test('debe combinar ORDER BY con filtros WHERE', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ title: 'dark', sort: 'm.year', order: 'desc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('WHERE')
        expect(queryStr).toContain('ORDER BY m.year DESC')
        expect(queryStr.indexOf('ORDER BY m.year DESC')).toBeGreaterThan(queryStr.indexOf('WHERE'))
    })
})
