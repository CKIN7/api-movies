import { Notification } from '../../domain/Notification'
import type { NotificationRow } from '../../types/notification'

describe('Notification (domain)', () => {
    const baseRow: NotificationRow = {
        id: 42,
        user_id: 'user-1',
        type: 'review.published',
        dedupe_key: '17',
        payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
        read_at: null,
        created_at: '2026-10-29T13:35:01.000Z',
    }

    test('fromRow serializa el BIGINT como string y devuelve el payload', () => {
        const notification = Notification.fromRow(baseRow)

        expect(notification.id).toBe('42')
        expect(notification.type).toBe('review.published')
        expect(notification.userId).toBe('user-1')
        expect(notification.dedupeKey).toBe('17')
        expect(notification.payload).toEqual({ movieId: 27205, movieTitle: 'Inception', reviewId: '17' })
        expect(notification.readAt).toBeNull()
    })

    test('fromRow parsea el payload cuando llega como string JSON', () => {
        const notification = Notification.fromRow({
            ...baseRow,
            payload: '{"movieId":1,"movieTitle":"Alien","reviewId":"3"}',
        })

        expect(notification.payload).toEqual({ movieId: 1, movieTitle: 'Alien', reviewId: '3' })
    })

    test('fromRow tolera un payload JSON inválido', () => {
        const notification = Notification.fromRow({ ...baseRow, payload: 'not-json' })

        expect(notification.payload).toEqual({})
    })

    test('toResponse emite el DTO público con id string', () => {
        const notification = Notification.fromRow({ ...baseRow, read_at: '2026-10-29T14:00:00.000Z' })

        expect(notification.toResponse()).toEqual({
            id: '42',
            type: 'review.published',
            payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
            readAt: '2026-10-29T14:00:00.000Z',
            createdAt: '2026-10-29T13:35:01.000Z',
        })
    })
})
