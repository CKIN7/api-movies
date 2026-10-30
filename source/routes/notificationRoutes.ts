import express from 'express'
import NotificationController from '../controllers/notificationController'
import { requireAuth } from '../middleware/requireAuth'

export function createNotificationRoutes(controller: NotificationController) {
    const router = express.Router()

    router.get('/me/notifications', requireAuth, controller.list)
    router.get('/me/notifications/unread-count', requireAuth, controller.unreadCount)
    router.patch('/me/notifications/read-all', requireAuth, controller.markAllRead)
    router.patch('/me/notifications/:id/read', requireAuth, controller.markRead)

    return router
}
