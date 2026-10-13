import express from 'express'
import { RecommendationController } from '../controllers/recommendationController'
import { requireAuth } from '../middleware/requireAuth'

export function createRecommendationRoutes(controller: RecommendationController) {
    const router = express.Router()
    router.get('/me/recommendations', requireAuth, controller.getRecommendations)
    return router
}
