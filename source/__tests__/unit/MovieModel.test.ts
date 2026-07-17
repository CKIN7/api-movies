import MovieRepository from '../../repositories/MovieRepository'

function createMockConnection() {
    const query = jest.fn()
    const beginTransaction = jest.fn()
    const commit = jest.fn()
    const rollback = jest.fn()
    return { query, beginTransaction, commit, rollback } as any
}

describe('MovieRepository - findMany', () => {
    test('debe devolver lista de películas', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ]
        conn.query
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([fakeMovies])

        const result = await repo.findMany({ limit: 10, offset: 0 })
        expect(result).toEqual({ rows: fakeMovies, total: 1 })
        expect(conn.query).toHaveBeenCalledTimes(2)
    })

    test('debe filtrar por año', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ year: 1994, limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.year = ?')
        expect(conn.query.mock.calls[1][1]).toContain(1994)
    })

    test('debe filtrar por género', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ genre: 'Action', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('genre_name = ?')
        expect(conn.query.mock.calls[1][1]).toContain('Action')
    })

    test('debe lanzar error si la query falla', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query.mockRejectedValue(new Error('DB error'))

        await expect(repo.findMany({ limit: 10, offset: 0 })).rejects.toThrow()
    })

    test('debe incluir d.director_name LIKE en la query cuando se filtra por director', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ director: 'Nolan', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('d.director_name LIKE ?')
        expect(conn.query.mock.calls[1][1]).toContain('%Nolan%')
    })

    test('debe combinar director con otros filtros', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ director: 'Nolan', year: 2010, limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('d.director_name LIKE ?')
        expect(queryStr).toContain('m.year = ?')
        expect(queryStr).toContain('AND')
    })

    test('debe incluir triple LIKE y EXISTS en la query cuando se filtra por q', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ q: 'batman', limit: 10, offset: 0 })

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.title LIKE ?')
        expect(queryStr).toContain('m.plot LIKE ?')
        expect(queryStr).toContain('d.director_name LIKE ?')
        expect(queryStr).toContain('EXISTS')
        expect(queryStr).toContain('genre_name LIKE ?')
    })

    test('debe pasar 4 parámetros con %...% para q', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({ q: 'batman', limit: 10, offset: 0 })

        expect(conn.query.mock.calls[0][1]).toEqual(['%batman%', '%batman%', '%batman%', '%batman%'])
    })
})

describe('MovieRepository - findById', () => {
    test('debe devolver una película por id', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        conn.query.mockResolvedValue([[fakeMovie]])

        const result = await repo.findById(1)
        expect(result).toEqual(fakeMovie)
        expect(conn.query).toHaveBeenCalledTimes(1)
    })

    test('debe devolver null si no existe', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query.mockResolvedValue([[]])

        const result = await repo.findById(999)
        expect(result).toBeNull()
    })
})
