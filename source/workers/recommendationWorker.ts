import { Job } from 'bullmq'
import {
    QueueNames,
    recsCronPattern,
    recsCronTimezone,
    recsRecomputeBatchSize,
    recsSchedulerId,
    recsWorkerConcurrency,
} from '../config/bullmq'
import { BaseWorker } from './baseWorker'
import connection from '../db/connection'
import MovieRepository from '../repositories/MovieRepository'
import { RecommendationRepository } from '../repositories/RecommendationRepository'
import { RecommendationFeedbackRepository } from '../repositories/RecommendationFeedbackRepository'
import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import { UserPreferencesService } from '../services/userPreferencesService'
import { RecommendationFeedbackService } from '../services/recommendationFeedbackService'
import { RecommendationService } from '../services/recommendationService'
import { enqueueNotificationInApp } from '../queues/notificationQueue'
import { recsRecomputeAllQueue } from '../queues/queueFactory'
import {
    processRecsRecomputeAllJob,
    processRecsRecomputeUserJob,
    type RecommendationRecomputer,
    type RecsReadyNotifier,
} from '../jobs/recomputeRecommendationsJob'
import type {
    RecsQueueName,
    RecsRecomputeAllPayload,
    RecsRecomputeUserPayload,
} from '../types/bullmq'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  F4: worker de recomendaciones
// ═══════════════════════════════════════════════════════════════
//  Un `Worker` de BullMQ consume UNA cola, asi que este modulo crea
//  dos instancias:
//  - recs-recompute-user: invalidacion puntual (review/watchlist/...).
//  - recs-recompute-all: cron nocturno o `npm run recs:compute`.
//
//  El cron se registra con `upsertJobScheduler` desde este proceso,
//  no desde la API: el scheduler sobrevive reinicios en Redis y no se
//  duplica si la API corre en cluster.
// ═══════════════════════════════════════════════════════════════

export const recsQueueNames: RecsQueueName[] = [
    QueueNames.RECS_RECOMPUTE_USER,
    QueueNames.RECS_RECOMPUTE_ALL,
]

export function buildRecommendationService(): RecommendationService {
    const movieRepo = new MovieRepository(connection)
    const recRepo = new RecommendationRepository(connection)
    const prefsRepo = new UserPreferencesRepository(connection)
    const prefsService = new UserPreferencesService(prefsRepo)
    const feedbackRepo = new RecommendationFeedbackRepository(connection)
    const feedbackService = new RecommendationFeedbackService(feedbackRepo, prefsService, movieRepo)

    return new RecommendationService(recRepo, prefsService, movieRepo, feedbackService)
}

/** Encola el aviso in-app `recs.ready` (una vez por usuario y dia). */
export const notifyRecsReady: RecsReadyNotifier = async (userId, count, date) => {
    await enqueueNotificationInApp(
        { userId, type: 'recs.ready', payload: { count, date } },
        { jobId: `recs-ready-${date}-${userId}` },
    )
}

export class RecsRecomputeUserWorker extends BaseWorker<RecsQueueName> {
    constructor(private readonly service: RecommendationRecomputer = buildRecommendationService()) {
        super({
            queueName: QueueNames.RECS_RECOMPUTE_USER,
            concurrency: recsWorkerConcurrency,
        })
    }

    protected async processJob(job: Job<RecsRecomputeUserPayload>): Promise<void> {
        await processRecsRecomputeUserJob(job.data, this.service)
    }
}

export interface RecsRecomputeAllDependencies {
    service: RecommendationRecomputer
    listUsers: () => Promise<string[]>
    notifyReady?: RecsReadyNotifier
    batchSize?: number
}

export class RecsRecomputeAllWorker extends BaseWorker<RecsQueueName> {
    constructor(private readonly deps: RecsRecomputeAllDependencies) {
        super({
            queueName: QueueNames.RECS_RECOMPUTE_ALL,
            concurrency: 1,
        })
    }

    protected async processJob(job: Job<RecsRecomputeAllPayload>): Promise<void> {
        const users = await this.deps.listUsers()

        await processRecsRecomputeAllJob(this.deps.service, {
            users,
            batchSize: this.deps.batchSize ?? recsRecomputeBatchSize,
            notifyReady: this.deps.notifyReady,
            onProgress: (processed, total) => job.updateProgress({ processed, total }),
        })
    }
}

export interface RecommendationWorkers {
    user: RecsRecomputeUserWorker
    all: RecsRecomputeAllWorker
}

export function createRecommendationWorkers(
    service: RecommendationRecomputer = buildRecommendationService(),
): RecommendationWorkers {
    const repo = new RecommendationRepository(connection)

    return {
        user: new RecsRecomputeUserWorker(service),
        all: new RecsRecomputeAllWorker({
            service,
            listUsers: () => repo.listUsersWithInteractions(),
            notifyReady: notifyRecsReady,
        }),
    }
}

/** Registra (o actualiza) el cron nocturno en Redis. Idempotente. */
export async function ensureRecsRecomputeScheduler(): Promise<void> {
    await recsRecomputeAllQueue.upsertJobScheduler(
        recsSchedulerId,
        { pattern: recsCronPattern, tz: recsCronTimezone },
        {
            name: 'recs-recompute-all',
            data: { reason: 'cron' } satisfies RecsRecomputeAllPayload,
        },
    )

    logger.info(
        `[Workers] recs scheduler "${recsSchedulerId}" registered (${recsCronPattern} ${recsCronTimezone})`,
    )
}

if (require.main === module) {
    createRecommendationWorkers()
    logger.info(
        `[Workers] recommendation workers started (${recsQueueNames.join(', ')})`,
    )

    ensureRecsRecomputeScheduler().catch((error) => {
        logger.error(`[Workers] no se pudo registrar el cron de recs: ${(error as Error).message}`)
    })
}
