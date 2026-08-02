import { DbLogger } from "../utils/DbLogger";

class UserRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByEmail(email: string):Promise<string | null> {
        const [rows] = await this.query('SELECT email FROM users WHERE email = ?', [email]);
        
        if(rows.length > 0) return rows.email
        return null
    }

    async findById(){

    }

    async create(){

    }
}

export default UserRepository