import request from 'supertest'
import { createApp } from '../../api'
import MovieService from '../../services/movieService'
import MovieRepository from '../../repositories/MovieRepository'
import AppError from '../../utils/AppError'

// ============================================================
// TESTS UNITARIOS — PAGINACIÓN EN GET /movies
// ============================================================

describe('GET /movies?page=&limit= (controlador)', () => {
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

    test('debe pasar page y limit al servicio', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })

        const app = createApp(service as any)
        await request(app).get('/movies?page=2&limit=5')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ page: 2, limit: 5 })
        )
    })

    test('debe devolver respuesta con estructura { data, meta }', async () => {
        const service = createMockService()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: ['Action', 'Sci-Fi'], ageRating: 'PG-13' },
            { id: 2, title: 'The Dark Knight', year: 2008, director: 'Christopher Nolan', rating: 9.0, duration: 152, plot: '...', poster: '...', genres: ['Action', 'Drama'], ageRating: 'PG-13' },
            { id: 3, title: 'Interstellar', year: 2014, director: 'Christopher Nolan', rating: 8.6, duration: 169, plot: '...', poster: '...', genres: ['Sci-Fi'], ageRating: 'PG-13' }
        ]
        service.getMovies.mockResolvedValue({ data: fakeMovies, meta: { total: 8, page: 1, limit: 3, totalPages: 3 } })

        const app = createApp(service as any)
        const res = await request(app).get('/movies?page=1&limit=3')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            data: fakeMovies,
            meta: { total: 8, page: 1, limit: 3, totalPages: 3 }
        })
    })

    test('debe usar defaults page=1 limit=10 si no se pasan en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })

        const app = createApp(service as any)
        await request(app).get('/movies')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 10 })
        )
    })

    test('debe envolver data vacío cuando no hay resultados', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 8, page: 99, limit: 10, totalPages: 1 } })

        const app = createApp(service as any)
        const res = await request(app).get('/movies?page=99&limit=10')

        expect(res.body.data).toEqual([])
        expect(res.body.meta).toEqual({ total: 8, page: 99, limit: 10, totalPages: 1 })
    })

    test('debe pasar page/limit junto con filtros existentes', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })

        const app = createApp(service as any)
        await request(app).get('/movies?page=1&limit=5&genre=action&sort=year&order=desc')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({
                genre: ['action'], genreMode: 'and', limit: 5, order: 'desc', sort: 'm.year',  page: 1 
            })
        )
    })

    test('debe devolver 500 si el servicio falla', async () => {
        const service = createMockService()
        service.getMovies.mockRejectedValue(new Error('DB error'))

        const app = createApp(service as any)
        const res = await request(app).get('/movies?page=1&limit=5')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('MovieService - getMovies con page/limit (servicio)', () => {
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
            castRepo: {
                findByName: jest.fn().mockName('findByName'),
                create: jest.fn().mockName('create'),
                findOrCreate: jest.fn().mockName('findOrCreate'),
                linkToMovie: jest.fn().mockName('linkToMovie'),
                deleteByMovieId: jest.fn().mockName('deleteByMovieId'),
            },
        }
    }

    function createService(repos: ReturnType<typeof createMockRepos>) {
        return new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)
    }

    test('debe calcular offset correctamente: page=3 limit=10 => offset=20', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = createService(repos)

        await service.getMovies({ genreMode: 'and', page: 3, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 20 })
        )
    })

    test('debe calcular offset correctamente: page=5 limit=5 => offset=20', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = createService(repos)

        await service.getMovies({ genreMode: 'and', page: 5, limit: 5 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ offset: 20 })
        )
    })

    test('debe calcular totalPages = 1 cuando total < limit', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [{ id: 1, title: 'X', year: 2020, director: 'D', rating: 5, duration: 100, plot: 'P', poster: 'U', genres: 'Drama', age_rating: 'PG-13' }], total: 2 })
        const service = createService(repos)

        const result = await service.getMovies({ genreMode: 'and', page: 1, limit: 5 })

        expect(result.meta.totalPages).toBe(1)
    })

    test('debe propagar AppError del repositorio sin modificarlo', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockRejectedValue(new AppError('error del modelo', 400))
        const service = createService(repos)

        await expect(service.getMovies({ genreMode: 'and', page: 1, limit: 5 })).rejects.toThrow(AppError)
    })

    test('debe envolver errores genéricos del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockRejectedValue(new Error('connection lost'))
        const service = createService(repos)

        try {
            await service.getMovies({ genreMode: 'and', page: 1, limit: 5 })
            expect('no debió llegar').toBe('nunca')
        } catch (error) {
            expect(error).toBeInstanceOf(AppError)
            expect((error as AppError).statusCode).toBe(500)
        }
    })
})

describe('MovieRepository - getMovies con page/limit (repositorio)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir LIMIT 5 OFFSET 0 en SQL', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ limit: 5, offset: 0 })

        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([5, 0])
    })

    test('debe incluir LIMIT 10 OFFSET 20 en SQL para page=3 limit=10', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ limit: 10, offset: 20 })

        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([10, 20])
    })

    test('debe combinar LIMIT/OFFSET con WHERE y ORDER BY', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({
            genre: ['action'], genreMode: 'and', sort: 'm.year', order: 'desc', limit: 5, offset: 0
        })

        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('WHERE')
        expect(selectQuery).toContain('ORDER BY')
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(selectQuery.indexOf('ORDER BY')).toBeLessThan(selectQuery.indexOf('LIMIT'))
    })

    test('debe ejecutar COUNT(*) además del SELECT principal', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 8 }]])
            .mockResolvedValueOnce([[]])

        const result = await repo.findMany({ limit: 5, offset: 0 })

        const countQuery = conn.query.mock.calls[0][0] as string
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(countQuery).toMatch(/COUNT/i)
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([5, 0])
        expect(result).toEqual({ rows: [], total: 8 })
    })

    test('debe manejar LIMIT/OFFSET con filtros y ORDER BY', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 5 }]])
            .mockResolvedValueOnce([[]])

        const result = await repo.findMany({ genre: ['action'], genreMode: 'and', sort: 'm.year', order: 'desc', limit: 10, offset: 0 })

        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('WHERE')
        expect(selectQuery).toContain('ORDER BY')
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual(['action', 1, 10, 0])
        expect(result).toEqual({ rows: [], total: 5 })
    })
})
