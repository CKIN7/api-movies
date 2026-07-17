import type { MovieRow } from '../types/movie'
import type { GetMoviesQuery } from '../types/movie'
import { DbLogger } from '../utils/DbLogger'

const SORT_COLUMNS: Record<string, string> = {
    year: 'm.year',
    rating: 'm.rating',
    title: 'm.title',
}

class MovieRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findMany(query: GetMoviesQuery): Promise<{ rows: MovieRow[]; total: number }> {
        let sql = `
            SELECT m.id, m.title, m.year, d.director_name as director, m.rating, m.duration, m.plot, m.poster,
            GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres
            FROM movies m
            JOIN directors d ON m.id_director = d.director_id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre
        `

        const params: (string | number)[] = []
        const conditions: string[] = []

        if (query.year) {
            conditions.push('m.year = ?')
            params.push(query.year)
        }

        if (query.genre) {
            conditions.push(`
                m.id IN (
                    SELECT mg2.movie_id
                    FROM movie_genres mg2
                    JOIN genres g2 ON mg2.genre_id = g2.id_genre
                    WHERE g2.genre_name = ?
                )
            `)
            params.push(query.genre)
        }

        if (query.title) {
            conditions.push('m.title LIKE ?')
            params.push(`%${query.title}%`)
        }

        if (query.q) {
            const like = `%${query.q}%`
            conditions.push(`
                (m.title LIKE ? OR m.plot LIKE ? OR d.director_name LIKE ?
                OR EXISTS (
                    SELECT 1 FROM movie_genres mg2
                    JOIN genres g2 ON mg2.genre_id = g2.id_genre
                    WHERE mg2.movie_id = m.id AND g2.genre_name LIKE ?
                ))
            `)
            params.push(like, like, like, like)

        }

        let countSql = `SELECT COUNT(DISTINCT m.id) as total FROM movies m
            JOIN directors d ON m.id_director = d.director_id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre`

        if (conditions.length > 0) {
            const where = ` WHERE ${conditions.join(' AND ')}`
            sql += where
            countSql += where
        }

        const [countResult] = await this.query(countSql, [...params])
        const total = countResult[0].total

        sql += ` GROUP BY m.id`

        if (query.sort) {
            const column = SORT_COLUMNS[query.sort]
            const direction = query.order === 'asc' ? 'ASC' : 'DESC'
            if (column) {
                sql += ` ORDER BY ${column} ${direction}`
            }
        }

        sql += ` LIMIT ? OFFSET ?`
        const limitParams = [...params, query.limit, query.offset]
        const [rows] = await this.query(sql, limitParams)

        return { rows: rows as MovieRow[], total }
    }

    async findById(id: number): Promise<MovieRow | null> {
        const [rows] = await this.query(
            `SELECT id, title, year, director_name as director, rating, duration, plot, poster,
            GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres
            FROM movies
            JOIN directors AS d ON movies.id_director = d.director_id
            JOIN movie_genres ON movies.id = movie_genres.movie_id
            JOIN genres g ON movie_genres.genre_id = g.id_genre
            WHERE movies.id = ?
            GROUP BY movies.id`,
            [id]
        )
        return (rows as MovieRow[])[0] || null
    }

    async insert(data: {
        title: string
        year: number
        rating: number
        duration: number
        plot: string
        poster: string
        directorId: number
    }): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO movies(title, year, rating, duration, plot, poster, id_director) VALUES(?, ?, ?, ?, ?, ?, ?)',
            [data.title, data.year, data.rating, data.duration, data.plot, data.poster, data.directorId]
        )
        return result.insertId as number
    }

    async update(id: number, data: Partial<{
        title: string
        year: number
        rating: number
        duration: number
        plot: string
        poster: string
        directorId: number
    }>): Promise<boolean> {
        const fields: string[] = []
        const values: string[] = []

        for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster', 'directorId']) {
            const value = (data as Record<string, unknown>)[key]
            if (value !== undefined) {
                const column = key === 'directorId' ? 'id_director' : key
                fields.push(`${column} = ?`)
                values.push(value as string)
            }
        }

        if (fields.length === 0) return false

        values.push(String(id))
        const [result] = await this.query(
            `UPDATE movies SET ${fields.join(', ')} WHERE id = ?`,
            values
        )
        return (result.affectedRows as number) > 0
    }

    async delete(id: number): Promise<boolean> {
        const [result] = await this.query('DELETE FROM movies WHERE id = ?', [id])
        return (result.affectedRows as number) > 0
    }

    async countAll(): Promise<number> {
        const [rows] = await this.query('SELECT COUNT(*) as total FROM movies')
        return rows[0].total as number
    }

    async transaction<T>(fn: () => Promise<T>): Promise<T> {
        await this.conn.beginTransaction()
        try {
            const result = await fn()
            await this.conn.commit()
            return result
        } catch (error) {
            await this.conn.rollback()
            throw error
        }
    }
}

export default MovieRepository
