import mysql from 'mysql2'
import MovieModel from '../models/Movie-mysql'

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

const mockQuery = (mysql.createConnection as jest.Mock)().promise().query as jest.Mock
const mockBeginTransaction = (mysql.createConnection as jest.Mock)().promise().beginTransaction as jest.Mock
const mockCommit = (mysql.createConnection as jest.Mock)().promise().commit as jest.Mock
const mockRollback = (mysql.createConnection as jest.Mock)().promise().rollback as jest.Mock

describe('MovieModel - getMovies', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe devolver lista de películas', async () => {
    const fakeMovies = [
      { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
    ]
    mockQuery.mockResolvedValue([fakeMovies])

    const result = await MovieModel.getMovies()

    expect(result).toEqual(fakeMovies)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  test('debe filtrar por año', async () => {
    mockQuery.mockResolvedValue([[]])

    await MovieModel.getMovies({ year: '1994' })

    const queryStr = mockQuery.mock.calls[0][0]
    expect(queryStr).toContain('m.year = ?')
    expect(mockQuery.mock.calls[0][1]).toContain('1994')
  })

  test('debe filtrar por género', async () => {
    mockQuery.mockResolvedValue([[]])

    await MovieModel.getMovies({ genre: 'Action' })

    const queryStr = mockQuery.mock.calls[0][0]
    expect(queryStr).toContain('genre_name = ?')
    expect(mockQuery.mock.calls[0][1]).toContain('Action')
  })

  test('debe lanzar AppError si la query falla', async () => {
    mockQuery.mockRejectedValue(new Error('DB error'))

    await expect(MovieModel.getMovies()).rejects.toThrow()
  })
})

describe('MovieModel - getMovieById', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe devolver una película por id', async () => {
    const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
    mockQuery.mockResolvedValue([[fakeMovie]])

    const result = await MovieModel.getMovieById('1')

    expect(result).toEqual(fakeMovie)
    expect(mockQuery).toHaveBeenCalledTimes(1)
  })

  test('debe devolver null si no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const result = await MovieModel.getMovieById('999')

    expect(result).toBeNull()
  })
})

describe('MovieModel - createMovie', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe crear una película con director y géneros nuevos', async () => {
    const movieInput = {
      result: {
        data: {
          title: 'New Movie',
          year: 2024,
          rating: 7.5,
          duration: 120,
          plot: 'A plot',
          poster: 'https://example.com/poster.jpg',
          director: 'New Director',
          genre: ['Drama', 'Comedy'],
          available: true
        }
      }
    }

    mockQuery
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 10 }])
      .mockResolvedValueOnce([{ insertId: 1 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 20 }])
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 30 }])

    await MovieModel.createMovie(movieInput)

    expect(mockBeginTransaction).toHaveBeenCalled()
    expect(mockCommit).toHaveBeenCalled()
  })

  test('debe hacer rollback si falla', async () => {
    mockQuery.mockRejectedValue(new Error('Insert error'))

    const movieInput = {
      result: {
        data: {
          title: 'Fail Movie',
          year: 2024,
          rating: 5.0,
          duration: 100,
          plot: '...',
          poster: 'https://example.com/poster.jpg',
          director: 'Unknown',
          genre: ['Action'],
          available: true
        }
      }
    }

    await expect(MovieModel.createMovie(movieInput)).rejects.toThrow()
    expect(mockRollback).toHaveBeenCalled()
  })
})

describe('MovieModel - updateMovie', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe devolver null si la película no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const result = await MovieModel.updateMovie({ id: '999', result: { data: { title: 'Updated' } } })

    expect(result).toBeNull()
  })
})

describe('MovieModel - deleteMovie', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  test('debe devolver null si la película no existe', async () => {
    mockQuery.mockResolvedValue([[]])

    const result = await MovieModel.deleteMovie('999')

    expect(result).toBeNull()
  })

  test('debe borrar y devolver true si existe', async () => {
    mockQuery
      .mockResolvedValueOnce([[{ id: 1 }]])
      .mockResolvedValueOnce([{}])
      .mockResolvedValueOnce([{}])

    const result = await MovieModel.deleteMovie('1')

    expect(result).toBe(true)
    expect(mockCommit).toHaveBeenCalled()
  })
})
