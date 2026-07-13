import MovieModel from '../../models/Movie-mysql'

function createMockConnection() {
    const query = jest.fn()
    const beginTransaction = jest.fn()
    const commit = jest.fn()
    const rollback = jest.fn()

    return { query, beginTransaction, commit, rollback } as any
}

describe('MovieModel - getMovies', () => {
    test('debe devolver lista de películas', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)

        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ]
        conn.query
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([fakeMovies])

        const result = await model.getMovies({ limit: 10, offset: 0 })
        expect(result).toEqual({ rows: fakeMovies, total: 1 })
        expect(conn.query).toHaveBeenCalledTimes(2)
    })

    test('debe filtrar por año', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ year: '1994', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.year = ?')
        expect(conn.query.mock.calls[1][1]).toContain('1994')
    })

    test('debe filtrar por género', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await model.getMovies({ genre: 'Action', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('genre_name = ?')
        expect(conn.query.mock.calls[1][1]).toContain('Action')
    })

    test('debe lanzar AppError si la query falla', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockRejectedValue(new Error('DB error'))

        await expect(model.getMovies({ limit: 10, offset: 0 })).rejects.toThrow()
    })
})

describe('MovieModel - getMovieById', () => {
    test('debe devolver una película por id', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)

        const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        conn.query.mockResolvedValue([[fakeMovie]])

        const result = await model.getMovieById('1')
        expect(result).toEqual(fakeMovie)
        expect(conn.query).toHaveBeenCalledTimes(1)
    })

    test('debe devolver null si no existe', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        const result = await model.getMovieById('999')
        expect(result).toBeNull()
    })
})

describe('MovieModel - createMovie', () => {
    test('debe crear una película con director y géneros nuevos', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)

        conn.query
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 10 }])
            .mockResolvedValueOnce([{ insertId: 1 }])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 20 }])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 30 }])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([[{ id: 1, title: 'New Movie', year: 2024, director: 'New Director', rating: '7.5', duration: 120, plot: 'A plot', poster: 'https://example.com/poster.jpg', genres: 'Drama, Comedy' }]])

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

        await model.createMovie(movieInput)

        expect(conn.beginTransaction).toHaveBeenCalled()
        expect(conn.commit).toHaveBeenCalled()
    })

    test('debe hacer rollback si falla', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockRejectedValue(new Error('Insert error'))

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

        await expect(model.createMovie(movieInput)).rejects.toThrow()
        expect(conn.rollback).toHaveBeenCalled()
    })
})

describe('MovieModel - updateMovie', () => {
    test('debe devolver null si la película no existe', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        const result = await model.updateMovie({ id: '999', result: { data: { title: 'Updated' } } })
        expect(result).toBeNull()
    })
})

describe('MovieModel - deleteMovie', () => {
    test('debe devolver null si la película no existe', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        const result = await model.deleteMovie('999')
        expect(result).toBeNull()
    })

    test('debe borrar y devolver true si existe', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query
            .mockResolvedValueOnce([[{ id: 1 }]])
            .mockResolvedValueOnce([{}])
            .mockResolvedValueOnce([{}])

        const result = await model.deleteMovie('1')
        expect(result).toBe(true)
        expect(conn.commit).toHaveBeenCalled()
    })
})
