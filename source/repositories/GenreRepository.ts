import { DbLogger } from '../utils/DbLogger'

// ═══════════════════════════════════════════════════════════════
//  Patrones: Repository + Template Method
// ═══════════════════════════════════════════════════════════════
//  Repository: Abstrae acceso a tabla genres.
//  Template Method: findOrCreate sigue el mismo algoritmo en
//  GenreRepository, DirectorRepository y CastRepository:
//  buscar por nombre → si existe devolver ID → si no, crear.
// ═══════════════════════════════════════════════════════════════

class GenreRepository {
    constructor(private conn: any) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

    async findByName(name: string): Promise<number | null> {
        const [rows] = await this.query(
            'SELECT id_genre FROM genres WHERE genre_name = ?',
            [name]
        )
        return rows.length > 0 ? (rows[0].id_genre as number) : null
    }

    async create(name: string): Promise<number> {
        const [result] = await this.query(
            'INSERT INTO genres(genre_name) VALUES(?)',
            [name]
        )
        return result.insertId as number
    }

    async findOrCreate(name: string): Promise<number> {
        const existing = await this.findByName(name)
        if (existing) return existing
        return await this.create(name)
    }

    async deleteByMovieId(movieId: number): Promise<void> {
        await this.query('DELETE FROM movie_genres WHERE movie_id = ?', [movieId])
    }

    async linkToMovie(movieId: number, genreId: number): Promise<void> {
        await this.query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?, ?)', [movieId, genreId])
    }
}

export default GenreRepository
