import type { Index, SearchResponse } from 'meilisearch'
import type { SearchQueryDTO } from '../schemas/searchQuery'
import type { PaginatedResponse, MovieResponse } from '../types/movie'
import type MovieRepository from '../repositories/MovieRepository'
import { Movie } from '../domain/Movie'
import logger from '../utils/logger'

export interface SearchResult {
    data: MovieResponse[]
    meta: {
        total: number
        page: number
        limit: number
        totalPages: number
        query: string
        processingTimeMs: number
        source: 'meilisearch' | 'mysql'
    }
}

class SearchService {
    constructor(
        private movieIndex: Index,
        private movieRepo: MovieRepository,
    ) {}

    async search(params: SearchQueryDTO): Promise<SearchResult> {
        const startTime = Date.now()

        try {
            const result = await this.searchWithMeilisearch(params)
            const processingTimeMs = Date.now() - startTime

            return {
                data: result.hits,
                meta: {
                    total: result.estimatedTotalHits ?? result.hits.length,
                    page: params.page,
                    limit: params.limit,
                    totalPages: Math.ceil((result.estimatedTotalHits ?? 0) / params.limit),
                    query: params.q,
                    processingTimeMs,
                    source: 'meilisearch',
                },
            }
        } catch (error) {
            logger.warn(`[Search] Meilisearch failed, falling back to MySQL: ${(error as Error).message}`)
            return this.searchWithMysql(params, startTime)
        }
    }

    private async searchWithMeilisearch(params: SearchQueryDTO): Promise<SearchResponse> {
        const filters = this.buildMeilisearchFilters(params)

        return await this.movieIndex.search(params.q, {
            filter: filters.length > 0 ? filters : undefined,
            page: params.page,
            limit: params.limit,
            attributesToRetrieve: ['id', 'title', 'year', 'director', 'rating', 'genres', 'plot', 'poster', 'ageRating'],
            showRankingScore: true,
        })
    }

    private buildMeilisearchFilters(params: SearchQueryDTO): string[] {
        const filters: string[] = []

        if (params.genre) {
            filters.push(`genres = "${params.genre}"`)
        }
        if (params.minYear !== undefined) {
            filters.push(`year >= ${params.minYear}`)
        }
        if (params.maxYear !== undefined) {
            filters.push(`year <= ${params.maxYear}`)
        }
        if (params.minRating !== undefined) {
            filters.push(`rating >= ${params.minRating}`)
        }
        if (params.maxRating !== undefined) {
            filters.push(`rating <= ${params.maxRating}`)
        }

        return filters
    }

    private async searchWithMysql(params: SearchQueryDTO, startTime: number): Promise<SearchResult> {
        const offset = (params.page - 1) * params.limit

        const result = await this.movieRepo.findMany(
            {
                title: params.q,
                genre: params.genre ? [params.genre] : undefined,
                minYear: params.minYear,
                maxYear: params.maxYear,
                minRating: params.minRating,
                maxRating: params.maxRating,
                page: params.page,
                limit: params.limit,
                genreMode: 'and',
            },
            offset
        )

        const movies = result.rows.map(Movie.fromRow).map(m => m.toResponse())
        const processingTimeMs = Date.now() - startTime

        return {
            data: movies,
            meta: {
                total: result.total,
                page: params.page,
                limit: params.limit,
                totalPages: Math.ceil(result.total / params.limit),
                query: params.q,
                processingTimeMs,
                source: 'mysql',
            },
        }
    }

    async indexMovie(movie: MovieResponse): Promise<void> {
        try {
            await this.movieIndex.addDocuments([movie])
        } catch (error) {
            logger.warn(`[Search] Failed to index movie ${movie.id}: ${(error as Error).message}`)
        }
    }

    async updateMovie(movie: MovieResponse): Promise<void> {
        try {
            await this.movieIndex.updateDocuments([movie])
        } catch (error) {
            logger.warn(`[Search] Failed to update movie ${movie.id}: ${(error as Error).message}`)
        }
    }

    async removeMovie(movieId: number): Promise<void> {
        try {
            await this.movieIndex.deleteDocument(movieId)
        } catch (error) {
            logger.warn(`[Search] Failed to remove movie ${movieId}: ${(error as Error).message}`)
        }
    }
}

export default SearchService
