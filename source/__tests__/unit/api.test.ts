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
        getSimilarMovies: jest.fn().mockName('getSimilarMovies'),
    }
}

afterEach(() => {
    jest.restoreAllMocks()
})

describe('GET /movies', () => {
    test('debe devolver lista de películas con status 200', async () => {
        const service = createMockService()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: ['Action', 'Sci-Fi'], ageRating: 'PG-13' }
        ]
        service.getMovies.mockResolvedValue({ data: fakeMovies, meta: { total: 1, page: 1, limit: 10, totalPages: 1 } })

        const app = createApp(service as any)
        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            data: fakeMovies,
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })
    })

    test('debe devolver 500 si el servicio falla', async () => {
        const service = createMockService()
        service.getMovies.mockRejectedValue(new Error('DB error'))

        const app = createApp(service as any)
        const res = await request(app).get('/movies')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('GET /movies/:id', () => {
    test('debe devolver una película con status 200', async () => {
        const service = createMockService()
        const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: ['Action', 'Sci-Fi'], ageRating: 'PG-13' }
        service.getMovieById.mockResolvedValue(fakeMovie)

        const app = createApp(service as any)
        const res = await request(app).get('/movies/1')

        expect(res.status).toBe(200)
        expect(res.body).toEqual(fakeMovie)
    })

    test('debe devolver 404 si no existe', async () => {
        const service = createMockService()
        service.getMovieById.mockRejectedValue(new (require('../../utils/AppError').default)('Película no encontrada', 404))

        const app = createApp(service as any)
        const res = await request(app).get('/movies/999')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies', () => {
    test('debe crear y devolver la película completa con id y status 201', async () => {
        const service = createMockService()
        const fakeCreatedMovie = {
            id: 9,
            title: 'New Movie',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'A plot',
            poster: 'https://example.com/poster.jpg',
            director: 'New Director',
            genres: ['Drama'],
            ageRating: 'PG-13'
        }
        service.createMovie.mockResolvedValue(fakeCreatedMovie)

        const newMovie = {
            title: 'New Movie',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'A plot',
            poster: 'https://example.com/poster.jpg',
            director: 'New Director',
            genre: ['Drama'],
            available: true
        }

        const app = createApp(service as any)
        const res = await request(app).post('/movies').set(AUTH).send(newMovie)

        expect(res.status).toBe(201)
        expect(res.body).toEqual({
            message: 'Pelicula creada con exito',
            data: fakeCreatedMovie
        })
    })

    test('debe devolver 400 si falla validación', async () => {
        const service = createMockService()
        const invalidMovie = { title: 'No year' }

        const app = createApp(service as any)
        const res = await request(app).post('/movies').set(AUTH).send(invalidMovie)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 500 si el servicio falla', async () => {
        const service = createMockService()
        service.createMovie.mockRejectedValue(new Error('DB error'))

        const newMovie = {
            title: 'Error Movie',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'A plot',
            poster: 'https://example.com/poster.jpg',
            director: 'New Director',
            genre: ['Drama'],
            available: true
        }

        const app = createApp(service as any)
        const res = await request(app).post('/movies').set(AUTH).send(newMovie)

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('PATCH /movies/:id', () => {
    test('debe actualizar y devolver status 200', async () => {
        const service = createMockService()
        const updatedMovie = { id: 1, title: 'Updated Title', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: ['Action'], ageRating: 'PG-13' }
        service.updateMovie.mockResolvedValue(updatedMovie)

        const app = createApp(service as any)
        const res = await request(app).patch('/movies/1').set(AUTH).send({ title: 'Updated Title' })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
    })

    test('debe devolver 404 si la película no existe', async () => {
        const service = createMockService()
        service.updateMovie.mockRejectedValue(new (require('../../utils/AppError').default)('Película no encontrada', 404))

        const app = createApp(service as any)
        const res = await request(app).patch('/movies/999').set(AUTH).send({ title: 'Nope' })

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})

describe('DELETE /movies/:id', () => {
    test('debe borrar y devolver status 200', async () => {
        const service = createMockService()
        service.deleteMovie.mockResolvedValue(undefined)

        const app = createApp(service as any)
        const res = await request(app).delete('/movies/1').set(AUTH)

        expect(res.status).toBe(200)
    })

    test('debe devolver 404 si no existe', async () => {
        const service = createMockService()
        service.deleteMovie.mockRejectedValue(new (require('../../utils/AppError').default)('Película no encontrada', 404))

        const app = createApp(service as any)
        const res = await request(app).delete('/movies/999').set(AUTH)

        expect(res.status).toBe(404)
    })
})

describe('GET /movies/:id/similar', () => {
    test('debe devolver status 200 con la estructura esperada', async () => {
        const service = createMockService()
        const fakeSimilar = [
            { id: 8, title: 'The Dark Knight Rises', year: 2012, rating: 8.4, genres: ['action', 'drama'], director: 'Christopher Nolan', similarityScore: 6 },
        ]
        service.getSimilarMovies.mockResolvedValue({
            data: fakeSimilar,
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })

        const app = createApp(service as any)
        const res = await request(app).get('/movies/2/similar')

        expect(res.status).toBe(200)
        expect(res.body).toEqual({
            data: fakeSimilar,
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })
    })

    test('debe pasar page y limit como query params', async () => {
        const service = createMockService()
        service.getSimilarMovies.mockResolvedValue({
            data: [],
            meta: { total: 0, page: 2, limit: 5, totalPages: 0 }
        })

        const app = createApp(service as any)
        const res = await request(app).get('/movies/2/similar?page=2&limit=5')

        expect(service.getSimilarMovies).toHaveBeenCalledWith(2, 2, 5)
        expect(res.status).toBe(200)
    })

    test('debe devolver 404 si la película no existe', async () => {
        const service = createMockService()
        service.getSimilarMovies.mockRejectedValue(
            new (require('../../utils/AppError').default)('Película no encontrada', 404)
        )

        const app = createApp(service as any)
        const res = await request(app).get('/movies/999/similar')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })

    test('debe devolver 500 si el servicio falla', async () => {
        const service = createMockService()
        service.getSimilarMovies.mockRejectedValue(new Error('DB error'))

        const app = createApp(service as any)
        const res = await request(app).get('/movies/1/similar')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('404 - rutas no encontradas', () => {
    test('debe devolver 404 para rutas inexistentes', async () => {
        const service = createMockService()
        const app = createApp(service as any)
        const res = await request(app).get('/nonexistent')

        expect(res.status).toBe(404)
        expect(res.text).toBe('Ruta no encontrada')
    })
})
