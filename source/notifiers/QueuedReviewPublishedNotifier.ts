import ReviewPublishedNotifier, { type ReviewPublishedEvent } from './ReviewPublishedNotifier'
import { enqueueNotificationFanout } from '../queues/notificationQueue'

// ═══════════════════════════════════════════════════════════════
//  F3: productor del evento review.published
// ═══════════════════════════════════════════════════════════════
//  No decide canales: encola el evento en `notification-fanout` y el
//  worker lee `user_settings.notify_email`. El `jobId` determinístico
//  y sin ":" evita duplicar el fan-out si el request se reintenta.
//
//  No atrapa errores a propósito: quien decide que el fallo es no
//  fatal es ReviewService (best-effort, ver contrato de F3).
// ═══════════════════════════════════════════════════════════════

class QueuedReviewPublishedNotifier implements ReviewPublishedNotifier {
    async notifyReviewPublished(event: ReviewPublishedEvent): Promise<void> {
        await enqueueNotificationFanout(
            {
                event: 'review.published',
                userId: event.userId,
                payload: {
                    movieId: event.movieId,
                    movieTitle: event.movieTitle,
                    reviewId: event.reviewId,
                },
            },
            { jobId: `review-published-${event.reviewId}` },
        )
    }
}

export default QueuedReviewPublishedNotifier