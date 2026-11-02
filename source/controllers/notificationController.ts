import type { Request, Response } from 'express'
import NotificationService from '../services/NotificationService'
import { notificationIdParamSchema, notificationListQuerySchema } from '../schemas/notification'

class NotificationController {
    constructor(private notificationService: NotificationService) {}

    list = async (req: Request, res: Response) => {
        const parsed = notificationListQuerySchema.safeParse(req.query)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const result = await this.notificationService.list(req.user!.id, parsed.data)
        res.json(result)
    }

    unreadCount = async (req: Request, res: Response) => {
        const unread = await this.notificationService.unreadCount(req.user!.id)
        res.json({ unread })
    }

    markRead = async (req: Request, res: Response) => {
        const parsed = notificationIdParamSchema.safeParse(req.params)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const notification = await this.notificationService.markRead(req.user!.id, parsed.data.id)
        res.json({ notification })
    }

    markAllRead = async (req: Request, res: Response) => {
        const updated = await this.notificationService.markAllRead(req.user!.id)
        res.json({ updated })
    }
}

export default NotificationController
