import request from 'supertest'
import { createApp } from '../../api'

describe('GET /movies/suggest (controlador)', () => {
    function createMockService() {
        return {
            getMovies: jest.fn().mockName('getMovies'),
            getMovieById: jest.fn().mockName('getMovieById'),
            getSimilar: jest.fn().mockName('getSimilar'),
            getRandom: jest.fn().mockName('getRandom'),
            createMovie: jest.fn().mockName('createMovie'),
            updateMovie: jest.fn().mockName('updateMovie'),
            deleteMovie: jest.fn().mockName('deleteMovie'),
            getAuditLog: jest.fn().mockName('getAuditLog'),
            suggest: jest.fn().mockName('suggest'),
        }
    }

    afterEach(() => { jest.restoreAllMocks() })

    test('debe pasar q, field y limit al servicio', async () => {
        const service = createMockService()
        service.suggest.mockResolvedValue(['Inception'])
        const app = createApp(service as any)

        const res = await request(app).get('/movies/suggest?q=Inc&field=title')

        expect(res.status).toBe(200)
        expect(service.suggest).toHaveBeenCalledWith(
            expect.objectContaining({ q: 'inc', field: 'title', limit: 8 })
        )
        expect(res.body).toEqual(['Inception'])
    })

    test('debe pasar field=director al servicio', async () => {
        const service = createMockService()
        service.suggest.mockResolvedValue(['Christopher Nolan'])
        const app = createApp(service as any)

        const res = await request(app).get('/movies/suggest?q=Chris&field=director')

        expect(res.status).toBe(200)
        expect(service.suggest).toHaveBeenCalledWith(
            expect.objectContaining({ field: 'director' })
        )
    })

    test('debe pasar field=genre al servicio', async () => {
        const service = createMockService()
        service.suggest.mockResolvedValue(['action'])
        const app = createApp(service as any)

        const res = await request(app).get('/movies/suggest?q=act&field=genre')

        expect(res.status).toBe(200)
        expect(service.suggest).toHaveBeenCalledWith(
            expect.objectContaining({ field: 'genre' })
        )
    })

    test('debe pasar limit explícito al servicio', async () => {
        const service = createMockService()
        service.suggest.mockResolvedValue(['The Dark Knight', 'The Dark Knight Rises'])
        const app = createApp(service as any)

        await request(app).get('/movies/suggest?q=The&field=title&limit=2')

        expect(service.suggest).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 2 })
        )
    })

    test('debe devolver 200 con array vacío si no hay resultados', async () => {
        const service = createMockService()
        service.suggest.mockResolvedValue([])
        const app = createApp(service as any)

        const res = await request(app).get('/movies/suggest?q=Zzz&field=title')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([])
    })

    test('debe devolver 400 si q tiene menos de 3 caracteres', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=In&field=title')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si field es inválido', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=actor')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si no se envía q', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?field=title')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si no se envía field', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si no se envía ningún parámetro', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si limit es 0', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=title&limit=0')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si limit excede 20', async () => {
        const app = createApp()

        const res = await request(app).get('/movies/suggest?q=Inc&field=title&limit=21')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 400 si q excede 100 caracteres', async () => {
        const app = createApp()

        const res = await request(app).get(`/movies/suggest?q=${'a'.repeat(101)}&field=title`)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})
