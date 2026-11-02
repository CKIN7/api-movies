import type { EmailMessage } from '../services/EmailService'
import type { NotificationFanoutPayload, NotificationInAppPayload } from '../types/bullmq'
import type { NotificationType } from '../types/notification'

const APP_URL = process.env.APP_URL ?? 'http://localhost:8089'

// F3 solo tiene emisor para review.published. Los tipos reservados
// (watchlist.added, recs.ready) se suman acá cuando tengan productor.
const EVENT_TO_TYPE: Record<string, NotificationType> = {
    'review.published': 'review.published',
}

export interface NotificationFanoutDependencies {
    isEmailEnabled(userId: string): Promise<boolean>
    getUserEmail(userId: string): Promise<string | null>
    enqueueInApp(payload: NotificationInAppPayload): Promise<unknown>
    enqueueEmail(message: EmailMessage, options?: { jobId?: string }): Promise<unknown>
}

export function resolveNotificationType(event: string): NotificationType {
    const type = EVENT_TO_TYPE[event]
    if (!type) throw new Error(`Evento de notificación desconocido: "${event}"`)
    return type
}

/**
 * Fan-out: traduce un evento de negocio a canales. El in-app es
 * obligatorio; el email depende de `user_settings.notify_email`.
 *
 * Si este job falla, BullMQ lo reintenta. El canal in-app es idempotente
 * (UNIQUE + INSERT IGNORE), y el email lleva `jobId` determinístico, así
 * que un reintento no duplica ninguno de los dos.
 */
export async function processNotificationFanoutJob(
    event: NotificationFanoutPayload,
    deps: NotificationFanoutDependencies,
): Promise<void> {
    const type = resolveNotificationType(event.event)

    await deps.enqueueInApp({ userId: event.userId, type, payload: event.payload })

    if (!(await deps.isEmailEnabled(event.userId))) return

    const to = await deps.getUserEmail(event.userId)
    if (!to) return

    const reviewId = event.payload.reviewId
    await deps.enqueueEmail(
        {
            template: 'review-published',
            to,
            data: {
                movieTitle: event.payload.movieTitle,
                reviewUrl: buildReviewUrl(event.payload),
            },
        },
        reviewId !== undefined && reviewId !== null
            ? { jobId: `review-published-${String(reviewId)}` }
            : undefined,
    )
}

function buildReviewUrl(payload: Record<string, unknown>): string | undefined {
    const movieId = payload.movieId
    if (movieId === undefined || movieId === null) return undefined
    return `${APP_URL}/movies/${String(movieId)}`
}