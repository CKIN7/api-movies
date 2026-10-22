import type { Request, Response } from 'express'
import { UserProfileService } from '../services/userProfileService'
import { profileIdParamSchema, updateUserProfileSchema } from '../schemas/userProfile'

export class UserProfileController {
    constructor(private userProfileService: UserProfileService) {}

    getMyProfile = async (req: Request, res: Response) => {
        const profile = await this.userProfileService.getMyProfile(req.user!.id)
        res.json(profile)
    }

    updateMyProfile = async (req: Request, res: Response) => {
        const parsed = updateUserProfileSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const profile = await this.userProfileService.updateProfile(req.user!.id, parsed.data)
        res.json(profile)
    }

    getPublicProfile = async (req: Request, res: Response) => {
        const { id } = profileIdParamSchema.parse(req.params)
        const profile = await this.userProfileService.getPublicProfile(id)
        res.json(profile)
    }
}
