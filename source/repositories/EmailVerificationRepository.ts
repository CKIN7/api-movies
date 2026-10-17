import { randomUUID } from "crypto";
import { EmailVerificationTokenLookup, InsertEmailVerificationParams } from "../types/emailVerification";
import { DbLogger } from "../utils/DbLogger";
import { activeConnection, runInTransaction } from "../db/transactionContext";

class EmailVerificationRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => activeConnection(this.conn).query(sql, params)) as any
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

    async findByToken(token: string): Promise<EmailVerificationTokenLookup | null>{
        const [rows] = await this.query(
            `SELECT token, used_at FROM email_verifications
            WHERE token = ? `, [token])

        if(rows.length > 0){
            return { token: rows[0].token, usedAt: rows[0].used_at ?? null }
        }
        return null
    }

    async markUsed(token: string){
        await this.query(
            `UPDATE email_verifications SET used_at = NOW() WHERE token = ?`, [token])
    }

    async revokeAllByUserId(userId: string){
        await this.query(
            `UPDATE email_verifications SET used_at = NOW() WHERE user_id = ? AND used_at IS NULL`, [userId])
    }

    async hasRecentResetRequest(userId: string, minutes: number): Promise<boolean> {
       const [rows] = await this.query(
            `SELECT id FROM email_verifications 
            WHERE user_id = ?
            AND created_at > DATE_SUB(NOW(), INTERVAL ? MINUTE)
            LIMIT 1`, [userId, minutes])

        return rows.length > 0

    }

    async findActiveTokenByUserId(userId: string): Promise<boolean> {
        const [rows] = await this.query(
            `SELECT id FROM email_verifications
            WHERE user_id = ? AND used_at IS NULL AND expires_at > NOW() LIMIT 1`,
            [userId])
    
        return rows.length > 0

    }

    // ═══════════════════════════════════════════════════════════
    //  Con un pool, la transacción toma una conexión dedicada, la
    //  publica en el contexto async (para que todas las queries de
    //  la transacción usen esa conexión) y la libera siempre.
    //  Si el conn inyectado no es un pool (p. ej. una Connection de
    //  test), se usa directamente sin reserva/liberación.
    // ═══════════════════════════════════════════════════════════
    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        const usePool = typeof this.conn.getConnection === 'function'
        const conn = usePool ? await this.conn.getConnection() : this.conn
        try {
            await conn.beginTransaction()
            const result = await runInTransaction(conn, fn)
            await conn.commit()
            return result
        } catch (error) {
            await conn.rollback()
            throw error
        } finally {
            if (usePool) conn.release()
        }
    }
}

export default EmailVerificationRepository