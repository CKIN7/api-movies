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
            `INSERT INTO email_verifications 
            VALUES(id, user_id, token, expires_at) ?,?,?,?`, [id, params.userId, params.token, params.expiresAt])
    
        return id;
    }

}

export default EmailVerificationRepository