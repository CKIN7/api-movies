import type { MovieQueryDTO } from '../schemas/movieQuery'
import type { RandomMovieQueryDTO } from '../schemas/randomMovieQuery'
import type { AuditLogQuery, AuditLogEntry } from '../types/auditLog'
import type { PaginatedResponse, SimilarMovieResponse } from '../types/movie'
import type { CreateMovieDTO, UpdateMovieDTO } from '../types/movie'
import MovieRepository from '../repositories/MovieRepository'
import DirectorRepository from '../repositories/DirectorRepository'
import GenreRepository from '../repositories/GenreRepository'
import AuditLogRepository from '../repositories/AuditLogRepository'
import CastRepository from '../repositories/CastRepository'
import { Movie, type MovieResponse } from '../domain/Movie'
import { SimilarMovie } from '../domain/SimilarMovie'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import { SuggestQueryDTO } from '../schemas/suggestQuerySchema'
import { getCached, setCached, invalidatePattern, CACHE_KEYS } from '../utils/cache'
import { getRedisClient } from '../utils/redisClient'
import type Redis from 'ioredis'

// ═══════════════════════════════════════════════════════════════
//  Patrones: Facade + Dependency Injection
// ═══════════════════════════════════════════════════════════════
//  Facade: MovieService es la fachada unificada ante 5 repos.
//  Por ejemplo, createMovie() orquesta directorRepo.findOrCreate,
//  movieRepo.insert, genreRepo.findOrCreate, genreRepo.linkToMovie,
//  castRepo.findOrCreate, castRepo.linkToMovie y auditRepo.record.
//  El controller solo conoce MovieService, no los repos individuales.
//  DI: Recibe los 5 repos por constructor injection.
// ═══════════════════════════════════════════════════════════════

const CACHE_ENABLED = process.env.CACHE_ENABLED !== 'false'
const CACHE_TTL_MOVIES = Number(process.env.CACHE_TTL_MOVIES ?? 60)
const CACHE_TTL_GENRES = Number(process.env.CACHE_TTL_GENRES ?? 300)

class MovieService {
    constructor(
        private movieRepo: MovieRepository,
        private directorRepo: DirectorRepository,
        private genreRepo: GenreRepository,
        private auditRepo: AuditLogRepository,
        private castRepo: CastRepository,
        private cache: Redis = getRedisClient(),
    ) {}

    async getMovies(params: MovieQueryDTO): Promise<PaginatedResponse<MovieResponse[]>> {
        try {
            if (params.sort && !params.order) {
                params.order = 'asc'
            }

            if (this.isCacheEnabled()) {
                const key = CACHE_KEYS.movieList({ ...params, page: params.page, limit: params.limit })
                const cached = await getCached<PaginatedResponse<MovieResponse[]>>(this.cache, key)
                if (cached) return cached
            }

            const offset = (params.page - 1) * params.limit

            const result = await this.movieRepo.findMany(params, offset)

            const totalPages = Math.ceil(result.total / params.limit)
            const movies = result.rows.map(Movie.fromRow).map(m => m.toResponse())

            const response: PaginatedResponse<MovieResponse[]> = {
                data: movies,
                meta: { total: result.total, page: params.page, limit: params.limit, totalPages }
            }

            if (this.isCacheEnabled()) {
                const key = CACHE_KEYS.movieList({ ...params, page: params.page, limit: params.limit })
                await setCached(this.cache, key, response, CACHE_TTL_MOVIES)
            }

            return response
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getMovies: ${(error as Error).message}`)
            throw new AppError('Error al obtener películas', 500)
        }
    }

    private isCacheEnabled(): boolean {
        return CACHE_ENABLED && this.cache.status === 'ready'
    }

    private async invalidateMovieCaches(id: number): Promise<void> {
        if (!this.isCacheEnabled()) return
        try {
            await this.cache.del(CACHE_KEYS.movie(id))
            await invalidatePattern(this.cache, `movie:${id}:similar:*`)
            await invalidatePattern(this.cache, 'movies:list:*')
            await this.cache.del(CACHE_KEYS.genres())
        } catch (err) {
            logger.warn(`Error invalidating caches for movie ${id}: ${(err as Error).message}`)
        }
    }

    async getMovieById(id: number): Promise<MovieResponse> {
        if (this.isCacheEnabled()) {
            const cached = await getCached<MovieResponse>(this.cache, CACHE_KEYS.movie(id))
            if (cached) return cached
        }

        const row = await this.movieRepo.findById(id)
        if (!row) throw new AppError('Película no encontrada', 404)

        const movie = Movie.fromRow(row).toResponse()

        if (this.isCacheEnabled()) {
            await setCached(this.cache, CACHE_KEYS.movie(id), movie, CACHE_TTL_MOVIES)
        }

        return movie
    }

    async getSimilarMovies(id: number, page: number, limit: number): Promise<PaginatedResponse<SimilarMovieResponse[]>> {
        try {
            if (this.isCacheEnabled()) {
                const key = CACHE_KEYS.movieSimilar(id, page, limit)
                const cached = await getCached<PaginatedResponse<SimilarMovieResponse[]>>(this.cache, key)
                if (cached) return cached
            }

            const movie = await this.movieRepo.findById(id)
            if (!movie) throw new AppError('Película no encontrada', 404)

            const offset = (page - 1) * limit
            const result = await this.movieRepo.findSimilar(id, limit, offset)

            const data = result.rows.map(SimilarMovie.fromRow).map(m => m.toResponse())

            const totalPages = Math.ceil(result.total / limit)

            const response: PaginatedResponse<SimilarMovieResponse[]> = {
                data,
                meta: { total: result.total, page, limit, totalPages }
            }

            if (this.isCacheEnabled()) {
                const key = CACHE_KEYS.movieSimilar(id, page, limit)
                await setCached(this.cache, key, response, CACHE_TTL_MOVIES)
            }

            return response
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getSimilarMovies: ${(error as Error).message}`)
            throw new AppError('Error al obtener películas similares', 500)
        }
    }

    async findRandom(params: RandomMovieQueryDTO){
        try {
            const id = await this.movieRepo.findRandomIds({
                genre: params.genre,
                minYear: params.minYear,
                maxYear: params.maxYear,
                minRating: params.minRating})      

            if(id.length === 0) throw new AppError('No se encontraron películas con esos filtros', 404);
            
            const randomMovie = await this.movieRepo.findById(id[0])

            if(!randomMovie) throw new AppError('La película seleccionada ya no está disponible', 404)
            
            return Movie.fromRow(randomMovie).toResponse()
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en findRandom: ${(error as Error).message}`)
            throw new AppError('Error al obtener película aleatoria', 500)
        }
    }

    async findRandomBatch(params: RandomMovieQueryDTO){
        try {
            const ids = await this.movieRepo.findRandomIds(params)
            if(ids.length === 0) throw new AppError('No se encontraron películas con esos filtros', 404);

            const rows = await this.movieRepo.findByIds(ids)

            return { data: rows.map(Movie.fromRow).map(m => m.toResponse()) }

            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en findRandom: ${(error as Error).message}`)
            throw new AppError('Error al obtener películas aleatorias', 500)
        }
    }

    async getAllGenres(): Promise<string[]> {
        if (this.isCacheEnabled()) {
            const cached = await getCached<string[]>(this.cache, CACHE_KEYS.genres())
            if (cached) return cached
        }

        const genres = await this.genreRepo.findAll()

        if (this.isCacheEnabled()) {
            await setCached(this.cache, CACHE_KEYS.genres(), genres, CACHE_TTL_GENRES)
        }

        return genres
    }

    async suggest(dto: SuggestQueryDTO){
        try {
            
            const suggestMovie = await this.movieRepo.suggest(dto);
            return suggestMovie;

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en suggest: ${(error as Error).message}`)
            throw new AppError('Error al sugerir películas', 500)
        }
    }

    async createMovie(dto: CreateMovieDTO): Promise<MovieResponse> {
        try {
            return await this.movieRepo.transaction(async () => {
                const directorId = await this.directorRepo.findOrCreate(dto.director)

                const movieId = await this.movieRepo.insert({
                    title: dto.title,
                    year: dto.year,
                    rating: dto.rating,
                    duration: dto.duration,
                    plot: dto.plot,
                    poster: dto.poster,
                    directorId,
                    ageRating: dto.ageRating,
                })

                const uniqueGenreIds = [...new Set(
                    await Promise.all(dto.genre.map(g => this.genreRepo.findOrCreate(g)))
                )]
                for (const genreId of uniqueGenreIds) {
                    await this.genreRepo.linkToMovie(movieId, genreId)
                }

                if (dto.cast && dto.cast.length > 0) {
                    for (const member of dto.cast) {
                        const actorId = await this.castRepo.findOrCreate(member.actor)
                        await this.castRepo.linkToMovie(movieId, actorId, member.character)
                    }
                }


                const row = await this.movieRepo.findById(movieId)

                const movieResponse = Movie.fromRow(row!).toResponse()

                await this.auditRepo.record({movieId: movieId, action: 'CREATE', oldSnapshot:null, newSnapshot: movieResponse})

                if (this.isCacheEnabled()) {
                    try {
                        await invalidatePattern(this.cache, 'movies:list:*')
                        await this.cache.del(CACHE_KEYS.genres())
                    } catch (err) {
                        logger.warn(`Error invalidating list caches after create: ${(err as Error).message}`)
                    }
                }

                return movieResponse
            })
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en createMovie: ${(error as Error).message}`)
            throw new AppError('Error al crear la película', 500)
        }
    }

    async updateMovie(id: number, dto: UpdateMovieDTO): Promise<MovieResponse> {
        try {
            const existing = await this.movieRepo.findById(id)
            if (!existing) throw new AppError('Película no encontrada', 404)

            const oldSnapshot = Movie.fromRow(existing!).toResponse()

            return await this.movieRepo.transaction(async () => {
                if (dto.director) {
                    const directorId = await this.directorRepo.findOrCreate(dto.director)
                    await this.movieRepo.update(id, { directorId })
                }

                const fieldsToUpdate: Record<string, unknown> = {}
                for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster', 'ageRating'] as const) {
                    if ((dto as Record<string, unknown>)[key] !== undefined) {
                        fieldsToUpdate[key] = (dto as Record<string, unknown>)[key]
                    }
                }
                if (Object.keys(fieldsToUpdate).length > 0) {
                    await this.movieRepo.update(id, fieldsToUpdate as any)
                }

                // if (dto.rating !== undefined && dto.rating !== existing.rating) {
                //     await this.auditRepo.record(id, 'rating', String(existing.rating), String(dto.rating))
                // }

                if (dto.genre) {
                    const uniqueGenreIds = [...new Set(
                        await Promise.all(dto.genre.map(g => this.genreRepo.findOrCreate(g)))
                    )]
                    await this.genreRepo.deleteByMovieId(id)
                    for (const genreId of uniqueGenreIds) {
                        await this.genreRepo.linkToMovie(id, genreId)
                    }
                }

                if (dto.cast) {
                    await this.castRepo.deleteByMovieId(id)
                    for (const member of dto.cast) {
                        const actorId = await this.castRepo.findOrCreate(member.actor)
                        await this.castRepo.linkToMovie(id, actorId, member.character)
                    }
                }

                const row = await this.movieRepo.findById(id)
                
                const newSnapshot = Movie.fromRow(row!).toResponse()
                
                if(JSON.stringify(oldSnapshot) !== JSON.stringify(newSnapshot)){
                    await this.auditRepo.record({movieId: id, action: 'UPDATE', oldSnapshot: oldSnapshot, newSnapshot: newSnapshot})
                }

                await this.invalidateMovieCaches(id)

                return newSnapshot
            })
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en updateMovie: ${(error as Error).message}`)
            throw new AppError('Error al actualizar la película', 500)
        }
    }

    async deleteMovie(id: number): Promise<void> {
        try {
            const existing = await this.movieRepo.findById(id)
            if (!existing) throw new AppError('Película no encontrada', 404)
            
            const oldSnapshot = Movie.fromRow(existing).toResponse()
            
                await this.movieRepo.transaction(async () => {
                    await this.auditRepo.record({movieId: id, action: 'DELETE', oldSnapshot: oldSnapshot, newSnapshot: null})

                    await this.genreRepo.deleteByMovieId(id)
                    await this.castRepo.deleteByMovieId(id)
                    await this.movieRepo.delete(id)
                })

                await this.invalidateMovieCaches(id)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en deleteMovie: ${(error as Error).message}`)
            throw new AppError('Error al eliminar la película', 500)
        }
    }

    async getAuditLog(query: AuditLogQuery): Promise<PaginatedResponse<AuditLogEntry[]>> {
        try {
            const movie = await this.movieRepo.findById(query.id)
            if (!movie) throw new AppError('Película no encontrada', 404)

            const offset = (query.page - 1) * query.limit
            const rows = await this.auditRepo.findByMovieId({
                movieId: query.id,
                limit: query.limit,
                offset,
            })
            const total = await this.auditRepo.countByMovieId(query.id)
            const totalPages = Math.ceil(total / query.limit)

            const data: AuditLogEntry[] = rows.map(row => ({
                ...row,
                changes: computeChanges(row.oldSnapshot, row.newSnapshot),
            }))

            return {
                data,
                meta: { total, page: query.page, limit: query.limit, totalPages }
            }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getAuditLog: ${(error as Error).message}`)
            throw new AppError('Error al obtener el log de auditoría', 500)
        }
    }
}

// ═══════════════════════════════════════════════════════════════
//  Patrón: Snapshot / Diff
// ═══════════════════════════════════════════════════════════════
//  Compara dos snapshots (antes y después de una mutación) para
//  determinar qué campos cambiaron. El resultado alimenta el log
//  de auditoría con la lista de campos modificados.
// ═══════════════════════════════════════════════════════════════
function computeChanges(oldSnapshot: object | null, newSnapshot: object | null): string[] {
    if (!oldSnapshot || !newSnapshot) return []

    const changes: string[] = []
    const allKeys = new Set([...Object.keys(oldSnapshot), ...Object.keys(newSnapshot)])

    for (const key of allKeys) {
        if (JSON.stringify((oldSnapshot as Record<string, unknown>)[key]) !== JSON.stringify((newSnapshot as Record<string, unknown>)[key])) {
            changes.push(key)
        }
    }

    return changes
}

export default MovieService
