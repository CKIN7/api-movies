import { AuditLogEntry, AuditLogParams } from "../types/auditLog"
import { DbLogger } from "../utils/DbLogger"

class AuditLogModel {
    private conn: any

    constructor(conn?: any){
        this.conn = conn
    }

    private async query(sql: string, params?: any[]) {
            return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
        }
    

    async getByMovieId({ movieId, field, limit, offset }: AuditLogParams): Promise<AuditLogEntry[]>{
        
       let sql = `
        SELECT
            id,
            movie_id AS movieId,
            field_name AS fieldName,
            old_value AS oldValue,
            new_value AS newValue,
            changed_by AS changedBy,
            changed_at AS changedAt
        FROM audit_log
        WHERE movie_id = ?
        `
        
        const params: (string | number)[] = [movieId]

        if(field){
            sql += ` AND field_name = ?`
            params.push(field)
        }

        sql += ` ORDER BY changed_at DESC LIMIT ? OFFSET ?`
        params.push(limit, offset)

        const [rows] = await this.query(sql, params)
        return rows as AuditLogEntry[]
    }

    async countMovieById(movieId:number, field?: string): Promise<number> {
        
        let sql = `
         SELECT COUNT(*) as total FROM audit_log
         WHERE movie_id = ?
        `
        const params: (string | number)[] = [movieId]
        
        if (field) { sql += ` AND field_name = ?`; params.push(field) }

        const result = await this.conn.query(sql, params)

        return result[0].total
    }
    
}

export default AuditLogModel
