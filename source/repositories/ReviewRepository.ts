import { ReviewRow, ReviewsSummary } from "../types/review";
import { DbLogger } from "../utils/DbLogger";

class ReviewRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByMovieId({movie, limit, offset}): Promise<ReviewRow[]>{
        const [rows] = await this.query(
            `SELECT r.*, u.email FROM reviews r
            JOIN users u ON r.user_id = u.id
            WHERE r.movie_id = ?
            ORDER BY r.created_at DESC
            LIMIT ? OFFSET ?
            `, [movie, limit, offset])
        
        return rows as ReviewRow[]
    }

    async summaryByMovieId(movieId: number): Promise<ReviewsSummary> {
        const [rows] = await this.query(
            `SELECT AVG(rating) as avg_rating, COUNT(*) as count
            FROM reviews WHERE movie_id = ?`, [movieId]
        )

        const row = rows[0]
        return {
            average: row.avg_rating !== null ? Number(row.avg_rating) : null,
            count: row.count as number
        }
    }
}

export default ReviewRepository