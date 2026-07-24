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
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi', age_rating: 'PG-13' }
        ]
        conn.query
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([fakeMovies])

        const result = await repo.findMany({genreMode: 'and', page: 1,  limit: 10}, 0)
        expect(result).toEqual({ rows: fakeMovies, total: 1 })
        expect(conn.query).toHaveBeenCalledTimes(2)
    })

    test('debe filtrar por rango de año', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  minYear: 1994, maxYear: 1994, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.year >= ?')
        expect(queryStr).toContain('m.year <= ?')
    })

    test('debe filtrar por género (modo AND con un género)', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genre: ['Action'], genreMode: 'and', page: 1, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('genre_name IN (?)')
        expect(queryStr).toContain('HAVING COUNT')
        expect(conn.query.mock.calls[1][1]).toContain('Action')
    })

    test('debe lanzar error si la query falla', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query.mockRejectedValue(new Error('DB error'))

        await expect(repo.findMany({genreMode: 'and', page: 1,  limit: 10}, 0)).rejects.toThrow()
    })

    test('debe incluir d.director_name LIKE en la query cuando se filtra por director', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  director: 'Nolan', limit: 10}, 0)

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

        await repo.findMany({genreMode: 'and', page: 1,  director: 'Nolan', minYear: 2010, maxYear: 2010, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('d.director_name LIKE ?')
        expect(queryStr).toContain('m.year >= ?')
        expect(queryStr).toContain('m.year <= ?')
        expect(queryStr).toContain('AND')
    })

    test('debe incluir triple LIKE y EXISTS en la query cuando se filtra por q', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  q: 'batman', limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.title LIKE ?')
        expect(queryStr).toContain('m.plot LIKE ?')
        expect(queryStr).toContain('d.director_name LIKE ?')
        expect(queryStr).toContain('EXISTS')
        expect(queryStr).toContain('genre_name LIKE ?')
    })

    test('debe pasar 5 parámetros con %...% para q', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  q: 'batman', limit: 10}, 0)

        expect(conn.query.mock.calls[0][1]).toEqual(['%batman%', '%batman%', '%batman%', '%batman%', '%batman%'])
    })

    test('debe filtrar por múltiples géneros en modo AND', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genre: ['action', 'crime'], genreMode: 'and', page: 1, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('genre_name IN (?, ?)')
        expect(queryStr).toContain('HAVING COUNT(DISTINCT mg2.genre_id) = ?')
        expect(conn.query.mock.calls[1][1]).toContain('action')
        expect(conn.query.mock.calls[1][1]).toContain('crime')
        expect(conn.query.mock.calls[1][1]).toContain(2)
    })

    test('debe filtrar por múltiples géneros en modo OR', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genre: ['action', 'comedy'], genreMode: 'or', page: 1, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('genre_name IN (?, ?)')
        expect(queryStr).not.toContain('HAVING COUNT')
        expect(conn.query.mock.calls[1][1]).toContain('action')
        expect(conn.query.mock.calls[1][1]).toContain('comedy')
    })

    test('debe usar modo AND cuando se especifica genreMode=and', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genre: ['drama'], genreMode: 'and', page: 1, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('HAVING COUNT')
    })

    test('debe filtrar por minRating', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  minRating: 8, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.rating >= ?')
        expect(conn.query.mock.calls[1][1]).toContain(8)
    })

    test('debe filtrar por maxRating', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  maxRating: 9, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.rating <= ?')
        expect(conn.query.mock.calls[1][1]).toContain(9)
    })

    test('debe filtrar por minDuration', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  minDuration: 120, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.duration >= ?')
        expect(conn.query.mock.calls[1][1]).toContain(120)
    })

    test('debe filtrar por maxDuration', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  maxDuration: 150, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.duration <= ?')
        expect(conn.query.mock.calls[1][1]).toContain(150)
    })

    test('debe combinar min y max para un mismo campo', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findMany({genreMode: 'and', page: 1,  minDuration: 100, maxDuration: 200, limit: 10}, 0)

        const queryStr = conn.query.mock.calls[1][0] as string
        expect(queryStr).toContain('m.duration >= ?')
        expect(queryStr).toContain('m.duration <= ?')
        expect(queryStr).toContain('AND')
    })
})

describe('MovieRepository - findById', () => {
    test('debe devolver una película por id', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        const fakeMovie = { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi', age_rating: 'PG-13' }
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

describe('MovieRepository - findSimilar', () => {
    test('debe devolver películas similares con la estructura correcta', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        const fakeRows = [
            { id: 8, title: 'The Dark Knight Rises', year: 2012, director: 'Christopher Nolan', rating: 8.4, genres: 'action, drama', similarityScore: 6 },
        ]
        conn.query
            .mockResolvedValueOnce([[{ id: 2, id_director: 1, year: 2008 }]])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([fakeRows])

        const result = await repo.findSimilar(2, 10, 0)

        expect(result).toEqual({ rows: fakeRows, total: 1 })
    })

    test('debe excluir la película origen en la query', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ id: 2, id_director: 1, year: 2008 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findSimilar(2, 10, 0)

        const selectSql = conn.query.mock.calls[2][0] as string
        expect(selectSql).toContain('m.id != ?')
    })

    test('debe calcular similarityScore en la consulta', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ id: 1, id_director: 1, year: 2010 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findSimilar(1, 10, 0)

        const sql = conn.query.mock.calls[2][0] as string
        expect(sql).toContain('similarityScore')
    })

    test('debe ordenar por similarityScore DESC y rating DESC', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ id: 1, id_director: 1, year: 2010 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findSimilar(1, 10, 0)

        const sql = conn.query.mock.calls[2][0] as string
        expect(sql).toContain('ORDER BY')
        expect(sql).toContain('similarityScore DESC')
        expect(sql).toContain('m.rating DESC')
    })

    test('debe incluir LIMIT y OFFSET con valores correctos', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)
        conn.query
            .mockResolvedValueOnce([[{ id: 1, id_director: 1, year: 2010 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        await repo.findSimilar(1, 5, 10)

        const selectSql = conn.query.mock.calls[2][0] as string
        const selectParams = conn.query.mock.calls[2][1] as any[]
        expect(selectSql).toContain('LIMIT')
        expect(selectSql).toContain('OFFSET')
        expect(selectParams.slice(-2)).toEqual([5, 10])
    })

    test('debe devolver películas con múltiples géneros compartidos', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        const fakeRows = [
            { id: 80, title: 'Tenet', year: 2020, director: 'Christopher Nolan', rating: 7.3, genres: 'action, sci-fi', similarityScore: 7 },
        ]
        conn.query
            .mockResolvedValueOnce([[{ id: 1, id_director: 1, year: 2010 }]])
            .mockResolvedValueOnce([[{ total: 1 }]])
            .mockResolvedValueOnce([fakeRows])

        const result = await repo.findSimilar(1, 10, 0)

        expect(result.rows[0].similarityScore).toBe(7)
    })

    test('debe devolver array vacío cuando no hay películas similares', async () => {
        const conn = createMockConnection()
        const repo = new MovieRepository(conn)

        conn.query
            .mockResolvedValueOnce([[{ id: 999, id_director: 99, year: 1900 }]])
            .mockResolvedValueOnce([[{ total: 0 }]])
            .mockResolvedValueOnce([[]])

        const result = await repo.findSimilar(999, 10, 0)

        expect(result.rows).toHaveLength(0)
        expect(result.total).toBe(0)
    })
})
