import type {
    CreateNotificationDTO,
    NotificationListQueryDTO,
    NotificationRow,
} from '../types/notification'
import { DbLogger } from '../utils/DbLogger'

class NotificationRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    // INSERT IGNORE + UNIQUE (user_id, type, dedupe_key): un reintento del
    // job o un doble add es un no-op. Devuelve true solo si insertó.
    async insertIgnore(dto: CreateNotificationDTO): Promise<boolean> {
        const [result] = await this.query(
            `INSERT IGNORE INTO notifications (user_id, type, dedupe_key, payload)
             VALUES (?, ?, ?, ?)`,
            [dto.userId, dto.type, dto.dedupeKey, JSON.stringify(dto.payload)]
        )
        return (result as any).affectedRows > 0
    }

    async findByUserId(
        userId: string,
        query: NotificationListQueryDTO,
        offset: number
    ): Promise<{ rows: NotificationRow[]; total: number }> {
        const where = query.unreadOnly
            ? 'WHERE user_id = ? AND read_at IS NULL'
            : 'WHERE user_id = ?'

        const [rows] = await this.query(
            `SELECT * FROM notifications
             ${where}
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?`,
            [userId, query.limit, offset]
        )

        const [countRows] = await this.query(
            `SELECT COUNT(*) AS total FROM notifications ${where}`,
            [userId]
        )

        return {
            rows: rows as NotificationRow[],
            total: (countRows as any)[0].total as number,
        }
    }

    async findByIdForUser(userId: string, id: string): Promise<NotificationRow | null> {
        const [rows] = await this.query(
            'SELECT * FROM notifications WHERE id = ? AND user_id = ? LIMIT 1',
            [id, userId]
        )
        return (rows as NotificationRow[])[0] || null
    }

    // Marca leída sin pisar un read_at previo (idempotente).
    async markRead(userId: string, id: string): Promise<NotificationRow | null> {
        await this.query(
            `UPDATE notifications
             SET read_at = COALESCE(read_at, NOW())
             WHERE id = ? AND user_id = ?`,
            [id, userId]
        )
        return this.findByIdForUser(userId, id)
    }

    async markAllRead(userId: string): Promise<number> {
        const [result] = await this.query(
            'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
            [userId]
        )
        return (result as any).affectedRows as number
    }

    async countUnread(userId: string): Promise<number> {
        const [rows] = await this.query(
            'SELECT COUNT(*) AS unread FROM notifications WHERE user_id = ? AND read_at IS NULL',
            [userId]
        )
        return (rows as any)[0].unread as number
    }
}

export default NotificationRepository
