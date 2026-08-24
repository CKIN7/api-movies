import { DbLogger } from "../utils/DbLogger";

class ReviewRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByMovieId(params): Promise<>{
        const result = await this.query('SELECT * FROM reviews')
    }
}

export default ReviewRepository