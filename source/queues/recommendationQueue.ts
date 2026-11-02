import {
    recsRecomputeAllQueue,
    recsRecomputeUserQueue,
} from './queueFactory'
import { recsDedupeWindowMs, recsEnqueueTimeoutMs } from '../config/bullmq'
import { withTimeout } from '../utils/withTimeout'
import type {
    RecsRecomputeAllPayload,
    RecsRecomputeUserPayload,
} from '../types/bullmq'

// ═══════════════════════════════════════════════════════════════
//  F4: productor de recomputes de recomendaciones
// ═══════════════════════════════════════════════════════════════
//  - `recs-recompute-user`: lo dispara una invalidacion (review,
//    watchlist, feedback, preferencias, perfil, onboarding).
//  - `recs-recompute-all`: lo dispara el cron nocturno o
//    `npm run recs:compute`.
//
//  Dedupe por ventana: el jobId incluye el minuto actual, asi que N
//  eventos del mismo usuario en el mismo minuto generan UN job. Un
//  jobId fijo bloquearia el usuario para siempre si el job falla y
//  queda retenido en `failed`.
// ═══════════════════════════════════════════════════════════════

export interface EnqueueRecsOptions {
    /** Idempotencia: mismo jobId no encola dos veces. */
    jobId?: string
    /** Corta la espera si Redis no responde (best-effort). */
    timeoutMs?: number
    /** Inyectable en tests para fijar la ventana de dedupe. */
    now?: number
}

function assertValidJobId(jobId: string): void {
    if (jobId.includes(':')) {
        throw new Error(
            `jobId no puede contener ":" (BullMQ lo reserva para jobs repetibles): "${jobId}"`,
        )
    }
}

function dedupeSuffix(now: number): string {
    return String(Math.floor(now / recsDedupeWindowMs))
}

export async function enqueueRecsRecomputeUser(
    userId: string,
    options: EnqueueRecsOptions = {},
): Promise<string> {
    const jobId = options.jobId ?? `recs-user-${userId}-${dedupeSuffix(options.now ?? Date.now())}`
    assertValidJobId(jobId)

    const payload: RecsRecomputeUserPayload = { userId, reason: 'invalidation' }
    const timeoutMs = options.timeoutMs ?? recsEnqueueTimeoutMs

    const job = await withTimeout(
        recsRecomputeUserQueue.add('recs-recompute-user', payload, { jobId }),
        timeoutMs,
        `El encolado de recs-recompute-user excedio ${timeoutMs} ms`,
    )

    return job.id ?? ''
}

export async function enqueueRecsRecomputeAll(
    options: EnqueueRecsOptions = {},
): Promise<string> {
    const jobId = options.jobId ?? `recs-all-${dedupeSuffix(options.now ?? Date.now())}`
    assertValidJobId(jobId)

    const payload: RecsRecomputeAllPayload = { reason: 'manual' }
    const timeoutMs = options.timeoutMs ?? recsEnqueueTimeoutMs

    const job = await withTimeout(
        recsRecomputeAllQueue.add('recs-recompute-all', payload, { jobId }),
        timeoutMs,
        `El encolado de recs-recompute-all excedio ${timeoutMs} ms`,
    )

    return job.id ?? ''
}

export { recsRecomputeUserQueue, recsRecomputeAllQueue }
