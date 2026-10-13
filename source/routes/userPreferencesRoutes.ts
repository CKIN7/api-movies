import express from 'express'
import { UserPreferencesController } from '../controllers/userPreferencesController'
import { requireAuth } from '../middleware/requireAuth'

export function createUserPreferencesRoutes(controller: UserPreferencesController) {
    const router = express.Router()
    router.get('/me/preferences', requireAuth, controller.getPreferences)
    router.put('/me/preferences', requireAuth, controller.updatePreferences)
    router.get('/me/preferences/stats', requireAuth, controller.getStats)
    return router
}
