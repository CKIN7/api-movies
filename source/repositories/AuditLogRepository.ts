import type { AuditLogEntry, AuditLogParams, InsertAuditLogParams } from '../types/auditLog'
import { DbLogger } from '../utils/DbLogger'

class AuditLogRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByMovieId({ movieId, limit, offset }: AuditLogParams): Promise<AuditLogEntry[]> {
        let sql = `
            SELECT
                id,
                movie_id AS movieId,
                action,
                old_snapshot AS oldSnapshot,
                new_snapshot AS newSnapshot,
                changed_by AS changedBy,
                changed_at AS changedAt
            FROM audit_log
            WHERE movie_id = ?
        `
        const params: (string | number)[] = [movieId]


        sql += ` ORDER BY changed_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const [rows] = await this.query(sql, params)
        return rows as AuditLogEntry[]
    }

    async countByMovieId(movieId: number): Promise<number> {
        let sql = `SELECT COUNT(*) as total FROM audit_log WHERE movie_id = ?`
        const params: (string | number)[] = [movieId]


        const [rows] = await this.query(sql, params)
        return rows[0].total as number
    }

    async record({movieId, action, oldSnapshot, newSnapshot}: InsertAuditLogParams): Promise<void> {
        await this.query(
            `INSERT INTO audit_log (movie_id, action, old_snapshot, new_snapshot) VALUES (?, ?, ?, ?)`,
            [movieId, action, JSON.stringify(oldSnapshot), JSON.stringify(newSnapshot)]
        )
    }
}

export default AuditLogRepository
