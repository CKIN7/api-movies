import { DbLogger } from '../utils/DbLogger'
import type { RecommendationCandidateRow, UserInteraction } from '../types/recommendation'

export interface AllInteractionRow {
    userId: string
    movieId: number
    weight: number
}

export class RecommendationRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async getUserInteractions(userId: string): Promise<UserInteraction[]> {
        const [rows] = await this.query(
            `SELECT movie_id AS movieId, MAX(weight) AS weight FROM (
                SELECT movie_id, rating AS weight FROM reviews WHERE user_id = ?
                UNION ALL
                SELECT movie_id, priority AS weight FROM user_watchlists WHERE user_id = ?
             ) AS interactions
             GROUP BY movie_id`,
            [userId, userId]
        )
        return (rows as any[]).map(r => ({ movieId: Number(r.movieId), weight: Number(r.weight) }))
    }

    async getAllInteractions(): Promise<AllInteractionRow[]> {
        const [rows] = await this.query(
            `SELECT user_id AS userId, movie_id AS movieId, MAX(weight) AS weight FROM (
                SELECT user_id, movie_id, rating AS weight FROM reviews
                UNION ALL
                SELECT user_id, movie_id, priority AS weight FROM user_watchlists
             ) AS interactions
             GROUP BY user_id, movie_id`
        )
        return (rows as any[]).map(r => ({
            userId: String(r.userId),
            movieId: Number(r.movieId),
            weight: Number(r.weight),
        }))
    }

    async getCandidates(): Promise<RecommendationCandidateRow[]> {
        const [rows] = await this.query(
            `SELECT m.id, m.title, m.year, m.rating, m.duration, m.age_rating, m.id_director,
                    COALESCE(GROUP_CONCAT(DISTINCT mg.genre_id), '') AS genreIds,
                    COALESCE(GROUP_CONCAT(DISTINCT g.genre_name), '') AS genreNames,
                    COALESCE(GROUP_CONCAT(DISTINCT ma.actor_id), '') AS actorIds
             FROM movies m
             LEFT JOIN movie_genres mg ON mg.movie_id = m.id
             LEFT JOIN genres g ON g.id_genre = mg.genre_id
             LEFT JOIN movie_actors ma ON ma.movie_id = m.id
             GROUP BY m.id, m.title, m.year, m.rating, m.duration, m.age_rating, m.id_director`
        )
        return rows as RecommendationCandidateRow[]
    }
}
