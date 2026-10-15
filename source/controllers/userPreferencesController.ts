import type { Request, Response } from 'express'
import { UserPreferencesService } from '../services/userPreferencesService'
import { updateUserPreferencesSchema } from '../schemas/userPreferences'

export class UserPreferencesController {
    constructor(private userPreferencesService: UserPreferencesService) {}

    getPreferences = async (req: Request, res: Response) => {
        const userId = req.user!.id
        const preferences = await this.userPreferencesService.getPreferences(userId)
        res.json(preferences)
    }

    updatePreferences = async (req: Request, res: Response) => {
        const parsed = updateUserPreferencesSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        const preferences = await this.userPreferencesService.updatePreferences(userId, parsed.data)
        res.json(preferences)
    }

    getStats = async (req: Request, res: Response) => {
        const userId = req.user!.id
        const stats = await this.userPreferencesService.getStats(userId)
        res.json(stats)
    }
}
