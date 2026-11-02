import NotificationRepository from '../../repositories/NotificationRepository'
import type { NotificationRow } from '../../types/notification'

const mockConn = {
    query: jest.fn(),
}

jest.mock('../../utils/DbLogger', () => ({
    DbLogger: {
        query: jest.fn((_type: string, _sql: string, _params: any[], fn: () => Promise<any>) => fn()),
    },
}))

const row: NotificationRow = {
    id: 42,
    user_id: 'user-1',
    type: 'review.published',
    dedupe_key: '17',
    payload: { movieId: 27205 },
    read_at: null,
    created_at: '2026-10-29T13:35:01.000Z',
}

describe('NotificationRepository (unit)', () => {
    let repo: NotificationRepository

    beforeEach(() => {
        jest.clearAllMocks()
        repo = new NotificationRepository(mockConn)
    })

    describe('insertIgnore', () => {
        test('devuelve true si insertó y serializa el payload', async () => {
            mockConn.query.mockResolvedValueOnce([{ affectedRows: 1 }])

            const inserted = await repo.insertIgnore({
                userId: 'user-1',
                type: 'review.published',
                dedupeKey: '17',
                payload: { movieId: 27205 },
            })

            expect(inserted).toBe(true)
            expect(mockConn.query).toHaveBeenCalledWith(
                expect.stringContaining('INSERT IGNORE INTO notifications'),
                ['user-1', 'review.published', '17', JSON.stringify({ movieId: 27205 })]
            )
        })

        test('devuelve false si el UNIQUE la descartó (duplicado)', async () => {
            mockConn.query.mockResolvedValueOnce([{ affectedRows: 0 }])

            const inserted = await repo.insertIgnore({
                userId: 'user-1',
                type: 'review.published',
                dedupeKey: '17',
                payload: {},
            })

            expect(inserted).toBe(false)
        })
    })

    describe('findByUserId', () => {
        test('lista paginada con total y sin filtro', async () => {
            mockConn.query
                .mockResolvedValueOnce([[row]])
                .mockResolvedValueOnce([[{ total: 1 }]])

            const result = await repo.findByUserId('user-1', { page: 2, limit: 20, unreadOnly: false }, 20)

            expect(result.rows).toEqual([row])
            expect(result.total).toBe(1)
            expect(mockConn.query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('ORDER BY created_at DESC'),
                ['user-1', 20, 20]
            )
        })

        test('aplica el filtro unread_only', async () => {
            mockConn.query
                .mockResolvedValueOnce([[]])
                .mockResolvedValueOnce([[{ total: 0 }]])

            await repo.findByUserId('user-1', { page: 1, limit: 20, unreadOnly: true }, 0)

            expect(mockConn.query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('read_at IS NULL'),
                ['user-1', 20, 0]
            )
            expect(mockConn.query).toHaveBeenNthCalledWith(
                2,
                expect.stringContaining('read_at IS NULL'),
                ['user-1']
            )
        })
    })

    describe('markRead', () => {
        test('actualiza con COALESCE y devuelve la fila', async () => {
            mockConn.query
                .mockResolvedValueOnce([{ affectedRows: 1 }])
                .mockResolvedValueOnce([[{ ...row, read_at: '2026-10-29T14:00:00.000Z' }]])

            const result = await repo.markRead('user-1', '42')

            expect(mockConn.query).toHaveBeenNthCalledWith(
                1,
                expect.stringContaining('COALESCE(read_at, NOW())'),
                ['42', 'user-1']
            )
            expect(result?.read_at).toBe('2026-10-29T14:00:00.000Z')
        })

        test('devuelve null si la notificación no es del usuario', async () => {
            mockConn.query
                .mockResolvedValueOnce([{ affectedRows: 0 }])
                .mockResolvedValueOnce([[]])

            expect(await repo.markRead('user-1', '99')).toBeNull()
        })
    })

    describe('markAllRead', () => {
        test('devuelve la cantidad de filas actualizadas', async () => {
            mockConn.query.mockResolvedValueOnce([{ affectedRows: 3 }])

            expect(await repo.markAllRead('user-1')).toBe(3)
            expect(mockConn.query).toHaveBeenCalledWith(
                expect.stringContaining('read_at IS NULL'),
                ['user-1']
            )
        })
    })

    describe('countUnread', () => {
        test('devuelve el contador', async () => {
            mockConn.query.mockResolvedValueOnce([[{ unread: 5 }]])

            expect(await repo.countUnread('user-1')).toBe(5)
        })
    })
})
