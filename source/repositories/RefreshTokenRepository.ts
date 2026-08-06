import { randomUUID } from "crypto";
import { InsertRefreshTokenParams } from "../types/refreshToken";
import { DbLogger } from "../utils/DbLogger";

class RefreshTokenRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async create (params: InsertRefreshTokenParams){
        const id = randomUUID();

        await this.query(
            `INSERT INTO refresh_tokens(id, user_id, token, expires_at) 
            VALUES(?,?,?,?)`, [id, params.userId, params.token, params.expiresAt]);
        
        return id;
    }

    async findValid(){
        
    }
}

export default RefreshTokenRepository