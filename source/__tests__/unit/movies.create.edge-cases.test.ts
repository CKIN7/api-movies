import request from 'supertest'
import { createApp } from '../../api'
import { authHeader } from '../helpers/auth'

const AUTH = authHeader()

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

const fakeCreatedMovie = {
    id: 9,
    title: 'Edge Test',
    year: 2024,
    rating: 5,
    duration: 100,
    plot: 'Edge case plot',
    poster: 'https://example.com/edge.jpg',
    director: 'Edge Director',
    genres: ['drama'],
    ageRating: 'PG-13'
}

const validPayload = {
    title: 'Edge Test',
    year: 2024,
    rating: 5,
    duration: 100,
    plot: 'Edge case plot',
    poster: 'https://example.com/edge.jpg',
    director: 'Edge Director',
    genre: ['drama'],
    available: true
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe('POST /movies — year edge cases', () => {

    test('year = 1895 (mínimo permitido) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, year: 1895 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ year: 1895 })
        )
    })

    test('year = 1894 (por debajo del mínimo) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: 1894 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('year = 2026 (máximo permitido) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, year: 2026 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ year: 2026 })
        )
    })

    test('year = 2027 (futuro inválido) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: 2027 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('year flotante (1999.5) debe dar 400 por .int()', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: 1999.5 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('year string "1999" debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: '1999' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('year negativo (-500) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: -500 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('year null debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, year: null }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })
})

describe('POST /movies — genre edge cases', () => {

    test('genre array vacío [] debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: [] }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('genre con string vacío [""] debe dar 400 (pipe .min(1) después de trim)', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: [''] }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('genre con duplicados lógicos ["drama","DRAMA","Drama"] debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: ['drama', 'DRAMA', 'Drama'] }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                genre: expect.arrayContaining(['drama', 'drama', 'drama'])
            })
        )
    })

    test('genre sin enviar (campo omitido) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const { genre, ...payload } = validPayload

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies — rating edge cases', () => {

    test('rating = 0 (mínimo) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 0 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ rating: 0 })
        )
    })

    test('rating = 10 (máximo) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 10 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })

    test('rating = -0.01 (por debajo del mínimo) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: -0.01 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('rating = 10.1 (por encima del máximo) debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 10.1 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('rating omitido debe usar default 5 y crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const { rating, ...payload } = validPayload

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ rating: 5 })
        )
    })
})

describe('POST /movies — duration edge cases', () => {

    test('duration = 1 (mínimo positivo) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: 1 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })

    test('duration = 0 debe dar 400 (.positive())', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: 0 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('duration negativo -10 debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: -10 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('duration flotante 120.5 debe dar 400 (.int())', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: 120.5 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })
})

describe('POST /movies — poster edge cases', () => {

    test('poster con string no-URL debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, poster: 'not-a-url' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('poster cadena vacía "" debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, poster: '' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('poster omitido debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const { poster, ...payload } = validPayload

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies — string vacíos', () => {

    test('title vacío "" debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, title: '' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('director vacío "" debe dar 400', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, director: '' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })
})

describe('POST /movies — payload malformed', () => {

    test('body vacío {} debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)

        const res = await request(app).post('/movies').set(AUTH).send({})

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('body con campos extra debe crear (Zod strip por defecto)', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, extraField: 'ignorado' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.not.objectContaining({ extraField: expect.anything() })
        )
    })

    test('available omitido debe usar default true y crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const { available, ...payload } = validPayload

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ available: true })
        )
    })

    test.each(['title', 'year', 'genre', 'director', 'duration', 'plot', 'poster'])(
        'debe dar 400 si falta el campo %s', async (field) => {
            const service = createMockService()
            const app = createApp(service as any)
            const payload = Object.fromEntries(
                Object.entries(validPayload).filter(([key]) => key !== field)
            )

            const res = await request(app).post('/movies').set(AUTH).send(payload)

            expect(res.status).toBe(400)
            expect(res.body).toHaveProperty('error')
            expect(service.createMovie).not.toHaveBeenCalled()
        }
    )
})

describe('POST /movies — trim en strings', () => {

    test('title con espacios alrededor se recorta (si .transform() existe)', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, title: '  Mi Película  ' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Mi Película' })
        )
        expect(res.body.data).toEqual(fakeCreatedMovie)
    })

    test('director con espacios alrededor se recorta (si .transform() existe)', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, director: '  Nolan  ' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(service.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({ director: 'Nolan' })
        )
    })
})

describe('POST /movies — bloqueo de etiquetas HTML', () => {

    test('title con <script> debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, title: "<script>alert('xss')</script>" }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('director con <b> debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, director: '<b>Nolan</b>' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('plot con <p> debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, plot: '<p>html content</p>' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('title con & válido (no HTML) debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, title: 'A & B' }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })
})

describe('POST /movies — rating decimal (.multipleOf)', () => {

    test('rating = 5.55 debe dar 400 (no es múltiplo de 0.1)', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 5.55 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('rating = 5.5 debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 5.5 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })

    test('rating = 7.89 debe dar 400 (no es múltiplo de 0.1)', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 7.89 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('rating = 7.9 debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, rating: 7.9 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })
})

describe('POST /movies — duration max', () => {

    test('duration = 300 debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: 300 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })

    test('duration = 1001 debe dar 400 (supera .max(300))', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, duration: 1001 }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })
})

describe('POST /movies — cantidad de géneros por película', () => {

    test('11 géneros debe dar 400 (supera .max(10))', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: Array.from({ length: 11 }, (_, i) => `genre${i}`) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('10 géneros debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: Array.from({ length: 10 }, (_, i) => `genre${i}`) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
        expect(service.createMovie).toHaveBeenCalledTimes(1)
    })
})

describe('POST /movies — max length en campos de texto', () => {

    test('title con 256 caracteres debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, title: 'a'.repeat(256) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('title con 255 caracteres debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, title: 'a'.repeat(255) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })

    test('director con 256 caracteres debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, director: 'a'.repeat(256) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('genre elemento con 101 caracteres debe dar 400 (supera .max(100))', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: ['a'.repeat(101)] }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('genre elemento con 100 caracteres debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, genre: ['a'.repeat(100)] }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })

    test('plot con 2001 caracteres debe dar 400', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const payload = { ...validPayload, plot: 'a'.repeat(2001) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(service.createMovie).not.toHaveBeenCalled()
    })

    test('plot con 2000 caracteres debe crear', async () => {
        const service = createMockService()
        service.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(service as any)
        const payload = { ...validPayload, plot: 'a'.repeat(2000) }

        const res = await request(app).post('/movies').set(AUTH).send(payload)

        expect(res.status).toBe(201)
    })
})
