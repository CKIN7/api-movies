import type { Request, Response } from 'express'
import { RecommendationService } from '../services/recommendationService'
import { RecommendationFeedbackService } from '../services/recommendationFeedbackService'
import { recommendationsQuerySchema } from '../schemas/userPreferences'
import { recommendationFeedbackSchema } from '../schemas/recommendationFeedback'

export class RecommendationController {
    constructor(
        private recommendationService: RecommendationService,
        private feedbackService: RecommendationFeedbackService,
    ) {}

    getRecommendations = async (req: Request, res: Response) => {
        const parsed = recommendationsQuerySchema.safeParse(req.query)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        const items = await this.recommendationService.getRecommendations(userId, parsed.data)

        res.json(items)
    }

    sendFeedback = async (req: Request, res: Response) => {
        const parsed = recommendationFeedbackSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const result = await this.feedbackService.recordFeedback(req.user!.id, parsed.data)

        res.status(result.applied ? 201 : 200).json(result)
    }
}
