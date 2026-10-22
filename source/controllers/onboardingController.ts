import type { Request, Response } from 'express'
import { OnboardingService } from '../services/onboardingService'
import { onboardingSchema } from '../schemas/onboarding'

export class OnboardingController {
    constructor(private onboardingService: OnboardingService) {}

    completeOnboarding = async (req: Request, res: Response) => {
        const parsed = onboardingSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const result = await this.onboardingService.completeOnboarding(req.user!.id, parsed.data)
        res.json(result)
    }
}
