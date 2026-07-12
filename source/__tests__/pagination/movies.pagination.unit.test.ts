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
        //   crear mock model
        //   model.getMovies.mockResolvedValue({ rows: [], total: 0 })

        // ACT
        //   supertest GET /movies?page=2&limit=5

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith(
        //     expect.objectContaining({ page: '2', limit: '5' })
        //   )
    })

    test('debe devolver respuesta con estructura { data, meta }', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [3 pelis mock], total: 8 })

        // ACT
        //   supertest GET /movies?page=1&limit=3

        // ASSERT
        //   res.status = 200
        //   res.body = {
        //     data: [ ... 3 items ... ],
        //     meta: { total: 8, page: 1, limit: 3, totalPages: 3 }
        //   }
    })

    test('no debe pasar page/limit si no están en query', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })

        // ACT
        //   supertest GET /movies

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith({})
        //   (sin page, sin limit)
    })

    test('debe envolver data vacío cuando no hay resultados', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 8 })

        // ACT
        //   supertest GET /movies?page=99&limit=10

        // ASSERT
        //   res.body.data = []
        //   res.body.meta = { total: 8, page: 99, limit: 10, totalPages: 1 }
    })

    test('debe pasar page/limit junto con filtros existentes', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })

        // ACT
        //   supertest GET /movies?page=1&limit=5&genre=action&sort=year&order=desc

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith(
        //     expect.objectContaining({
        //       page: '1', limit: '5', genre: 'action', sort: 'year', order: 'desc'
        //     })
        //   )
    })

    test('debe devolver 500 si el modelo falla', async () => {
        // ARRANGE
        //   mock model.getMovies.rejects(new Error('DB error'))

        // ACT
        //   supertest GET /movies?page=1&limit=5

        // ASSERT
        //   res.status = 500
        //   res.body tiene propiedad 'error'
    })
})

describe('MovieService - getMovies con page/limit (servicio)', () => {
    function createMockModel() {
        return { getMovies: jest.fn().mockName('getMovies') } as any
    }

    test('debe usar defaults page=1 limit=10 si no se envían', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })
        //   service = new MovieService(mockModel)

        // ACT
        //   await service.getMovies({})

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith({ limit: 10, offset: 0 })
    })

    test('debe usar defaults cuando solo se envía page', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })

        // ACT
        //   await service.getMovies({ page: '3' })

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith({ limit: 10, offset: 20, page: '3' })
    })

    test('debe usar defaults cuando solo se envía limit', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })

        // ACT
        //   await service.getMovies({ limit: '5' })

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith({ limit: 5, offset: 0, ... })
    })

    test('debe calcular offset correctamente: page=3 limit=10 => offset=20', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [], total: 0 })

        // ACT
        //   await service.getMovies({ page: '3', limit: '10' })

        // ASSERT
        //   model.getMovies toHaveBeenCalledWith(
        //     expect.objectContaining({ limit: 10, offset: 20 })
        //   )
    })

    test('debe calcular offset correctamente: page=5 limit=5 => offset=20', async () => {
        // ARRANGE + ACT + ASSERT similares
    })

    test('debe envolver resultado en { data, meta } con totalPages calculado', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [3 pelis mock], total: 8 })

        // ACT
        //   resultado = await service.getMovies({ page: '1', limit: '3' })

        // ASSERT
        //   resultado = {
        //     data: [ ... 3 items ... ],
        //     meta: { total: 8, page: 1, limit: 3, totalPages: 3 }
        //   }
    })

    test('debe calcular totalPages = 1 cuando total < limit', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: [2 pelis], total: 2 })

        // ACT
        //   resultado = await service.getMovies({ page: '1', limit: '5' })

        // ASSERT
        //   resultado.meta.totalPages = 1
    })

    // --- VALIDACIONES: page ---

    test('debe lanzar AppError 400 si page es 0', async () => {
        // ARRANGE
        //   service = new MovieService(mockModel)

        // ACT + ASSERT
        //   await expect(service.getMovies({ page: '0' }))
        //     .rejects.toThrow(AppError)
    })

    test('debe lanzar AppError 400 si page es negativo: -1', async () => {
        // ARRANGE + ACT + ASSERT: page='-1' → AppError 400
    })

    test('debe lanzar AppError 400 si page no es número: abc', async () => {
        // ARRANGE + ACT + ASSERT: page='abc' → AppError 400
    })

    test('debe lanzar AppError 400 si page es decimal: 2.5', async () => {
        // ARRANGE + ACT + ASSERT: page='2.5' → AppError 400
    })

    test('debe lanzar AppError 400 si page es un array (params duplicados)', async () => {
        // ARRANGE + ACT + ASSERT: page=['1', '2'] as any → AppError 400
    })

    test('debe lanzar AppError 400 si page es string vacío', async () => {
        // ARRANGE + ACT + ASSERT: page='' → AppError 400
    })

    // --- VALIDACIONES: limit ---

    test('debe lanzar AppError 400 si limit es 0', async () => {
        // ARRANGE + ACT + ASSERT: limit='0' → AppError 400
    })

    test('debe lanzar AppError 400 si limit es negativo: -5', async () => {
        // ARRANGE + ACT + ASSERT: limit='-5' → AppError 400
    })

    test('debe lanzar AppError 400 si limit excede máximo: 101', async () => {
        // ARRANGE + ACT + ASSERT: limit='101' → AppError 400
    })

    test('debe aceptar limit=100 (valor máximo permitido)', async () => {
        // ARRANGE
        //   mock model.getMovies.resolves({ rows: 100 pelis mock, total: 200 })

        // ACT
        //   await service.getMovies({ limit: '100' })

        // ASSERT
        //   modelo llamado con limit=100
    })

    test('debe lanzar AppError 400 si limit no es número: abc', async () => {
        // ARRANGE + ACT + ASSERT: limit='abc' → AppError 400
    })

    test('debe lanzar AppError 400 si limit es decimal: 5.5', async () => {
        // ARRANGE + ACT + ASSERT: limit='5.5' → AppError 400
    })

    test('debe lanzar AppError 400 si limit es un array (params duplicados)', async () => {
        // ARRANGE + ACT + ASSERT: limit=['5', '10'] as any → AppError 400
    })

    test('debe lanzar AppError 400 si limit es string vacío', async () => {
        // ARRANGE + ACT + ASSERT: limit='' → AppError 400
    })

    // --- PROPAGACIÓN DE ERRORES ---

    test('debe propagar AppError del modelo sin modificarlo', async () => {
        // ARRANGE
        //   mock model.getMovies.rejects(new AppError('error del modelo', 400))

        // ACT + ASSERT
        //   await expect(service.getMovies({ page: '1', limit: '5' }))
        //     .rejects.toThrow(AppError)
    })

    test('debe envolver errores genéricos del modelo en AppError 500', async () => {
        // ARRANGE
        //   mock model.getMovies.rejects(new Error('connection lost'))

        // ACT + ASSERT
        //   try { await service.getMovies({ page: '1', limit: '5' }) }
        //   catch (e) { expect(e).toBeInstanceOf(AppError); expect(e.statusCode).toBe(500) }
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
        //   conn = createMockConnection()
        //   model = new MovieModel(conn)
        //   conn.query.mockResolvedValue([[]])

        // ACT
        //   await model.getMovies({ limit: 5, offset: 0 })

        // ASSERT
        //   queryStr = conn.query.mock.calls[0][0] como string
        //   expect(queryStr).toContain('LIMIT 5 OFFSET 0')
    })

    test('debe incluir LIMIT 10 OFFSET 20 en SQL para page=3 limit=10', async () => {
        // ARRANGE + ACT + ASSERT similar, verificar 'LIMIT 10 OFFSET 20'
    })

    test('debe combinar LIMIT/OFFSET con WHERE y ORDER BY', async () => {
        // ARRANGE
        //   conn = createMockConnection()
        //   model = new MovieModel(conn)
        //   conn.query.mockResolvedValue([[]])

        // ACT
        //   await model.getMovies({
        //     genre: 'action', sort: 'year', order: 'desc',
        //     limit: 5, offset: 0
        //   })

        // ASSERT
        //   queryStr contiene WHERE
        //   queryStr contiene ORDER BY
        //   queryStr contiene LIMIT 5 OFFSET 0
        //   ORDER BY aparece ANTES que LIMIT
    })

    test('debe ejecutar COUNT(*) además del SELECT principal', async () => {
        // ARRANGE
        //   conn.query
        //     .mockResolvedValueOnce([[{ total: 8 }]])   // COUNT query
        //     .mockResolvedValueOnce([[]])                // SELECT query

        // ACT
        //   resultado = await model.getMovies({ limit: 5, offset: 0 })

        // ASSERT
        //   primera llamada a query contiene 'COUNT(*)' o 'COUNT(1)'
        //   segunda llamada a query contiene 'LIMIT 5 OFFSET 0'
        //   resultado = { rows: [], total: 8 }
    })

    test('debe mantener compatibilidad cuando NO se pasan page/limit', async () => {
        // ARRANGE
        //   conn.query.mockResolvedValue([[...filas]])
        //   totalMock = 0 (no se usa COUNT si no hay page/limit)

        // ACT
        //   resultado = await model.getMovies({})

        // ASSERT
        //   queryStr NO contiene LIMIT
        //   resultado = filas (comportamiento actual, sin paginar)
    })

    test('no debe inyectar LIMIT/OFFSET si no se pasan (compatibilidad con sort/filtros)', async () => {
        // ARRANGE + ACT + ASSERT similar al anterior pero con sort y genre
    })
})
