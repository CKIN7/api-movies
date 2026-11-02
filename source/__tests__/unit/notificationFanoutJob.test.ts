import {
    processNotificationFanoutJob,
    resolveNotificationType,
    type NotificationFanoutDependencies,
} from '../../jobs/notificationFanoutJob'
import type { NotificationFanoutPayload } from '../../types/bullmq'

function buildDeps(overrides: Partial<NotificationFanoutDependencies> = {}): NotificationFanoutDependencies {
    return {
        isEmailEnabled: jest.fn().mockResolvedValue(true),
        getUserEmail: jest.fn().mockResolvedValue('author@example.com'),
        enqueueInApp: jest.fn().mockResolvedValue('inapp-1'),
        enqueueEmail: jest.fn().mockResolvedValue('email-1'),
        ...overrides,
    }
}

const event: NotificationFanoutPayload = {
    event: 'review.published',
    userId: 'user-1',
    payload: { movieId: 27205, movieTitle: 'Inception', reviewId: '17' },
}

describe('processNotificationFanoutJob', () => {
    test('siempre encola la notificacion in-app', async () => {
        const deps = buildDeps()

        await processNotificationFanoutJob(event, deps)

        expect(deps.enqueueInApp).toHaveBeenCalledWith({
            userId: 'user-1',
            type: 'review.published',
            payload: event.payload,
        })
    })

    test('con notify_email=true encola el email con jobId determinístico', async () => {
        const deps = buildDeps()

        await processNotificationFanoutJob(event, deps)

        expect(deps.enqueueEmail).toHaveBeenCalledWith(
            {
                template: 'review-published',
                to: 'author@example.com',
                data: {
                    movieTitle: 'Inception',
                    reviewUrl: 'http://localhost:8089/movies/27205',
                },
            },
            { jobId: 'review-published-17' },
        )
    })

    test('con notify_email=false no encola email ni busca el correo', async () => {
        const deps = buildDeps({ isEmailEnabled: jest.fn().mockResolvedValue(false) })

        await processNotificationFanoutJob(event, deps)

        expect(deps.enqueueInApp).toHaveBeenCalled()
        expect(deps.enqueueEmail).not.toHaveBeenCalled()
        expect(deps.getUserEmail).not.toHaveBeenCalled()
    })

    test('si el usuario no tiene email, no encola email', async () => {
        const deps = buildDeps({ getUserEmail: jest.fn().mockResolvedValue(null) })

        await processNotificationFanoutJob(event, deps)

        expect(deps.enqueueInApp).toHaveBeenCalled()
        expect(deps.enqueueEmail).not.toHaveBeenCalled()
    })

    test('un evento desconocido lanza y no encola nada', async () => {
        const deps = buildDeps()

        await expect(
            processNotificationFanoutJob({ ...event, event: 'nope' }, deps),
        ).rejects.toThrow('Evento de notificación desconocido')

        expect(deps.enqueueInApp).not.toHaveBeenCalled()
        expect(deps.enqueueEmail).not.toHaveBeenCalled()
    })

    test('resolveNotificationType mapea review.published', () => {
        expect(resolveNotificationType('review.published')).toBe('review.published')
    })
})