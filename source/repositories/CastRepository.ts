import { DbLogger } from '../utils/DbLogger'
import { activeConnection } from '../db/transactionContext'

// ═══════════════════════════════════════════════════════════════
//  Patrones: Repository + Template Method
// ═══════════════════════════════════════════════════════════════
//  Repository: Abstrae acceso a tablas actors y movie_actors.
//  Template Method: findOrCreate comparte el mismo algoritmo
//  que GenreRepository y DirectorRepository.
// ═══════════════════════════════════════════════════════════════

class CastRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => activeConnection(this.conn).query(sql, params)) as any
    }

    async findByName(name: string): Promise<number | null> {
        const [rows] = await this.query(
            'SELECT actor_id FROM actors WHERE actor_name = ?',
            [name]
        )
        return rows.length > 0 ? (rows[0].actor_id as number) : null
    }

    async create(name: string): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO actors(actor_name) VALUES(?)',
            [name]
        )
        return result.insertId as number
    }

    async findOrCreate(name: string): Promise<number> {
        const existing = await this.findByName(name)
        if (existing) return existing
        return await this.create(name)
    }

    async linkToMovie(movieId: number, actorId: number, characterName: string): Promise<void> {
        await this.query(
            'INSERT INTO movie_actors(movie_id, actor_id, character_name) VALUES(?, ?, ?)',
            [movieId, actorId, characterName]
        )
    }

    async deleteByMovieId(movieId: number): Promise<void> {
        await this.query('DELETE FROM movie_actors WHERE movie_id = ?', [movieId])
    }
}

export default CastRepository
