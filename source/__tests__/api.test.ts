jest.mock('mysql2', () => {
  const mockQuery = jest.fn()
  const mockBeginTransaction = jest.fn()
  const mockCommit = jest.fn()
  const mockRollback = jest.fn()

  return {
    createConnection: jest.fn(() => ({
      promise: () => ({
        query: mockQuery,
        beginTransaction: mockBeginTransaction,
        commit: mockCommit,
        rollback: mockRollback
      })
    }))
  }
})

import request from 'supertest'
import express from 'express'
import moviesRouter from '../routes/movieRoutes'
import AppError from '../utils/AppError'

const app = express()
app.disable('x-powered-by')
app.use(express.json())
app.use('/movies', moviesRouter)
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  const statusCode = err instanceof AppError ? err.statusCode : 500
  res.status(statusCode).json({ error: err.message })
})
app.use((req: express.Request, resp: express.Response) => {
  resp.status(404).send('Ruta no encontrada')
})

import mysql from 'mysql2'
const mockConnection = (mysql.createConnection as jest.Mock)()
const mockPromiseApi = mockConnection.promise()
const mockQuery = mockPromiseApi.query as jest.Mock
const mockBeginTransaction = mockPromiseApi.beginTransaction as jest.Mock
const mockCommit = mockPromiseApi.commit as jest.Mock
const mockRollback = mockPromiseApi.rollback as jest.Mock

beforeEach(() => {
  mockQuery.mockReset()
  mockBeginTransaction.mockReset()
  mockCommit.mockReset()
  mockRollback.mockReset()
})

describe('GET /movies', () => {
  test('debe devolver lista de películas con status 200', async () => {
    const fakeMovies = [
      { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
    ]
    mockQuery.mockResolvedValue([fakeMovies])

    const res = await request(app).get('/movies')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(fakeMovies)
  })

  test('debe devolver 500 si la query falla', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))

    const res = await request(app).get('/movies')

    expect(res.status).toBe(500)
    expect(res.body).toHaveProperty('error')
  })
})

describe('GET /movies/:id', () => {
  test('debe devolver una película con status 200', async () => {
    const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
    mockQuery.mockResolvedValue([[fakeMovie]])

    const res = await request(app).get('/movies/1')

    expect(res.status).toBe(200)
    expect(res.body).toEqual(fakeMovie)
  })

  test('debe devolver 404 si no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const res = await request(app).get('/movies/999')

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('error')
  })
})

describe('POST /movies', () => {
  test('debe crear una película con status 201', async () => {
    mockQuery
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 20 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 30 }])

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

    const res = await request(app).post('/movies').send(newMovie)

    expect(res.status).toBe(201)
    expect(res.body).toHaveProperty('message', 'Pelicula creada con exito')
  })

  test('debe devolver 400 si falla validación', async () => {
    const invalidMovie = { title: 'No year' }

    const res = await request(app).post('/movies').send(invalidMovie)

    expect(res.status).toBe(400)
    expect(res.body).toHaveProperty('error')
  })
})

describe('PATCH /movies/:id', () => {
  test('debe actualizar y devolver status 200', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 1 }]])   // SELECT existe
      .mockResolvedValueOnce([{}])              // UPDATE
      .mockResolvedValueOnce([[{ id: 1, title: 'Updated Title', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action' }]])  // getMovieById

    const res = await request(app).patch('/movies/1').send({ title: 'Updated Title' })

    expect(res.status).toBe(200)
    expect(res.body).toHaveProperty('message')
  })

  test('debe devolver 404 si la película no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const res = await request(app).patch('/movies/999').send({ title: 'Nope' })

    expect(res.status).toBe(404)
    expect(res.body).toHaveProperty('message')
  })
})

describe('DELETE /movies/:id', () => {
  test('debe borrar y devolver status 200', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])

    const res = await request(app).delete('/movies/1')

    expect(res.status).toBe(200)
  })

  test('debe devolver 404 si no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const res = await request(app).delete('/movies/999')

    expect(res.status).toBe(404)
  })
})

describe('404 - rutas no encontradas', () => {
  test('debe devolver 404 para rutas inexistentes', async () => {
    const res = await request(app).get('/nonexistent')

    expect(res.status).toBe(404)
    expect(res.text).toBe('Ruta no encontrada')
  })
})
