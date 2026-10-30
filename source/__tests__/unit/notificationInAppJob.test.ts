import { dedupeKeyFor, processNotificationInAppJob } from '../../jobs/notificationInAppJob'
import type NotificationService from '../../services/NotificationService'
import type { NotificationType } from '../../types/notification'

describe('processNotificationInAppJob', () => {
    const create = jest.fn()
    const service = { create } as unknown as NotificationService

    beforeEach(() => {
        create.mockReset()
        create.mockResolvedValue(true)
    })

    test('crea la notificacion con dedupeKey derivada del reviewId', async () => {
        const payload = { movieId: 27205, movieTitle: 'Inception', reviewId: '17' }

        await processNotificationInAppJob(
            { userId: 'user-1', type: 'review.published', payload },
            service,
        )

        expect(create).toHaveBeenCalledWith({
            userId: 'user-1',
            type: 'review.published',
            dedupeKey: '17',
            payload,
        })
    })
})

describe('dedupeKeyFor', () => {
    test('usa reviewId para review.published', () => {
        expect(dedupeKeyFor('review.published', { reviewId: 42 })).toBe('42')
    })

    test('lanza si falta reviewId', () => {
        expect(() => dedupeKeyFor('review.published', {})).toThrow('requiere reviewId')
    })

    test('lanza con un tipo sin dedupe_key', () => {
        expect(() => dedupeKeyFor('watchlist.added' as NotificationType, {})).toThrow(
            'Tipo de notificación sin dedupe_key',
        )
    })
})