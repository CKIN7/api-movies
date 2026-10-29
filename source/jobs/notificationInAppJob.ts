import type NotificationService from '../services/NotificationService'
import type { NotificationInAppPayload } from '../types/bullmq'
import type { NotificationType } from '../types/notification'

// La cola `notification-inapp` transporta `{ userId, type, payload }`
// (ver types/bullmq.ts). La clave de dedupe se deriva del tipo, porque
// es la clave de negocio del evento dentro de su `type`.
export function dedupeKeyFor(type: NotificationType, payload: Record<string, unknown>): string {
    if (type === 'review.published') {
        const reviewId = payload.reviewId
        if (reviewId === undefined || reviewId === null) {
            throw new Error('El payload de review.published requiere reviewId para deduplicar')
        }
        return String(reviewId)
    }

    throw new Error(`Tipo de notificación sin dedupe_key: "${type}"`)
}

export async function processNotificationInAppJob(
    payload: NotificationInAppPayload,
    service: NotificationService,
): Promise<void> {
    const type = payload.type as NotificationType

    await service.create({
        userId: payload.userId,
        type,
        dedupeKey: dedupeKeyFor(type, payload.payload),
        payload: payload.payload,
    })
}