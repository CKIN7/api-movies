import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  F4: recompute de recomendaciones
// ═══════════════════════════════════════════════════════════════
//  Uso:
//    npm run recs:compute        -> encola `recs-recompute-all` (no bloquea)
//    npm run recs:compute:sync   -> corre el recompute en este proceso
//
//  El modo encolado es el recomendado: el worker `worker-recs` hace el
//  trabajo y Bull Board muestra progreso. El modo sync queda para
//  operaciones puntuales y para reproducir el comportamiento previo.
// ═══════════════════════════════════════════════════════════════

async function enqueue(): Promise<void> {
    const { enqueueRecsRecomputeAll } = await import('../queues/recommendationQueue')
    const { closeAllQueues } = await import('../queues/queueFactory')

    try {
        const jobId = await enqueueRecsRecomputeAll({
            jobId: `recs-all-manual-${Date.now()}`,
        })
        logger.info(
            `[Recs] Job recs-recompute-all encolado (${jobId}). Seguilo en /admin/queues o en los logs de worker-recs.`,
        )
    } finally {
        await closeAllQueues()
    }
}

async function runSync(): Promise<void> {
    const { default: connection } = await import('../db/connection')
    const { connectRedis, disconnectRedis } = await import('../utils/redisClient')
    const { RecommendationRepository } = await import('../repositories/RecommendationRepository')
    const { RecommendationFeedbackRepository } = await import('../repositories/RecommendationFeedbackRepository')
    const { RecommendationService } = await import('../services/recommendationService')
    const { RecommendationFeedbackService } = await import('../services/recommendationFeedbackService')
    const { default: MovieRepository } = await import('../repositories/MovieRepository')
    const { UserPreferencesService } = await import('../services/userPreferencesService')
    const { UserPreferencesRepository } = await import('../repositories/UserPreferencesRepository')

    logger.info('[Recs] Starting synchronous recompute...')

    await connectRedis()

    const movieRepo = new MovieRepository(connection)
    const recRepo = new RecommendationRepository(connection)
    const prefsRepo = new UserPreferencesRepository(connection)
    const prefsService = new UserPreferencesService(prefsRepo)
    const feedbackRepo = new RecommendationFeedbackRepository(connection)
    const feedbackService = new RecommendationFeedbackService(feedbackRepo, prefsService, movieRepo)
    const service = new RecommendationService(recRepo, prefsService, movieRepo, feedbackService)

    const users = await recRepo.listUsersWithInteractions()
    let processed = 0
    let failed = 0

    for (const userId of users) {
        try {
            const result = await service.recomputeForUser(userId)
            if (!result.skipped) processed++
        } catch (error) {
            failed++
            logger.error(`[Recs] Fallo el recompute de ${userId}: ${(error as Error).message}`)
        }
    }

    logger.info(`[Recs] Done. ${processed} user(s) recomputed, ${failed} failed.`)

    await disconnectRedis()
    await connection.end()
}

const run = process.argv.includes('--sync') ? runSync : enqueue

run().catch((error) => {
    logger.error(`[Recs] Failed: ${(error as Error).message}`)
    process.exit(1)
})
