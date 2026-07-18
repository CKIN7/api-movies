import type { MovieQueryDTO } from '../schemas/movieQuery'
import type { AuditLogQuery, AuditLogEntry } from '../types/auditLog'
import type { PaginatedResponse, MovieRow } from '../types/movie'
import type { CreateMovieDTO, UpdateMovieDTO } from '../types/movie'
import MovieRepository from '../repositories/MovieRepository'
import DirectorRepository from '../repositories/DirectorRepository'
import GenreRepository from '../repositories/GenreRepository'
import AuditLogRepository from '../repositories/AuditLogRepository'
import CastRepository from '../repositories/CastRepository'
import { Movie, type MovieResponse } from '../domain/Movie'
import AppError from '../utils/AppError'
import logger from '../utils/logger'

class MovieService {
    constructor(
        private movieRepo: MovieRepository,
        private directorRepo: DirectorRepository,
        private genreRepo: GenreRepository,
        private auditRepo: AuditLogRepository,
        private castRepo: CastRepository,
    ) {}

    async getMovies(params: MovieQueryDTO): Promise<PaginatedResponse<MovieResponse[]>> {
        try {
            if (params.sort && !params.order) {
                params.order = 'asc'
            }

            const offset = (params.page - 1) * params.limit

            const result = await this.movieRepo.findMany({
                genre: params.genre,
                genreMode: params.genreMode,
                minYear: params.minYear,
                minRating: params.minRating,
                maxRating: params.maxRating,
                minDuration: params.minDuration,
                maxDuration: params.maxDuration,
                maxYear: params.maxYear,
                title: params.title,
                director: params.director,
                sort: params.sort,
                order: params.order,
                limit: params.limit,
                offset,
                q: params.q
            })

            const totalPages = Math.ceil(result.total / params.limit)
            const movies = result.rows.map(Movie.fromRow).map(m => m.toResponse())

            return {
                data: movies,
                meta: { total: result.total, page: params.page, limit: params.limit, totalPages }
            }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getMovies: ${(error as Error).message}`)
            throw new AppError('Error al obtener películas', 500)
        }
    }

    async getMovieById(id: number): Promise<MovieResponse> {
        const row = await this.movieRepo.findById(id)
        if (!row) throw new AppError('Película no encontrada', 404)
        return Movie.fromRow(row).toResponse()
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

                await this.auditRepo.record(movieId, 'rating', null, String(dto.rating))

                const row = await this.movieRepo.findById(movieId)
                return Movie.fromRow(row!).toResponse()
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

            return await this.movieRepo.transaction(async () => {
                if (dto.director) {
                    const directorId = await this.directorRepo.findOrCreate(dto.director)
                    await this.movieRepo.update(id, { directorId })
                }

                const fieldsToUpdate: Record<string, unknown> = {}
                for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster'] as const) {
                    if ((dto as Record<string, unknown>)[key] !== undefined) {
                        fieldsToUpdate[key] = (dto as Record<string, unknown>)[key]
                    }
                }
                if (Object.keys(fieldsToUpdate).length > 0) {
                    await this.movieRepo.update(id, fieldsToUpdate as any)
                }

                if (dto.rating !== undefined && dto.rating !== existing.rating) {
                    await this.auditRepo.record(id, 'rating', String(existing.rating), String(dto.rating))
                }

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
                return Movie.fromRow(row!).toResponse()
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

            await this.movieRepo.transaction(async () => {
                await this.genreRepo.deleteByMovieId(id)
                await this.castRepo.deleteByMovieId(id)
                await this.movieRepo.delete(id)
            })
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
            const data = await this.auditRepo.findByMovieId({
                movieId: query.id,
                field: query.field,
                limit: query.limit,
                offset,
            })
            const total = await this.auditRepo.countByMovieId(query.id, query.field)
            const totalPages = Math.ceil(total / query.limit)

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

export default MovieService
