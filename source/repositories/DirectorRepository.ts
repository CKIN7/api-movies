import { DbLogger } from '../utils/DbLogger'

class DirectorRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByName(name: string): Promise<number | null> {
        const [rows] = await this.query(
            'SELECT director_id FROM directors WHERE director_name = ?',
            [name]
        )
        return rows.length > 0 ? (rows[0].director_id as number) : null
    }

    async create(name: string): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO directors(director_name) VALUES(?)',
            [name]
        )
        return result.insertId as number
    }

    async findOrCreate(name: string): Promise<number> {
        const existing = await this.findByName(name)
        if (existing) return existing
        return await this.create(name)
    }
}

export default DirectorRepository
