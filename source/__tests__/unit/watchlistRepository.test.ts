import WatchlistRepository from '../../repositories/WatchlistRepository'
import type { WatchlistRow } from '../../types/watchlist'

const mockConn = {
    query: jest.fn()
}

const mockDbLogger = {
    query: jest.fn((_type: string, _sql: string, _params: any[], fn: () => Promise<any>) => fn())
}

jest.mock('../../utils/DbLogger', () => ({
    DbLogger: {
        query: jest.fn((_type: string, _sql: string, _params: any[], fn: () => Promise<any>) => fn())
    }
}))

describe('WatchlistRepository (unit)', () => {
    let repo: WatchlistRepository

    beforeEach(() => {
        jest.clearAllMocks()
        repo = new WatchlistRepository(mockConn)
    })

    describe('create', () => {
        test('inserta y devuelve insertId', async () => {
            mockConn.query.mockResolvedValueOnce([{ insertId: 42 }])

            const id = await repo.create('user-1', 123, 'notes', 5)

            expect(id).toBe(42)
            expect(mockConn.query).toHaveBeenCalledWith(
                'INSERT INTO user_watchlists (user_id, movie_id, notes, priority) VALUES (?, ?, ?, ?)',
                ['user-1', 123, 'notes', 5]
            )
        })
    })

    describe('findByUserAndMovie', () => {
        test('devuelve entry si existe', async () => {
            const mockRow: WatchlistRow = {
                id: 1,
                user_id: 'user-1',
                movie_id: 123,
                notes: 'notes',
                priority: 3,
                added_at: '2026-01-15T10:30:00.000Z'
            }
            mockConn.query.mockResolvedValueOnce([[mockRow]])

            const result = await repo.findByUserAndMovie('user-1', 123)

            expect(result).toEqual(mockRow)
            expect(mockConn.query).toHaveBeenCalledWith(
                expect.stringContaining('SELECT id, user_id, movie_id, notes, priority, added_at'),
                ['user-1', 123]
            )
        })

        test('devuelve null si no existe', async () => {
            mockConn.query.mockResolvedValueOnce([[]])

            const result = await repo.findByUserAndMovie('user-1', 999)

            expect(result).toBeNull()
        })
    })

    describe('delete', () => {
        test('devuelve true si borró', async () => {
            mockConn.query.mockResolvedValueOnce([{ affectedRows: 1 }])

            const result = await repo.delete('user-1', 123)

            expect(result).toBe(true)
        })

        test('devuelve false si no borró nada', async () => {
            mockConn.query.mockResolvedValueOnce([{ affectedRows: 0 }])

            const result = await repo.delete('user-1', 999)

            expect(result).toBe(false)
        })
    })

    describe('existsMovie', () => {
        test('devuelve true si movie existe', async () => {
            mockConn.query.mockResolvedValueOnce([[{ '1': 1 }]])

            const result = await repo.existsMovie(123)

            expect(result).toBe(true)
        })

        test('devuelve false si movie no existe', async () => {
            mockConn.query.mockResolvedValueOnce([[]])

            const result = await repo.existsMovie(999)

            expect(result).toBe(false)
        })
    })
})