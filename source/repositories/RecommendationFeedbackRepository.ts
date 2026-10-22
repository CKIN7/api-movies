import { DbLogger } from '../utils/DbLogger'
import type { FeedbackAction } from '../types/recommendation'

export class RecommendationFeedbackRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async create(userId: string, movieId: number, action: FeedbackAction): Promise<boolean> {
        try {
            await this.query(
                `INSERT INTO recommendation_feedback (user_id, movie_id, action)
                 VALUES (?, ?, ?)`,
                [userId, movieId, action]
            )
            return true
        } catch (error) {
            if ((error as { code?: string }).code === 'ER_DUP_ENTRY') return false
            throw error
        }
    }

    async getExcludedMovieIds(userId: string): Promise<number[]> {
        const [rows] = await this.query(
            `SELECT DISTINCT movie_id AS movieId
             FROM recommendation_feedback
             WHERE user_id = ? AND action = 'not_interested'`,
            [userId]
        )

        return (rows as any[]).map((row) => Number(row.movieId))
    }

    async getGenreIds(movieId: number): Promise<number[]> {
        const [rows] = await this.query(
            'SELECT genre_id AS genreId FROM movie_genres WHERE movie_id = ? ORDER BY genre_id',
            [movieId]
        )

        return (rows as any[]).map((row) => Number(row.genreId))
    }
}
