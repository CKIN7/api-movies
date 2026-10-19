import { randomUUID } from "crypto";
import { InsertRefreshTokenParams, RefreshTokenRow } from "../types/refreshToken";
import { DbLogger } from "../utils/DbLogger";
import { activeConnection } from "../db/transactionContext";

class RefreshTokenRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => activeConnection(this.conn).query(sql, params)) as any
    }

    async create (params: InsertRefreshTokenParams){
        const id = randomUUID();

        await this.query(
            `INSERT INTO refresh_tokens(id, user_id, token, expires_at) 
            VALUES(?,?,?,?)`, [id, params.userId, params.token, params.expiresAt]);
        
        return id;
    }

    async findValid(token: string): Promise<RefreshTokenRow | null> {
        const [rows] = await this.query(
            `SELECT id, user_id, token, expires_at, revoked_at, created_at 
             FROM refresh_tokens
             WHERE token = ?
             AND revoked_at IS NULL
             AND expires_at > NOW()
            `, [token])

        if(rows.length > 0) {
            return {
                id: rows[0].id,
                userId: rows[0].user_id,
                token: rows[0].token,
                expiresAt: rows[0].expires_at,
                revokedAt: rows[0].revoked_at,
                createdAt: rows[0].created_at,
            }
        }
        return null
    }

    async revoke(token: string): Promise<void> {
        await this.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE token = ?`, [token])
    }

    async findByToken(token: string): Promise<RefreshTokenRow | null> {
        const [rows] = await this.query(
            `SELECT id, user_id, token, expires_at, revoked_at, created_at
            FROM refresh_tokens
            WHERE token = ?
            `, [token])
        
        if(rows.length > 0) {
            return {
                id: rows[0].id,
                userId: rows[0].user_id,
                token: rows[0].token,
                expiresAt: rows[0].expires_at,
                revokedAt: rows[0].revoked_at,
                createdAt: rows[0].created_at,
            }
        }
        return null;
    }

    async revokeAllByUserId(userId: string): Promise<void> {
        await this.query(`UPDATE refresh_tokens SET revoked_at = NOW() WHERE user_id = ? AND revoked_at IS NULL `, [userId])
    }
}

export default RefreshTokenRepository