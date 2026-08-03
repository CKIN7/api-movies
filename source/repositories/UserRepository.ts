import { InsertUserParams } from "../types/user";
import { DbLogger } from "../utils/DbLogger";
import { randomUUID } from 'crypto'

class UserRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByEmail(email: string):Promise<string | null> {
        const [rows] = await this.query('SELECT email FROM users WHERE email = ?', [email]);
        
        if(rows.length > 0) return rows[0].email
        return null
    }

    async findById(id: string):Promise<string | null> {
        const [rows] = await this.query('SELECT * FROM users where id = ?', [id])

        if(rows.length > 0) return rows[0].email
        return null
    }

    async create(params: InsertUserParams): Promise<{userId: string, email: string, userRole: string}>{
        const userId = randomUUID();
        const userRole = params.role ?? 'user'

        const [rows] = await this.query(`INSERT INTO users(id, email, password_hash, role) VALUES(?,?,?,?)`
            ,[userId, params.email, params.passwordHash, userRole])

        return {
            userId, 
            email: params.email, 
            userRole
        }

    }
}

export default UserRepository