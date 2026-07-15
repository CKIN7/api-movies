import request from 'supertest'
import { createApp } from '../../api'
import MovieModel from '../../models/Movie-mysql'
import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

describe('GET /movies?sort=&order= (controlador)', () => {
    function createMockModel() {
        return {
            getMovies: jest.fn().mockName('getMovies'),
            getMovieById: jest.fn().mockName('getMovieById'),
            createMovie: jest.fn().mockName('createMovie'),
            updateMovie: jest.fn().mockName('updateMovie'),
            deleteMovie: jest.fn().mockName('deleteMovie')
        }
    }

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('debe pasar sort y order al modelo', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        const app = createApp(model as any)
        await request(app).get('/movies?sort=year&order=desc')

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'year', order: 'desc', limit: 10, offset: 0 })
        )
    })

    test('debe pasar sort con order por defecto ascendente', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        const app = createApp(model as any)
        await request(app).get('/movies?sort=title')

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'title', order: 'asc', limit: 10, offset: 0 })
        )
    })

    test('debe pasar sort y order junto con filtros existentes', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        const app = createApp(model as any)
        await request(app).get('/movies?sort=rating&genre=action&title=dark')

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'rating', genre: 'action', title: 'dark', order: 'asc', limit: 10, offset: 0 })
        )
    })

    test('no debe pasar sort si no está en query', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        const app = createApp(model as any)
        await request(app).get('/movies')

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        )
    })
})

describe('MovieService - getMovies con sort/order (servicio)', () => {
    function createMockModel() {
        return { getMovies: jest.fn().mockName('getMovies') } as any
    }

    test('debe pasar sort y order al modelo tal cual', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService({} as any, model)

        await service.getMovies({ sort: 'year', order: 'desc' })

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ sort: 'year', order: 'desc' })
        )
    })

    test('debe lanzar AppError 400 si sort es inválido', async () => {
        const model = createMockModel()
        const service = new MovieService({} as any, model)

        await expect(service.getMovies({ sort: 'invalido' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si sort es un array (params duplicados)', async () => {
        const model = createMockModel()
        const service = new MovieService({} as any, model)

        try {
            await service.getMovies({ sort: ['year', 'rating'] as any })
            expect('no debió llegar').toBe('nunca')
        } catch (error) {
            expect(error).toBeInstanceOf(AppError)
            expect((error as AppError).statusCode).toBe(400)
        }
    })

    test('debe lanzar AppError 400 si order es un array (params duplicados)', async () => {
        const model = createMockModel()
        const service = new MovieService({} as any, model)

        try {
            await service.getMovies({ sort: 'year', order: ['desc', 'asc'] as any })
            expect('no debió llegar').toBe('nunca')
        } catch (error) {
            expect(error).toBeInstanceOf(AppError)
            expect((error as AppError).statusCode).toBe(400)
        }
    })

    test('debe lanzar AppError 400 si order es inválido', async () => {
        const model = createMockModel()
        const service = new MovieService({} as any, model)

        await expect(service.getMovies({ sort: 'year', order: 'invalid' }))
            .rejects.toThrow(AppError)
    })

    test('debe ignorar order si no hay sort', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService({} as any, model)

        await service.getMovies({ order: 'desc' })

        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ order: 'desc' })
        )
    })
})

describe('MovieModel - getMovies con sort (modelo)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir ORDER BY year DESC', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ sort: 'year', order: 'desc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.year DESC')
    })

    test('debe incluir ORDER BY rating ASC por defecto', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ sort: 'rating', order: 'asc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.rating ASC')
    })

    test('debe incluir ORDER BY title ASC', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ sort: 'title', order: 'asc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.title ASC')
    })

    test('debe manejar order=DESC mayúscula como descendente', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ sort: 'year', order: 'DESC', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('ORDER BY m.year DESC')
    })

    test('debe combinar ORDER BY con filtros WHERE', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ title: 'dark', sort: 'year', order: 'desc', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('WHERE')
        expect(queryStr).toContain('ORDER BY m.year DESC')
        expect(queryStr.indexOf('ORDER BY m.year DESC')).toBeGreaterThan(queryStr.indexOf('WHERE'))
    })
})