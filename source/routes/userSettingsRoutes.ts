import express from 'express'
import { UserSettingsController } from '../controllers/userSettingsController'
import { requireAuth } from '../middleware/requireAuth'

export function createUserSettingsRoutes(controller: UserSettingsController) {
    const router = express.Router()

    router.get('/me/settings', requireAuth, controller.getSettings)
    router.patch('/me/settings', requireAuth, controller.updateSettings)

    return router
}
