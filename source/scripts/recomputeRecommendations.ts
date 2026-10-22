import connection from '../db/connection'
import { connectRedis, disconnectRedis } from '../utils/redisClient'
import { RecommendationRepository } from '../repositories/RecommendationRepository'
import { RecommendationFeedbackRepository } from '../repositories/RecommendationFeedbackRepository'
import { RecommendationService } from '../services/recommendationService'
import { RecommendationFeedbackService } from '../services/recommendationFeedbackService'
import MovieRepository from '../repositories/MovieRepository'
import { UserPreferencesService } from '../services/userPreferencesService'
import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  Job offline: recalcula las recomendaciones collaborative
//  para todos los usuarios y las guarda en Redis (TTL 24h).
//  Uso: npm run recs:compute
// ═══════════════════════════════════════════════════════════════

async function recompute(): Promise<void> {
    logger.info('[Recs] Starting collaborative recompute...')

    await connectRedis()

    const movieRepo = new MovieRepository(connection)
    const recRepo = new RecommendationRepository(connection)
    const prefsRepo = new UserPreferencesRepository(connection)
    const prefsService = new UserPreferencesService(prefsRepo)
    const feedbackRepo = new RecommendationFeedbackRepository(connection)
    const feedbackService = new RecommendationFeedbackService(feedbackRepo, prefsService, movieRepo)
    const service = new RecommendationService(recRepo, prefsService, movieRepo, feedbackService)

    const processed = await service.recomputeCollabForAllUsers()

    logger.info(`[Recs] Done. Recomputed collab recommendations for ${processed} user(s).`)

    await disconnectRedis()
    await connection.end()
}

recompute().catch(err => {
    logger.error(`[Recs] Failed: ${err.message}`)
    process.exit(1)
})
