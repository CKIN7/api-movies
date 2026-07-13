import request from 'supertest'
import { createApp } from '../../api'
import MovieModel from '../../models/Movie-mysql'
import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

// ============================================================
// TESTS UNITARIOS — PAGINACIÓN EN GET /movies
// ============================================================

describe('GET /movies?page=&limit= (controlador)', () => {
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

    test('debe pasar page y limit al servicio', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        // ACT
        const app = createApp(model as any)
        await request(app).get('/movies?page=2&limit=5')

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ page: '2', limit: 5, offset: 5 })
        )
    })

    test('debe devolver respuesta con estructura { data, meta }', async () => {
        // ARRANGE
        const model = createMockModel()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' },
            { id: 2, title: 'The Dark Knight', year: 2008, director: 'Christopher Nolan', rating: 9.0, duration: 152, plot: '...', poster: '...', genres: 'Action, Drama' },
            { id: 3, title: 'Interstellar', year: 2014, director: 'Christopher Nolan', rating: 8.6, duration: 169, plot: '...', poster: '...', genres: 'Sci-Fi' }
        ]
        model.getMovies.mockResolvedValue({ rows: fakeMovies, total: 8 })

        // ACT
        const app = createApp(model as any)
        const res = await request(app).get('/movies?page=1&limit=3')

        // ASSERT
        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            data: fakeMovies,
            meta: { total: 8, page: 1, limit: 3, totalPages: 3 }
        })
    })

    test('debe usar defaults page=1 limit=10 si no se pasan en query', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        // ACT
        const app = createApp(model as any)
        await request(app).get('/movies')

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0, page: undefined })
        )
    })

    test('debe envolver data vacío cuando no hay resultados', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 8 })

        // ACT
        const app = createApp(model as any)
        const res = await request(app).get('/movies?page=99&limit=10')

        // ASSERT
        expect(res.body.data).toEqual([])
        expect(res.body.meta).toEqual({ total: 8, page: 99, limit: 10, totalPages: 1 })
    })

    test('debe pasar page/limit junto con filtros existentes', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        // ACT
        const app = createApp(model as any)
        await request(app).get('/movies?page=1&limit=5&genre=action&sort=year&order=desc')

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({
                page: '1', limit: 5, offset: 0, genre: 'action', sort: 'year', order: 'desc'
            })
        )
    })

    test('debe devolver 500 si el modelo falla', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockRejectedValue(new Error('DB error'))

        // ACT
        const app = createApp(model as any)
        const res = await request(app).get('/movies?page=1&limit=5')

        // ASSERT
        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('MovieService - getMovies con page/limit (servicio)', () => {
    function createMockModel() {
        return { getMovies: jest.fn().mockName('getMovies') } as any
    }

    test('debe usar defaults page=1 limit=10 si no se envían', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({})

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        )
    })

    test('debe usar defaults cuando solo se envía page', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({ page: '3' })

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 20, page: '3' })
        )
    })

    test('debe usar defaults cuando solo se envía limit', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({ limit: '5' })

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 5, offset: 0 })
        )
    })

    test('debe calcular offset correctamente: page=3 limit=10 => offset=20', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({ page: '3', limit: '10' })

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 20 })
        )
    })

    test('debe calcular offset correctamente: page=5 limit=5 => offset=20', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({ page: '5', limit: '5' })

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ offset: 20 })
        )
    })

    test('debe envolver resultado en { data, meta } con totalPages calculado', async () => {
        // ARRANGE
        const model = createMockModel()
        const fakeRows = [
            { id: 1, title: 'A', year: 2000, director: 'D', rating: 5, duration: 100, plot: 'P', poster: 'U', genres: 'Drama' },
            { id: 2, title: 'B', year: 2001, director: 'D', rating: 6, duration: 110, plot: 'P', poster: 'U', genres: 'Action' },
            { id: 3, title: 'C', year: 2002, director: 'D', rating: 7, duration: 120, plot: 'P', poster: 'U', genres: 'Sci-Fi' },
        ]
        model.getMovies.mockResolvedValue({ rows: fakeRows, total: 8 })
        const service = new MovieService(model)

        // ACT
        const result = await service.getMovies({ page: '1', limit: '3' })

        // ASSERT
        expect(result).toEqual({
            data: fakeRows,
            meta: { total: 8, page: 1, limit: 3, totalPages: 3 }
        })
    })

    test('debe calcular totalPages = 1 cuando total < limit', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [{ id: 1, title: 'X', year: 2020, director: 'D', rating: 5, duration: 100, plot: 'P', poster: 'U', genres: 'Drama' }], total: 2 })
        const service = new MovieService(model)

        // ACT
        const result = await service.getMovies({ page: '1', limit: '5' })

        // ASSERT
        expect(result.meta.totalPages).toBe(1)
    })

    // --- VALIDACIONES: page ---

    test('debe lanzar AppError 400 si page es 0', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: '0' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page es negativo: -1', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: '-1' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page no es número: abc', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: 'abc' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page es decimal: 2.5', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: '2.5' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page es un array (params duplicados)', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: ['1', '2'] as any }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page es string vacío', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ page: '' }))
            .rejects.toThrow(AppError)
    })

    // --- VALIDACIONES: limit ---

    test('debe lanzar AppError 400 si limit es 0', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: '0' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si limit es negativo: -5', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: '-5' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si limit excede máximo: 101', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: '101' }))
            .rejects.toThrow(AppError)
    })

    test('debe aceptar limit=100 (valor máximo permitido)', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockResolvedValue({ rows: [], total: 200 })
        const service = new MovieService(model)

        // ACT
        await service.getMovies({ limit: '100' })

        // ASSERT
        expect(model.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 100 })
        )
    })

    test('debe lanzar AppError 400 si limit no es número: abc', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: 'abc' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si limit es decimal: 5.5', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: '5.5' }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si limit es un array (params duplicados)', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: ['5', '10'] as any }))
            .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si limit es string vacío', async () => {
        // ARRANGE
        const service = new MovieService(createMockModel())

        // ACT + ASSERT
        await expect(service.getMovies({ limit: '' }))
            .rejects.toThrow(AppError)
    })

    // --- PROPAGACIÓN DE ERRORES ---

    test('debe propagar AppError del modelo sin modificarlo', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockRejectedValue(new AppError('error del modelo', 400))
        const service = new MovieService(model)

        // ACT + ASSERT
        await expect(service.getMovies({ page: '1', limit: '5' }))
            .rejects.toThrow(AppError)
    })

    test('debe envolver errores genéricos del modelo en AppError 500', async () => {
        // ARRANGE
        const model = createMockModel()
        model.getMovies.mockRejectedValue(new Error('connection lost'))
        const service = new MovieService(model)

        // ACT + ASSERT
        try {
            await service.getMovies({ page: '1', limit: '5' })
            expect('no debió llegar').toBe('nunca')
        } catch (error) {
            expect(error).toBeInstanceOf(AppError)
            expect((error as AppError).statusCode).toBe(500)
        }
    })
})

describe('MovieModel - getMovies con page/limit (modelo)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir LIMIT 5 OFFSET 0 en SQL', async () => {
        // ARRANGE
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        // ACT
        await model.getMovies({ limit: 5, offset: 0 })

        // ASSERT
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([5, 0])
    })

    test('debe incluir LIMIT 10 OFFSET 20 en SQL para page=3 limit=10', async () => {
        // ARRANGE
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        // ACT
        await model.getMovies({ limit: 10, offset: 20 })

        // ASSERT
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([10, 20])
    })

    test('debe combinar LIMIT/OFFSET con WHERE y ORDER BY', async () => {
        // ARRANGE
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        // ACT
        await model.getMovies({
            genre: 'action', sort: 'year', order: 'desc',
            limit: 5, offset: 0
        })

        // ASSERT
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('WHERE')
        expect(selectQuery).toContain('ORDER BY')
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(selectQuery.indexOf('ORDER BY')).toBeLessThan(selectQuery.indexOf('LIMIT'))
    })

    test('debe ejecutar COUNT(*) además del SELECT principal', async () => {
        // ARRANGE
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 8 }]])
            .mockResolvedValueOnce([[]])

        // ACT
        const result = await model.getMovies({ limit: 5, offset: 0 })

        // ASSERT
        const countQuery  = conn.query.mock.calls[0][0] as string
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(countQuery).toMatch(/COUNT/i)
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual([5, 0])
        expect(result).toEqual({ rows: [], total: 8 })
    })

    test('debe manejar LIMIT/OFFSET con filtros y ORDER BY', async () => {
        // ARRANGE
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 5 }]])
            .mockResolvedValueOnce([[]])

        // ACT
        const result = await model.getMovies({ genre: 'action', sort: 'year', order: 'desc', limit: 10, offset: 0 })

        // ASSERT
        const selectQuery = conn.query.mock.calls[1][0] as string
        expect(selectQuery).toContain('WHERE')
        expect(selectQuery).toContain('ORDER BY')
        expect(selectQuery).toContain('LIMIT ? OFFSET ?')
        expect(conn.query.mock.calls[1][1]).toEqual(['action', 10, 0])
        expect(result).toEqual({ rows: [], total: 5 })
    })
})
