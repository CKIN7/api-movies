import NotificationService from '../../services/NotificationService'
import type { NotificationRow } from '../../types/notification'

const mockRepo = {
    insertIgnore: jest.fn(),
    findByUserId: jest.fn(),
    findByIdForUser: jest.fn(),
    markRead: jest.fn(),
    markAllRead: jest.fn(),
    countUnread: jest.fn(),
}

const row: NotificationRow = {
    id: 42,
    user_id: 'user-1',
    type: 'review.published',
    dedupe_key: '17',
    payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
    read_at: null,
    created_at: '2026-10-29T13:35:01.000Z',
}

describe('NotificationService (unit)', () => {
    let service: NotificationService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new NotificationService(mockRepo as any)
    })

    describe('list', () => {
        test('mapea filas y calcula el offset', async () => {
            mockRepo.findByUserId.mockResolvedValue({ rows: [row], total: 1 })

            const result = await service.list('user-1', { page: 2, limit: 20, unreadOnly: false })

            expect(mockRepo.findByUserId).toHaveBeenCalledWith('user-1', { page: 2, limit: 20, unreadOnly: false }, 20)
            expect(result.total).toBe(1)
            expect(result.page).toBe(2)
            expect(result.limit).toBe(20)
            expect(result.notifications[0]).toEqual({
                id: '42',
                type: 'review.published',
                payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
                readAt: null,
                createdAt: '2026-10-29T13:35:01.000Z',
            })
        })

        test('lista vacía', async () => {
            mockRepo.findByUserId.mockResolvedValue({ rows: [], total: 0 })

            const result = await service.list('user-1', { page: 1, limit: 20, unreadOnly: true })

            expect(result.notifications).toEqual([])
            expect(result.total).toBe(0)
        })
    })

    describe('unreadCount', () => {
        test('devuelve el contador del repo', async () => {
            mockRepo.countUnread.mockResolvedValue(3)

            expect(await service.unreadCount('user-1')).toBe(3)
        })
    })

    describe('markRead', () => {
        test('marca leída y devuelve el DTO', async () => {
            mockRepo.markRead.mockResolvedValue({ ...row, read_at: '2026-10-29T14:00:00.000Z' })

            const result = await service.markRead('user-1', '42')

            expect(mockRepo.markRead).toHaveBeenCalledWith('user-1', '42')
            expect(result.readAt).toBe('2026-10-29T14:00:00.000Z')
        })

        test('rechaza un id no numérico con 400', async () => {
            await expect(service.markRead('user-1', 'abc')).rejects.toMatchObject({ statusCode: 400 })
            expect(mockRepo.markRead).not.toHaveBeenCalled()
        })

        test('lanza 404 si no existe o es de otro usuario', async () => {
            mockRepo.markRead.mockResolvedValue(null)

            await expect(service.markRead('user-1', '99')).rejects.toMatchObject({ statusCode: 404 })
        })
    })

    describe('markAllRead', () => {
        test('devuelve las filas actualizadas', async () => {
            mockRepo.markAllRead.mockResolvedValue(4)

            expect(await service.markAllRead('user-1')).toBe(4)
        })
    })

    describe('create', () => {
        test('devuelve true cuando inserta', async () => {
            mockRepo.insertIgnore.mockResolvedValue(true)

            const dto = { userId: 'user-1', type: 'review.published' as const, dedupeKey: '17', payload: {} }
            expect(await service.create(dto)).toBe(true)
            expect(mockRepo.insertIgnore).toHaveBeenCalledWith(dto)
        })

        test('devuelve false cuando el dedupe ya existía', async () => {
            mockRepo.insertIgnore.mockResolvedValue(false)

            const inserted = await service.create({
                userId: 'user-1',
                type: 'review.published',
                dedupeKey: '17',
                payload: {},
            })

            expect(inserted).toBe(false)
        })
    })
})
