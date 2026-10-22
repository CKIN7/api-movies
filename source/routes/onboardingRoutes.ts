import express from 'express'
import { OnboardingController } from '../controllers/onboardingController'
import { requireAuth } from '../middleware/requireAuth'

export function createOnboardingRoutes(controller: OnboardingController) {
    const router = express.Router()
    router.post('/me/onboarding', requireAuth, controller.completeOnboarding)
    return router
}
