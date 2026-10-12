import { InsertUserParams, UserRow } from "../types/user";
import { DbLogger } from "../utils/DbLogger";
import { randomUUID } from 'crypto'

class UserRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByEmail(email: string):Promise<UserRow | null> {
        const [rows] = await this.query('SELECT id, email, password_hash, role, created_at, email_verified, email_verified_at FROM users WHERE email = ?', [email]);
        
        if(rows.length > 0){
            return {
                id: rows[0].id,
                email: rows[0].email,
                passwordHash: rows[0].password_hash,
                role: rows[0].role,
                createdAt: rows[0].created_at,
                emailVerified: rows[0].email_verified === 1 || rows[0].email_verified === true,
                emailVerifiedAt: rows[0].email_verified_at ?? null
            }
        }
        return null
    }

    async findById(id: string):Promise<UserRow | null> {
        const [rows] = await this.query('SELECT id, email, password_hash, role, created_at, email_verified, email_verified_at FROM users where id = ?', [id])

        if(rows.length > 0) {
            return {
                id: rows[0].id,
                email: rows[0].email,
                passwordHash: rows[0].password_hash,
                role: rows[0].role,
                createdAt: rows[0].created_at,
                emailVerified: rows[0].email_verified === 1 || rows[0].email_verified === true,
                emailVerifiedAt: rows[0].email_verified_at ?? null
            }
        }
        return null
    }

    async create(params: InsertUserParams): Promise<{id: string, email: string, role: string}>{
        const userId = randomUUID();

        const [rows] = await this.query(`INSERT INTO users(id, email, password_hash, role) VALUES(?,?,?,?)`
            ,[userId, params.email, params.passwordHash, params.role])

        return {
            id: userId, 
            email: params.email, 
            role: params.role
        }

    }

    async markEmail(userId: string){
        await this.query(
            `UPDATE users SET email_verified = 1, email_verified_at = NOW() WHERE id = ?`, [userId])
    }

    async updatePassword(passwordHash: string, userId: string){
        await this.query(
            `UPDATE users SET password_hash = ? WHERE id = ?`, [passwordHash, userId]
        )
    }

    async updateRole(userId: string, role: string){
        await this.query(
            `UPDATE users SET role = ? WHERE id = ?`, [role, userId]
        )
    }
}

export default UserRepository