import type { Request, Response } from 'express'
import { RecommendationService } from '../services/recommendationService'
import { recommendationsQuerySchema } from '../schemas/userPreferences'

export class RecommendationController {
    constructor(private recommendationService: RecommendationService) {}

    getRecommendations = async (req: Request, res: Response) => {
        const parsed = recommendationsQuerySchema.safeParse(req.query)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        const items = await this.recommendationService.getRecommendations(userId, parsed.data)

        res.json(items)
    }
}
