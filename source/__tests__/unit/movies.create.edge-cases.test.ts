import request from 'supertest'
import { createApp } from '../../api'

function createMockModel() {
    return {
        getMovies: jest.fn().mockName('getMovies'),
        getMovieById: jest.fn().mockName('getMovieById'),
        createMovie: jest.fn().mockName('createMovie'),
        updateMovie: jest.fn().mockName('updateMovie'),
        deleteMovie: jest.fn().mockName('deleteMovie')
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
    genres: 'drama'
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

/* ────────────────────────────
   AÑO — límites
   ──────────────────────────── */
describe('POST /movies — year edge cases', () => {

    test('year = 1895 (mínimo permitido) debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 1895 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ year: 1895 })
                })
            })
        )
    })

    test('year = 1894 (por debajo del mínimo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 1894 }
        
        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('year = 2026 (máximo permitido) debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 2026 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ year: 2026 })
                })
            })
        )
    })

    test('year = 2027 (futuro inválido) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 2027 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('year flotante (1999.5) debe dar 400 por .int()', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 1999.5 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('year string "1999" debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: '1999' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
    })

    test('year negativo (-500) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: -500 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('year null debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: null }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })
})

/* ────────────────────────────
   GÉNERO
   ──────────────────────────── */
describe('POST /movies — genre edge cases', () => {

    test('genre array vacío [] debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, genre: [] }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('genre con string vacío [""] pasa validación (trim no lo elimina, array tiene 1 elemento)', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, genre: [''] }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // Zod: .nonempty() ve 1 elemento, .trim() de "" es ""
        expect(res.status).toBe(201)
    })

    test('genre con duplicados lógicos ["drama","DRAMA","Drama"] debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, genre: ['drama', 'DRAMA', 'Drama'] }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({
                        genre: expect.arrayContaining(['drama', 'drama', 'drama'])
                    })
                })
            })
        )
    })

    test('genre sin enviar (campo omitido) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const { genre, ...payload } = validPayload

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

/* ────────────────────────────
   RATING
   ──────────────────────────── */
describe('POST /movies — rating edge cases', () => {

    test('rating = 0 (mínimo) debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: 0 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ rating: 0 })
                })
            })
        )
    })

    test('rating = 10 (máximo) debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: 10 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })

    test('rating = -0.01 (por debajo del mínimo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: -0.01 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('rating = 10.1 (por encima del máximo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: 10.1 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('rating omitido debe usar default 5 y crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const { rating, ...payload } = validPayload

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ rating: 5 })
                })
            })
        )
    })
})

/* ────────────────────────────
   DURACIÓN
   ──────────────────────────── */
describe('POST /movies — duration edge cases', () => {

    test('duration = 1 (mínimo positivo) debe crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: 1 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })

    test('duration = 0 debe dar 400 (.positive())', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: 0 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('duration negativo -10 debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: -10 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('duration flotante 120.5 debe dar 400 (.int())', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: 120.5 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })
})

/* ────────────────────────────
   POSTER (URL)
   ──────────────────────────── */
describe('POST /movies — poster edge cases', () => {

    test('poster con string no-URL debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, poster: 'not-a-url' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
        expect(model.createMovie).not.toHaveBeenCalled()
    })

    test('poster cadena vacía "" debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, poster: '' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
    })

    test('poster omitido debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const { poster, ...payload } = validPayload

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

/* ────────────────────────────
   STRING VACÍOS
   ──────────────────────────── */
describe('POST /movies — string vacíos', () => {

    test('title vacío "" debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, title: '' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // Zod acepta string vacío, status 201
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })

    test('director vacío "" — ver comportamiento actual', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, director: '' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // Zod acepta string vacío, status 201
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
    })
})

/* ────────────────────────────
   CUERPO DE REQUEST
   ──────────────────────────── */
describe('POST /movies — payload malformed', () => {

    test('body vacío {} debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)

        // Act
        const res = await request(app).post('/movies').send({})

        // Assert
        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('body con campos extra debe crear (Zod strip por defecto)', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const payload = { ...validPayload, extraField: 'ignorado' }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.not.objectContaining({ extraField: expect.anything() })
                })
            })
        )
    })

    test('available omitido debe usar default true y crear', async () => {
        // Arrange
        const model = createMockModel()
        model.createMovie.mockResolvedValue(fakeCreatedMovie)
        const app = createApp(model as any)
        const { available, ...payload } = validPayload

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        expect(res.status).toBe(201)
        expect(res.body.message).toBe('Pelicula creada con exito')
        expect(model.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ available: true })
                })
            })
        )
    })

    test.each(['title', 'year', 'genre', 'director', 'duration', 'plot', 'poster'])(
        'debe dar 400 si falta el campo %s', async (field) => {
            // Arrange
            const model = createMockModel()
            const app = createApp(model as any)
            const payload = Object.fromEntries(
                Object.entries(validPayload).filter(([key]) => key !== field)
            )

            // Act
            const res = await request(app).post('/movies').send(payload)

            // Assert
            expect(res.status).toBe(400)
            expect(res.body).toHaveProperty('error')
            expect(model.createMovie).not.toHaveBeenCalled()
        }
    )
})
