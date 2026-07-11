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
        // ? verificar status 201
        // ? verificar body.message
        // ? verificar que createMovie fue llamado con year: 1895
    })

    test('year = 1894 (por debajo del mínimo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 1894 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
        // ? body tiene propiedad 'error'
        // ? createMovie NO fue llamado
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
        // ? status 201
    })

    test('year = 2027 (futuro inválido) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 2027 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
        // ? body tiene 'error'
    })

    test('year flotante (1999.5) debe dar 400 por .int()', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: 1999.5 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
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
        // ? status 400
    })

    test('year null debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, year: null }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
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
        // ? status 400
    })

    test('genre con string vacío [""] debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, genre: [''] }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400 (tras trim queda "" o el transform lo deja vacío)
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
        // ? status 201
        // ? verificar qué recibe el modelo (posibles duplicados)
    })

    test('genre sin enviar (campo omitido) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const { genre, ...payload } = validPayload

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
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
        // ? status 201
        // ? createMovie llamado con rating: 0
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
        // ? status 201
    })

    test('rating = -0.01 (por debajo del mínimo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: -0.01 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
    })

    test('rating = 10.1 (por encima del máximo) debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, rating: 10.1 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
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
        // ? status 201
        // ? createMovie llamado con rating: 5
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
        // ? status 201
    })

    test('duration = 0 debe dar 400 (.positive())', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: 0 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
    })

    test('duration negativo -10 debe dar 400', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: -10 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
    })

    test('duration flotante 120.5 debe dar 400 (.int())', async () => {
        // Arrange
        const model = createMockModel()
        const app = createApp(model as any)
        const payload = { ...validPayload, duration: 120.5 }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 400
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
        // ? status 400
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
        // ? status 400
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
        // ? status 400 (actualmente Zod acepta string vacío — verificar comportamiento)
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
        // ? status (Zod acepta string vacío — decidir si se requiere .min(1))
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
        // ? status 400
        // ? body tiene 'error'
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
        // ? status 201
        // ? createMovie NO recibió extraField
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
        // ? status 201
        // ? createMovie llamado con available: true
    })

    test('cad uno de los 7 campos requeridos faltando por separado debe dar 400', () => {
        // Arrange
        const requiredFields = ['title', 'year', 'genre', 'director', 'duration', 'plot', 'poster']

        requiredFields.forEach(async (field) => {
            const model = createMockModel()
            const app = createApp(model as any)
            const { [field]: _, ...payload } = validPayload

            // Act
            const res = await request(app).post('/movies').send(payload)

            // Assert
            // ? status = 400 para cada campo faltante
        })
    })
})
