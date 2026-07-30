import type { MovieRow, SimilarMovieRow } from '../types/movie'
import type { MovieQueryDTO } from '../schemas/movieQuery'
import type { RandomMovieQueryDTO } from '../schemas/randomMovieQuery'
import { DbLogger } from '../utils/DbLogger'
import MovieQueryBuilder from './MovieQueryBuilder';
import { SuggestQueryDTO } from '../schemas/suggestQuerySchema';

// ═══════════════════════════════════════════════════════════════
//  Patrón: Repository
// ═══════════════════════════════════════════════════════════════
//  Abstrae el acceso a datos de la tabla movies. Encapsula
//  consultas SQL detrás de métodos de dominio (findMany, findById,
//  insert, update, delete). El servicio nunca escribe SQL directo.
// ═══════════════════════════════════════════════════════════════
//  También implementa Transaction Script con transaction<T>(),
//  manejando beginTransaction/commit/rollback automáticamente.
// ═══════════════════════════════════════════════════════════════

class MovieRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findMany(query: MovieQueryDTO, offset: number): Promise<{ rows: MovieRow[]; total: number }> {
        let sql = `
            SELECT m.id, m.title, m.year, d.director_name as director, m.rating, m.duration, m.plot, m.poster, m.age_rating,
            GROUP_CONCAT(DISTINCT genre_name ORDER BY genre_name SEPARATOR ', ') AS genres,
            GROUP_CONCAT(DISTINCT CONCAT(a.actor_name, '||', ma.character_name) ORDER BY a.actor_name SEPARATOR '|||') AS \`cast\`
            FROM movies m
            JOIN directors d ON m.id_director = d.director_id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre
            LEFT JOIN movie_actors ma ON m.id = ma.movie_id
            LEFT JOIN actors a ON ma.actor_id = a.actor_id
        `

        const {conditions, params} = new MovieQueryBuilder(query).build()

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
            const direction = query.order === 'asc' ? 'ASC' : 'DESC'
            sql += ` ORDER BY ${query.sort} ${direction}`
        }

        sql += ` LIMIT ? OFFSET ?`
        const limitParams = [...params, query.limit, offset]
        const [rows] = await this.query(sql, limitParams)

        return { rows: rows as MovieRow[], total }
    }

    async findById(id: number): Promise<MovieRow | null> {
        const [rows] = await this.query(
            `SELECT id, title, year, director_name as director, rating, duration, plot, poster, age_rating,
            GROUP_CONCAT(DISTINCT genre_name ORDER BY genre_name SEPARATOR ', ') AS genres,
            GROUP_CONCAT(DISTINCT CONCAT(a.actor_name, '||', ma.character_name) ORDER BY a.actor_name SEPARATOR '|||') AS \`cast\`
            FROM movies
            JOIN directors AS d ON movies.id_director = d.director_id
            JOIN movie_genres ON movies.id = movie_genres.movie_id
            JOIN genres g ON movie_genres.genre_id = g.id_genre
            LEFT JOIN movie_actors ma ON movies.id = ma.movie_id
            LEFT JOIN actors a ON ma.actor_id = a.actor_id
            WHERE movies.id = ?
            GROUP BY movies.id`,
            [id]
        )
        return (rows as MovieRow[])[0] || null
    }

    async findSimilar(id: number, limit: number, offset: number): Promise<{ rows: SimilarMovieRow[], total: number }>{
        const [sourceRows] = await this.query(
            `SELECT id, id_director, year FROM movies WHERE id = ?`, [id]
        )

        if (sourceRows.length === 0) {
            return { rows: [], total: 0 }
        }

        const sourceDirectorId = sourceRows[0].id_director
        const sourceYear = sourceRows[0].year

        const similarSql = `
            SELECT m.id, m.title, m.year, m.rating, d.director_name AS director,
                   GROUP_CONCAT(DISTINCT g.genre_name ORDER BY g.genre_name SEPARATOR ', ') AS genres,
                   (
                       COALESCE(SUM(CASE WHEN mg2.genre_id IS NOT NULL THEN 2 ELSE 0 END), 0)
                       + CASE WHEN m.id_director = ? THEN 3 ELSE 0 END
                       + CASE WHEN ABS(m.year - ?) <= 5 THEN 1 ELSE 0 END
                   ) AS similarityScore
            FROM movies m
            JOIN directors d ON m.id_director = d.director_id
            JOIN movie_genres mg ON m.id = mg.movie_id
            JOIN genres g ON mg.genre_id = g.id_genre
            LEFT JOIN movie_genres mg2
                ON m.id = mg2.movie_id
                AND mg2.genre_id IN (SELECT genre_id FROM movie_genres WHERE movie_id = ?)
            WHERE m.id != ?
            GROUP BY m.id
            HAVING similarityScore > 0
            ORDER BY similarityScore DESC, m.rating DESC
        `

        const params: any[] = [sourceDirectorId, sourceYear, id, id]

        const countSql = `SELECT COUNT(*) AS total FROM (${similarSql}) AS similar`
        const [countResult] = await this.query(countSql, params)
        const total = countResult[0].total

        const limitParams = [...params, limit, offset]
        const [rows] = await this.query(`${similarSql} LIMIT ? OFFSET ?`, limitParams)

        return { rows: rows as SimilarMovieRow[], total }
    }

    async findRandom (query: RandomMovieQueryDTO): Promise<number | null> {
        let sql = `SELECT m.id FROM movies m`
        
        const {conditions, params} = new MovieQueryBuilder(query).buildRandom()

        if(conditions.length > 0){
            const where = ` WHERE ${conditions.join(' AND ')}`
            sql += where
        }

        sql += ` ORDER BY RAND()
                LIMIT 1;`        
        const [rows] = await this.query(sql, params)

        const result = rows as { id: number }[]
        
        if (result.length === 0) return null
        return result[0].id
    }

    async findRandomBatch(query: RandomMovieQueryDTO){
        


    }

    async suggest(query: SuggestQueryDTO): Promise<string[]>{

        const {sql, params, column} = MovieQueryBuilder.buildSuggest(query)
        
        const [rows] = await this.query(sql, params)

        return rows.map((r: any) => r[column] as string)

    }

    async insert(data: {
        title: string
        year: number
        rating: number
        duration: number
        plot: string
        poster: string
        directorId: number
        ageRating: string
    }): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO movies(title, year, rating, duration, plot, poster, id_director, age_rating) VALUES(?, ?, ?, ?, ?, ?, ?, ?)',
            [data.title, data.year, data.rating, data.duration, data.plot, data.poster, data.directorId, data.ageRating]
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
        ageRating: string
    }>): Promise<boolean> {
        const fields: string[] = []
        const values: string[] = []

        for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster', 'directorId', 'ageRating']) {
            const value = (data as Record<string, unknown>)[key]
            if (value !== undefined) {
                const column = key === 'directorId' ? 'id_director' : key === 'ageRating' ? 'age_rating' : key
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

    // ═══════════════════════════════════════════════════════════
    //  Patrón: Transaction Script
    // ═══════════════════════════════════════════════════════════
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
