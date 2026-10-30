import NotificationRepository from '../repositories/NotificationRepository'
import { Notification } from '../domain/Notification'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import type {
    CreateNotificationDTO,
    NotificationListQueryDTO,
    NotificationResponse,
    PaginatedNotificationsResponse,
} from '../types/notification'

// El id público viaja como string (BIGINT); la ruta debe ser numérica.
const NUMERIC_ID = /^[1-9]\d*$/

export class NotificationService {
    constructor(private repo: NotificationRepository) {}

    private parseId(id: string): string {
        if (!NUMERIC_ID.test(id)) {
            throw new AppError('Identificador de notificación inválido', 400)
        }
        return id
    }

    async list(userId: string, query: NotificationListQueryDTO): Promise<PaginatedNotificationsResponse> {
        try {
            const offset = (query.page - 1) * query.limit
            const { rows, total } = await this.repo.findByUserId(userId, query, offset)

            return {
                notifications: rows.map((row) => Notification.fromRow(row).toResponse()),
                total,
                page: query.page,
                limit: query.limit,
            }
        } catch (error) {
            logger.error(`Error in listNotifications: ${(error as Error).message}`)
            throw new AppError('Error al obtener las notificaciones', 500)
        }
    }

    async unreadCount(userId: string): Promise<number> {
        try {
            return await this.repo.countUnread(userId)
        } catch (error) {
            logger.error(`Error in unreadCount: ${(error as Error).message}`)
            throw new AppError('Error al obtener el contador de notificaciones', 500)
        }
    }

    async markRead(userId: string, id: string): Promise<NotificationResponse> {
        const parsedId = this.parseId(id)
        try {
            const row = await this.repo.markRead(userId, parsedId)
            if (!row) throw new AppError('Notificación no encontrada', 404)
            return Notification.fromRow(row).toResponse()
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in markRead: ${(error as Error).message}`)
            throw new AppError('Error al marcar la notificación como leída', 500)
        }
    }

    async markAllRead(userId: string): Promise<number> {
        try {
            return await this.repo.markAllRead(userId)
        } catch (error) {
            logger.error(`Error in markAllRead: ${(error as Error).message}`)
            throw new AppError('Error al marcar las notificaciones como leídas', 500)
        }
    }

    // Usado por el worker in-app. Es idempotente: devuelve false si la
    // notificación ya existía (dedupe_key repetida), sin lanzar error.
    async create(dto: CreateNotificationDTO): Promise<boolean> {
        try {
            return await this.repo.insertIgnore(dto)
        } catch (error) {
            logger.error(`Error in createNotification: ${(error as Error).message}`)
            throw new AppError('Error al crear la notificación', 500)
        }
    }
}

export default NotificationService
