import { UserPreferencesRow } from '../types/user'
import { DbLogger } from '../utils/DbLogger'

export class UserPreferencesRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByUserId(userId: string): Promise<UserPreferencesRow | null> {
        const [rows] = await this.query(
            'SELECT * FROM user_preferences WHERE user_id = ?',
            [userId]
        )
        return (rows as UserPreferencesRow[])[0] || null
    }

    async upsert(userId: string, data: {
        favoriteGenres?: number[]
        favoriteDirectors?: number[]
        favoriteActors?: number[]
    }): Promise<void> {
        const existing = await this.findByUserId(userId)

        const favoriteGenres = data.favoriteGenres !== undefined
            ? JSON.stringify(data.favoriteGenres)
            : existing?.favorite_genres ?? null
        const favoriteDirectors = data.favoriteDirectors !== undefined
            ? JSON.stringify(data.favoriteDirectors)
            : existing?.favorite_directors ?? null
        const favoriteActors = data.favoriteActors !== undefined
            ? JSON.stringify(data.favoriteActors)
            : existing?.favorite_actors ?? null

        if (existing) {
            await this.query(
                `UPDATE user_preferences
                 SET favorite_genres = ?, favorite_directors = ?, favorite_actors = ?
                 WHERE user_id = ?`,
                [favoriteGenres, favoriteDirectors, favoriteActors, userId]
            )
        } else {
            await this.query(
                `INSERT INTO user_preferences (user_id, favorite_genres, favorite_directors, favorite_actors)
                 VALUES (?, ?, ?, ?)`,
                [userId, favoriteGenres, favoriteDirectors, favoriteActors]
            )
        }
    }

    async updateGenreAffinity(userId: string, genreId: number, delta: number): Promise<void> {
        const existing = await this.findByUserId(userId)
        const affinity: Record<string, number> = existing?.genre_affinity
            ? JSON.parse(existing.genre_affinity)
            : {}

        const key = String(genreId)
        affinity[key] = (affinity[key] || 0) + delta
        if (affinity[key] <= 0) delete affinity[key]

        if (existing) {
            await this.query(
                'UPDATE user_preferences SET genre_affinity = ? WHERE user_id = ?',
                [JSON.stringify(affinity), userId]
            )
        } else {
            await this.query(
                'INSERT INTO user_preferences (user_id, genre_affinity) VALUES (?, ?)',
                [userId, JSON.stringify(affinity)]
            )
        }
    }

    async getStats(userId: string): Promise<{
        topGenres: { genreId: number; genreName: string; count: number }[]
        topDirectors: { directorId: number; directorName: string; count: number }[]
        totalReviews: number
        totalWatchlist: number
    }> {
        const [genreRows] = await this.query(
            `SELECT mg.genre_id AS genreId, g.genreName, COUNT(*) AS count
             FROM reviews r
             JOIN movie_genres mg ON r.movie_id = mg.movie_id
             JOIN genres g ON mg.genre_id = g.id_genre
             WHERE r.user_id = ?
             GROUP BY mg.genre_id, g.genreName
             ORDER BY count DESC
             LIMIT 5`,
            [userId]
        )

        const [directorRows] = await this.query(
            `SELECT m.id_director AS directorId, d.director_name AS directorName, COUNT(*) AS count
             FROM reviews r
             JOIN movies m ON r.movie_id = m.id
             JOIN directors d ON m.id_director = d.director_id
             WHERE r.user_id = ?
             GROUP BY m.id_director, d.director_name
             ORDER BY count DESC
             LIMIT 5`,
            [userId]
        )

        const [reviewCount] = await this.query(
            'SELECT COUNT(*) AS count FROM reviews WHERE user_id = ?',
            [userId]
        )

        const [watchlistCount] = await this.query(
            'SELECT COUNT(*) AS count FROM user_watchlists WHERE user_id = ?',
            [userId]
        )

        return {
            topGenres: genreRows as any[],
            topDirectors: directorRows as any[],
            totalReviews: (reviewCount as any[])[0]?.count || 0,
            totalWatchlist: (watchlistCount as any[])[0]?.count || 0,
        }
    }
}
