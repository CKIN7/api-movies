import { recsRecomputeBatchSize } from '../config/bullmq'
import logger from '../utils/logger'
import type { RecomputeUserResult } from '../types/recommendation'
import type { RecsRecomputeUserPayload } from '../types/bullmq'

// ═══════════════════════════════════════════════════════════════
//  F4: handlers de recompute
// ═══════════════════════════════════════════════════════════════
//  Los handlers reciben las dependencias (service, lista de usuarios,
//  notificador) para poder testearlos sin Redis ni MySQL.
// ═══════════════════════════════════════════════════════════════

export interface RecommendationRecomputer {
    recomputeForUser(userId: string): Promise<RecomputeUserResult>
}

export type RecsReadyNotifier = (
    userId: string,
    count: number,
    date: string,
) => Promise<unknown>

export interface RecsRecomputeAllOptions {
    users: string[]
    batchSize?: number
    /** Emite `recs.ready` para usuarios con recomendaciones. */
    notifyReady?: RecsReadyNotifier
    /** Inyectable en tests; por defecto `new Date()`. */
    now?: () => Date
    onProgress?: (processed: number, total: number) => Promise<void> | void
}

export interface RecsRecomputeAllSummary {
    processed: number
    failed: number
    ready: number
    date: string
    durationMs: number
}

export async function processRecsRecomputeUserJob(
    payload: RecsRecomputeUserPayload,
    service: RecommendationRecomputer,
): Promise<RecomputeUserResult> {
    return service.recomputeForUser(payload.userId)
}

export async function processRecsRecomputeAllJob(
    service: RecommendationRecomputer,
    options: RecsRecomputeAllOptions,
): Promise<RecsRecomputeAllSummary> {
    const startedAt = Date.now()
    const date = (options.now?.() ?? new Date()).toISOString().slice(0, 10)
    const batchSize = options.batchSize ?? recsRecomputeBatchSize
    const total = options.users.length

    let processed = 0
    let failed = 0
    let ready = 0

    for (let offset = 0; offset < total; offset += batchSize) {
        const batch = options.users.slice(offset, offset + batchSize)

        for (const userId of batch) {
            try {
                const result = await service.recomputeForUser(userId)
                if (!result.skipped) processed++

                if (result.recommendations > 0 && options.notifyReady) {
                    try {
                        await options.notifyReady(userId, result.recommendations, date)
                        ready++
                    } catch (error) {
                        // El recompute ya quedo cacheado: un aviso perdido
                        // no justifica reintentar todo el lote.
                        logger.warn(
                            `[Recs] No se pudo emitir recs.ready para ${userId}: ${(error as Error).message}`,
                        )
                    }
                }
            } catch (error) {
                failed++
                logger.error(
                    `[Recs] Fallo el recompute de ${userId}: ${(error as Error).message}`,
                )
            }
        }

        await options.onProgress?.(Math.min(offset + batch.length, total), total)
    }

    const summary: RecsRecomputeAllSummary = {
        processed,
        failed,
        ready,
        date,
        durationMs: Date.now() - startedAt,
    }

    logger.info('[Recs] Recompute all finished', summary)

    // Fallo sistemico (DB caida, por ejemplo): que BullMQ reintente.
    // Si al menos un usuario salio bien, no se repite trabajo ya hecho.
    if (total > 0 && processed === 0 && failed > 0) {
        throw new Error(`El recompute masivo fallo para los ${failed} usuarios`)
    }

    return summary
}
