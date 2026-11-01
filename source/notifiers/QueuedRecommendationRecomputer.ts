import RecommendationRecomputer from './RecommendationRecomputer'
import { enqueueRecsRecomputeUser } from '../queues/recommendationQueue'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  F4: productor de recs-recompute-user
// ═══════════════════════════════════════════════════════════════
//  A diferencia de `QueuedReviewPublishedNotifier`, aca el catch vive
//  en el notifier: el recompute es derivado (la invalidacion sincrona
//  ya dejo el cache limpio) y ningun service deberia repetir el mismo
//  try/catch seis veces. Si Redis no responde, se loguea y sigue.
// ═══════════════════════════════════════════════════════════════

class QueuedRecommendationRecomputer implements RecommendationRecomputer {
    async scheduleRecompute(userId: string): Promise<void> {
        try {
            await enqueueRecsRecomputeUser(userId)
        } catch (error) {
            logger.error(
                `Error al encolar el recompute de recomendaciones de ${userId}: ${(error as Error).message}`,
            )
        }
    }
}

export default QueuedRecommendationRecomputer
