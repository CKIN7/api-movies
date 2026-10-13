import WatchlistRepository from '../repositories/WatchlistRepository'
import MovieRepository from '../repositories/MovieRepository'
import AppError from '../utils/AppError'
import type { AddToWatchlistDTO, WatchlistQueryDTO, PaginatedWatchlistResponse, WatchlistEntryResponse } from '../types/watchlist'
import { WatchlistEntry } from '../domain/WatchlistEntry'
import { UserPreferencesService } from './userPreferencesService'

function priorityDelta(priority: number | null | undefined): number {
    return (priority ?? 3) >= 4 ? 2 : 1
}

class WatchlistService {
    constructor(
        private watchlistRepo: WatchlistRepository,
        private movieRepo: MovieRepository,
        private userPreferencesService: UserPreferencesService
    ) {}

    async add(userId: string, dto: AddToWatchlistDTO): Promise<WatchlistEntryResponse> {
        const movieRow = await this.movieRepo.findById(dto.movieId)
        if (!movieRow) throw new AppError('Película no encontrada', 404)

        const existing = await this.watchlistRepo.findByUserAndMovie(userId, dto.movieId)
        if (existing) throw new AppError('La película ya está en tu watchlist', 409)

        const entryId = await this.watchlistRepo.create(
            userId,
            dto.movieId,
            dto.notes ?? null,
            dto.priority ?? 3
        )

        const delta = priorityDelta(dto.priority)
        await this.updateGenreAffinityForMovie(userId, dto.movieId, delta)

        const entry = await this.watchlistRepo.findByUserAndMovie(userId, dto.movieId)
        if (!entry) throw new AppError('Error al crear entrada', 500)

        return WatchlistEntry.fromRow(entry, movieRow).toResponse()
    }

    private async updateGenreAffinityForMovie(userId: string, movieId: number, delta: number): Promise<void> {
        try {
            const [rows] = await (this.movieRepo as any).conn.query(
                'SELECT genre_id FROM movie_genres WHERE movie_id = ?',
                [movieId]
            )
            const genres = rows as { genre_id: number }[]
            for (const g of genres) {
                await this.userPreferencesService.updateGenreAffinity(userId, g.genre_id, delta)
            }
        } catch (error) {
            // Non-critical: don't fail the watchlist operation
        }
    }

    async getMyWatchlist(userId: string, query: WatchlistQueryDTO): Promise<PaginatedWatchlistResponse> {
        const offset = (query.page - 1) * query.limit
        const { rows, total } = await this.watchlistRepo.findByUserId(userId, query, offset)

        const movieIds = rows.map(r => r.movie_id)
        const movieRows = await this.movieRepo.findByIds(movieIds)
        const movieMap = new Map(movieRows.map(m => [m.id, m]))

        const data = rows.map(entry => {
            const movieRow = movieMap.get(entry.movie_id)!
            return WatchlistEntry.fromRow(entry, movieRow).toResponse()
        })

        return {
            data,
            meta: {
                total,
                page: query.page,
                limit: query.limit,
                totalPages: Math.ceil(total / query.limit)
            }
        }
    }

    async remove(userId: string, movieId: number): Promise<void> {
        const existing = await this.watchlistRepo.findByUserAndMovie(userId, movieId)

        const deleted = await this.watchlistRepo.delete(userId, movieId)
        if (!deleted) throw new AppError('Entrada no encontrada en tu watchlist', 404)

        if (existing) {
            await this.updateGenreAffinityForMovie(userId, movieId, -priorityDelta(existing.priority))
        }
    }
}

export default WatchlistService