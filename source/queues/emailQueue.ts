import { Queue } from 'bullmq'
import {
    emailCriticalQueue,
    emailMarketingQueue,
    emailTransactionalQueue,
} from './queueFactory'
import { emailEnqueueTimeoutMs } from '../config/bullmq'
import type { EmailMessage } from '../services/EmailService'
import type { EmailJobPayload } from '../types/bullmq'

// ═══════════════════════════════════════════════════════════════
//  F2: productor de emails
// ═══════════════════════════════════════════════════════════════
//  Las 3 colas ya existen en el factory; aca solo se elige la cola
//  segun la categoria y se encola. El nombre del job es
//  `<categoria>:<template>` para poder filtrarlo en Bull Board.
//
//  `jobId` es opcional y da idempotencia: BullMQ ignora un `add` con
//  un `jobId` que ya existe (ver CA-5 de F2).
//
//  Ojo: BullMQ lanza `Custom Id cannot contain :` si el jobId lleva ":"
//  y no tiene exactamente 3 segmentos separados por ":". El nombre del
//  job sí puede llevarlo; el que no puede es el jobId. Por eso acá se
//  valida antes de llamar a `add`, así el error es explícito en vez de
//  perderse en el catch best-effort de register/resend.
// ═══════════════════════════════════════════════════════════════

export type EmailCategory = 'critical' | 'transactional' | 'marketing'

export interface EnqueueEmailOptions {
    /** Idempotencia: mismo jobId no duplica el envio. */
    jobId?: string
    /** Corta la espera si Redis no responde (best-effort, ver register). */
    timeoutMs?: number
}

const queues: Record<EmailCategory, Queue<EmailJobPayload>> = {
    critical: emailCriticalQueue as unknown as Queue<EmailJobPayload>,
    transactional: emailTransactionalQueue as unknown as Queue<EmailJobPayload>,
    marketing: emailMarketingQueue as unknown as Queue<EmailJobPayload>,
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    if (!Number.isFinite(ms) || ms <= 0) return promise

    return new Promise<T>((resolve, reject) => {
        const timer = setTimeout(
            () => reject(new Error(`El encolado de email excedio ${ms} ms`)),
            ms,
        )
        promise.then(
            (value) => {
                clearTimeout(timer)
                resolve(value)
            },
            (error) => {
                clearTimeout(timer)
                reject(error)
            },
        )
    })
}

export async function enqueueEmail(
    category: EmailCategory,
    message: EmailMessage,
    options: EnqueueEmailOptions = {},
): Promise<string> {
    if (options.jobId?.includes(':')) {
        throw new Error(
            `jobId no puede contener ":" (BullMQ lo reserva para jobs repetibles): "${options.jobId}"`,
        )
    }

    const queue = queues[category]
    const job = await withTimeout(
        queue.add(`${category}:${message.template}`, message as EmailJobPayload, {
            ...(options.jobId ? { jobId: options.jobId } : {}),
        }),
        options.timeoutMs ?? emailEnqueueTimeoutMs,
    )

    return job.id ?? ''
}

export function getEmailQueue(category: EmailCategory): Queue<EmailJobPayload> {
    return queues[category]
}
