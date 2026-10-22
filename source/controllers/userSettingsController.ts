import type { Request, Response } from 'express'
import { UserSettingsService } from '../services/userSettingsService'
import { updateUserSettingsSchema } from '../schemas/userSettings'

export class UserSettingsController {
    constructor(private userSettingsService: UserSettingsService) {}

    getSettings = async (req: Request, res: Response) => {
        const settings = await this.userSettingsService.getSettings(req.user!.id)
        res.json(settings)
    }

    updateSettings = async (req: Request, res: Response) => {
        const parsed = updateUserSettingsSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const settings = await this.userSettingsService.updateSettings(req.user!.id, parsed.data)
        res.json(settings)
    }
}
