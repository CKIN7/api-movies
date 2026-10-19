import { ContentFilters, GenreAffinity, UserPreferencesRow } from '../types/user'
import { DbLogger } from '../utils/DbLogger'

export interface UserPreferencesData {
    favoriteGenres: number[]
    favoriteDirectors: number[]
    favoriteActors: number[]
    dislikedGenres: number[]
    dislikedDirectors: number[]
    dislikedActors: number[]
    contentFilters: ContentFilters
}

export interface UserPreferencesInsertData extends UserPreferencesData {
    genreAffinity: GenreAffinity
}

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

    async insert(userId: string, data: UserPreferencesInsertData): Promise<void> {
        await this.query(
            `INSERT INTO user_preferences
             (user_id, favorite_genres, favorite_directors, favorite_actors,
              disliked_genres, disliked_directors, disliked_actors, content_filters, genre_affinity)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId,
                JSON.stringify(data.favoriteGenres),
                JSON.stringify(data.favoriteDirectors),
                JSON.stringify(data.favoriteActors),
                JSON.stringify(data.dislikedGenres),
                JSON.stringify(data.dislikedDirectors),
                JSON.stringify(data.dislikedActors),
                JSON.stringify(data.contentFilters),
                JSON.stringify(data.genreAffinity),
            ]
        )
    }

    async update(userId: string, data: UserPreferencesData): Promise<void> {
        await this.query(
            `UPDATE user_preferences
             SET favorite_genres = ?, favorite_directors = ?, favorite_actors = ?,
                 disliked_genres = ?, disliked_directors = ?, disliked_actors = ?,
                 content_filters = ?
             WHERE user_id = ?`,
            [
                JSON.stringify(data.favoriteGenres),
                JSON.stringify(data.favoriteDirectors),
                JSON.stringify(data.favoriteActors),
                JSON.stringify(data.dislikedGenres),
                JSON.stringify(data.dislikedDirectors),
                JSON.stringify(data.dislikedActors),
                JSON.stringify(data.contentFilters),
                userId,
            ]
        )
    }

    async saveAffinity(userId: string, affinity: GenreAffinity): Promise<void> {
        await this.query(
            'UPDATE user_preferences SET genre_affinity = ? WHERE user_id = ?',
            [JSON.stringify(affinity), userId]
        )
    }

    async existingGenreIds(ids: number[]): Promise<number[]> {
        const [rows] = await this.query(
            'SELECT id_genre FROM genres WHERE id_genre IN (?)',
            [ids]
        )
        return (rows as { id_genre: number }[]).map(r => r.id_genre)
    }

    async existingDirectorIds(ids: number[]): Promise<number[]> {
        const [rows] = await this.query(
            'SELECT director_id FROM directors WHERE director_id IN (?)',
            [ids]
        )
        return (rows as { director_id: number }[]).map(r => r.director_id)
    }

    async existingActorIds(ids: number[]): Promise<number[]> {
        const [rows] = await this.query(
            'SELECT actor_id FROM actors WHERE actor_id IN (?)',
            [ids]
        )
        return (rows as { actor_id: number }[]).map(r => r.actor_id)
    }

    async getStats(userId: string): Promise<{
        topGenres: { genreId: number; genreName: string; count: number }[]
        topDirectors: { directorId: number; directorName: string; count: number }[]
        totalReviews: number
        totalWatchlist: number
    }> {
        const [genreRows] = await this.query(
            `SELECT mg.genre_id AS genreId, g.genre_name AS genreName, COUNT(*) AS count
             FROM reviews r
             JOIN movie_genres mg ON r.movie_id = mg.movie_id
             JOIN genres g ON mg.genre_id = g.id_genre
             WHERE r.user_id = ?
             GROUP BY mg.genre_id, g.genre_name
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
