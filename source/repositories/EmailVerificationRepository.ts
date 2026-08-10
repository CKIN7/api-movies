import { randomUUID } from "crypto";
import { InsertEmailVerificationParams } from "../types/emailVerification";
import { DbLogger } from "../utils/DbLogger";

class EmailVerificationRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async create(params: InsertEmailVerificationParams){
        const id = randomUUID();
        
        const [rows] = await this.query(
            `INSERT INTO email_verifications(id, user_id, token, expires_at)
            VALUES(?,?,?,?)`, [id, params.userId, params.token, params.expiresAt])
    
        return id;
    }

    async findValid(token: string): Promise<string | null>{
        const [rows] = await this.query(
            `SELECT user_id FROM email_verifications 
            WHERE token = ? AND used_at IS NULL AND expires_at > NOW()`, [token])
        
        if(rows.length > 0) return rows[0].user_id
        return null
    }

    async findByToken(token: string){
        const [rows] = await this.query(
            `SELECT token, used_at FROM email_verifications
            WHERE token = ? `, [token])

        if(rows.length > 0) return rows[0]
        return null
    }

    async markUsed(token: string){
        await this.query(
            `UPDATE email_verifications SET used_at = NOW() WHERE token = ?`, [token])
    }
}

export default EmailVerificationRepository