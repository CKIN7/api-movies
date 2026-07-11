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

afterEach(() => {
    jest.restoreAllMocks()
})

describe('GET /movies', () => {
    test('debe devolver lista de películas con status 200', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue([
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ])

        const app = createApp(model as any)
        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(res.body).toEqual([
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ])
    })

    test('debe devolver 500 si el modelo falla', async () => {
        const model = createMockModel()
        model.getMovies.mockRejectedValue(new Error('DB error'))

        const app = createApp(model as any)
        const res = await request(app).get('/movies')

        expect(res.status).toBe(500)
        expect(res.body).toHaveProperty('error')
    })
})

describe('GET /movies/:id', () => {
    test('debe devolver una película con status 200', async () => {
        const model = createMockModel()
        const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        model.getMovieById.mockResolvedValue(fakeMovie)

        const app = createApp(model as any)
        const res = await request(app).get('/movies/1')

        expect(res.status).toBe(200)
        expect(res.body).toEqual(fakeMovie)
    })

    test('debe devolver 404 si no existe', async () => {
        const model = createMockModel()
        model.getMovieById.mockResolvedValue(null)

        const app = createApp(model as any)
        const res = await request(app).get('/movies/999')

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('error')
    })
})

describe('POST /movies', () => {
    test('debe crear una película con status 201', async () => {
        const model = createMockModel()
        model.createMovie.mockResolvedValue(undefined)

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

        const app = createApp(model as any)
        const res = await request(app).post('/movies').send(newMovie)

        expect(res.status).toBe(201)
        expect(res.body).toHaveProperty('message', 'Pelicula creada con exito')
    })

    test('debe devolver 400 si falla validación', async () => {
        const model = createMockModel()
        const invalidMovie = { title: 'No year' }

        const app = createApp(model as any)
        const res = await request(app).post('/movies').send(invalidMovie)

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })
})

describe('PATCH /movies/:id', () => {
    test('debe actualizar y devolver status 200', async () => {
        const model = createMockModel()
        const updatedMovie = { id: 1, title: 'Updated Title', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action' }
        model.updateMovie.mockResolvedValue(updatedMovie)

        const app = createApp(model as any)
        const res = await request(app).patch('/movies/1').send({ title: 'Updated Title' })

        expect(res.status).toBe(200)
        expect(res.body).toHaveProperty('message')
    })

    test('debe devolver 404 si la película no existe', async () => {
        const model = createMockModel()
        model.updateMovie.mockResolvedValue(null)

        const app = createApp(model as any)
        const res = await request(app).patch('/movies/999').send({ title: 'Nope' })

        expect(res.status).toBe(404)
        expect(res.body).toHaveProperty('message')
    })
})

describe('DELETE /movies/:id', () => {
    test('debe borrar y devolver status 200', async () => {
        const model = createMockModel()
        model.deleteMovie.mockResolvedValue(true)

        const app = createApp(model as any)
        const res = await request(app).delete('/movies/1')

        expect(res.status).toBe(200)
    })

    test('debe devolver 404 si no existe', async () => {
        const model = createMockModel()
        model.deleteMovie.mockResolvedValue(null)

        const app = createApp(model as any)
        const res = await request(app).delete('/movies/999')

        expect(res.status).toBe(404)
    })
})

describe('404 - rutas no encontradas', () => {
    test('debe devolver 404 para rutas inexistentes', async () => {
        const model = createMockModel()
        const app = createApp(model as any)
        const res = await request(app).get('/nonexistent')

        expect(res.status).toBe(404)
        expect(res.text).toBe('Ruta no encontrada')
    })
})