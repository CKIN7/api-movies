import type { WatchlistRow } from '../types/watchlist'
import type { MovieRow } from '../types/movie'
import type { WatchlistQueryDTO } from '../schemas/watchlistSchema'
import { DbLogger } from '../utils/DbLogger'
import MovieQueryBuilder from './MovieQueryBuilder'

class WatchlistRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async create(userId: string, movieId: number, notes: string | null, priority: number): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO user_watchlists (user_id, movie_id, notes, priority) VALUES (?, ?, ?, ?)',
            [userId, movieId, notes, priority]
        )
        return result.insertId as number
    }

    async findByUserId(userId: string, query: WatchlistQueryDTO, offset: number): Promise<{ rows: WatchlistRow[]; total: number }> {
        let sql = `
            SELECT wl.id, wl.user_id, wl.movie_id, wl.notes, wl.priority, wl.added_at,
                   m.id, m.title, m.year, d.director_name as director, m.rating, m.duration, m.plot, m.poster, m.age_rating,
                   GROUP_CONCAT(DISTINCT g.genre_name ORDER BY g.genre_name SEPARATOR ', ') AS genres,
                   GROUP_CONCAT(DISTINCT CONCAT(a.actor_name, '||', ma.character_name) ORDER BY a.actor_name SEPARATOR '|||') AS \`cast\`,
                   COALESCE(rv.avg_rating, NULL) as average_rating,
                   COALESCE(rv.reviews_count, 0) as reviews_count
            FROM user_watchlists wl
            JOIN movies m ON wl.movie_id = m.id
            JOIN directors d ON m.id_director = d.director_id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre
            LEFT JOIN movie_actors ma ON m.id = ma.movie_id
            LEFT JOIN actors a ON ma.actor_id = a.actor_id
            LEFT JOIN (
                SELECT movie_id, AVG(rating) as avg_rating, COUNT(*) as reviews_count
                FROM reviews
                GROUP BY movie_id
            ) rv ON rv.movie_id = m.id
            WHERE wl.user_id = ?
        `

        const params: any[] = [userId]

        if (query.genre) {
            sql += ` AND g.genre_name LIKE ?`
            params.push(`%${query.genre}%`)
        }

        let countSql = `
            SELECT COUNT(*) as total
            FROM user_watchlists wl
            JOIN movies m ON wl.movie_id = m.id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre
            WHERE wl.user_id = ?
        `
        const countParams = [userId]

        if (query.genre) {
            countSql += ` AND g.genre_name LIKE ?`
            countParams.push(`%${query.genre}%`)
        }

        const [countResult] = await this.query(countSql, countParams)
        const total = countResult[0].total

        sql += ` GROUP BY wl.id, m.id, m.title, m.year, d.director_name, m.rating, m.duration, m.plot, m.poster, m.age_rating`

        const sortMap: Record<string, string> = {
            addedAt: 'wl.added_at',
            title: 'm.title',
            year: 'm.year',
            rating: 'm.rating',
            priority: 'wl.priority'
        }
        const sortBy = sortMap[query.sortBy] || 'wl.added_at'
        const sortOrder = query.sortOrder === 'asc' ? 'ASC' : 'DESC'
        sql += ` ORDER BY ${sortBy} ${sortOrder}`

        sql += ` LIMIT ? OFFSET ?`
        params.push(query.limit, offset)

        const [rows] = await this.query(sql, params)

        return { rows: rows as WatchlistRow[], total }

        // Filtro simple inline (genre LIKE). 
        // Si se añaden más filtros (year range, rating range, title search, director search, ageRating, full-text),
        // extraer WatchlistQueryBuilder o reutilizar MovieQueryBuilder adaptado (ver MovieRepository.ts:46).
    }

    async findByUserAndMovie(userId: string, movieId: number): Promise<WatchlistRow | null> {
        const [rows] = await this.query(
            `SELECT id, user_id, movie_id, notes, priority, added_at
             FROM user_watchlists
             WHERE user_id = ? AND movie_id = ?`,
            [userId, movieId]
        )
        return (rows as WatchlistRow[])[0] || null
    }

    async delete(userId: string, movieId: number): Promise<boolean> {
        const [result] = await this.query(
            'DELETE FROM user_watchlists WHERE user_id = ? AND movie_id = ?',
            [userId, movieId]
        )
        return (result.affectedRows as number) > 0
    }

    async existsMovie(movieId: number): Promise<boolean> {
        const [rows] = await this.query('SELECT 1 FROM movies WHERE id = ?', [movieId])
        return rows.length > 0
    }
}

export default WatchlistRepository