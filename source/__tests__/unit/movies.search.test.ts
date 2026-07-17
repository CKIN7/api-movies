import request from 'supertest'
import { createApp } from '../../api'
import MovieRepository from '../../repositories/MovieRepository'

describe('GET /movies?title= (controlador)', () => {
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

    test('debe pasar title al servicio cuando está en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?title=incept')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'incept' })
        )
    })

    test('debe pasar title junto con genre y year', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?title=dark&genre=action&year=2008')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'dark', genre: 'action', year: 2008, page: 1, limit: 10 })
        )
    })

    test('no debe pasar title si no está en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 10 })
        )
    })

    test('debe pasar q al servicio cuando está en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?q=incept')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ q: 'incept' })
        )
    })

    test('debe pasar director al servicio cuando está en query', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?director=Nolan')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ director: 'Nolan' })
        )
    })

    test('no debe pasar director si está vacío', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?director=')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.not.objectContaining({ director: expect.anything() })
        )
    })

    test('no debe pasar q si está vacío', async () => {
        const service = createMockService()
        service.getMovies.mockResolvedValue({ data: [], meta: { total: 0, page: 1, limit: 10, totalPages: 0 } })
        const app = createApp(service as any)
        await request(app).get('/movies?q=')

        expect(service.getMovies).toHaveBeenCalledWith(
            expect.not.objectContaining({ q: expect.anything() })
        )
    })
})

describe('MovieRepository - getMovies con title (repositorio)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir LIKE en la query cuando se filtra por title', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ title: 'incept', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.title LIKE ?')
        expect(conn.query.mock.calls[1][1]).toContain('%incept%')
    })

    test('debe combinar title con year y genre en la query', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ title: 'dark', genre: 'action', year: 2008, limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.title LIKE ?')
        expect(queryStr).toContain('m.year = ?')
        expect(queryStr).toContain('genre_name = ?')
        expect(queryStr).toContain('AND')
    })
})
