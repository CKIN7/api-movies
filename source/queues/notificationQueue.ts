import {
    notificationFanoutQueue,
    notificationInAppQueue,
} from './queueFactory'
import { notificationEnqueueTimeoutMs } from '../config/bullmq'
import { withTimeout } from '../utils/withTimeout'
import type {
    NotificationFanoutPayload,
    NotificationInAppPayload,
} from '../types/bullmq'

// ═══════════════════════════════════════════════════════════════
//  F3: productor de notificaciones
// ═══════════════════════════════════════════════════════════════
//  Dos colas:
//  - `notification-fanout`: recibe el evento crudo (review.published)
//    y el worker decide canales leyendo `user_settings.notify_email`.
//  - `notification-inapp`: persiste la notificación (INSERT IGNORE).
//
//  El productor de negocio (reviewService) solo emite el evento: no
//  conoce canales, plantillas ni preferencias.
// ═══════════════════════════════════════════════════════════════

export interface EnqueueNotificationOptions {
    /** Idempotencia: mismo jobId no encola dos veces. */
    jobId?: string
    /** Corta la espera si Redis no responde (best-effort). */
    timeoutMs?: number
}

function assertValidJobId(jobId?: string): void {
    if (jobId?.includes(':')) {
        throw new Error(
            `jobId no puede contener ":" (BullMQ lo reserva para jobs repetibles): "${jobId}"`,
        )
    }
}

export async function enqueueNotificationFanout(
    payload: NotificationFanoutPayload,
    options: EnqueueNotificationOptions = {},
): Promise<string> {
    assertValidJobId(options.jobId)
    const timeoutMs = options.timeoutMs ?? notificationEnqueueTimeoutMs

    const job = await withTimeout(
        notificationFanoutQueue.add(payload.event, payload, {
            ...(options.jobId ? { jobId: options.jobId } : {}),
        }),
        timeoutMs,
        `El encolado del fan-out de notificaciones excedio ${timeoutMs} ms`,
    )

    return job.id ?? ''
}

export async function enqueueNotificationInApp(
    payload: NotificationInAppPayload,
    options: EnqueueNotificationOptions = {},
): Promise<string> {
    assertValidJobId(options.jobId)
    const timeoutMs = options.timeoutMs ?? notificationEnqueueTimeoutMs

    const job = await withTimeout(
        notificationInAppQueue.add(payload.type, payload, {
            ...(options.jobId ? { jobId: options.jobId } : {}),
        }),
        timeoutMs,
        `El encolado de la notificacion in-app excedio ${timeoutMs} ms`,
    )

    return job.id ?? ''
}

export { notificationFanoutQueue, notificationInAppQueue }