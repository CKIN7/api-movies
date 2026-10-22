import express from 'express'
import { UserProfileController } from '../controllers/userProfileController'
import { requireAuth } from '../middleware/requireAuth'

// ═══════════════════════════════════════════════════════════════
//  Orden crítico: las rutas /me/profile deben declararse ANTES de
//  /:id/profile, si no Express interpreta "me" como :id y el validador
//  uuid del schema responde 400.
// ═══════════════════════════════════════════════════════════════

export function createUserProfileRoutes(controller: UserProfileController) {
    const router = express.Router()

    router.get('/me/profile', requireAuth, controller.getMyProfile)
    router.patch('/me/profile', requireAuth, controller.updateMyProfile)
    router.get('/:id/profile', controller.getPublicProfile)

    return router
}
