import type { Index, SearchResponse } from 'meilisearch'
import type { SearchQueryDTO } from '../schemas/searchQuery'
import type { SuggestQueryDTO } from '../schemas/suggestQuerySchema'
import type { PaginatedResponse } from '../types/movie'
import type MovieRepository from '../repositories/MovieRepository'
import { Movie, type MovieResponse } from '../domain/Movie'
import { isMeilisearchEnabled } from '../utils/meilisearchClient'
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

const SUGGEST_ATTR: Record<SuggestQueryDTO['field'], string> = {
    title: 'title',
    director: 'director',
    genre: 'genres',
}

class SearchService {
    constructor(
        private movieIndex: Index | null,
        private movieRepo: MovieRepository,
    ) {}

    private canUseMeilisearch(): boolean {
        return isMeilisearchEnabled() && this.movieIndex !== null
    }

    async search(params: SearchQueryDTO): Promise<SearchResult> {
        const startTime = Date.now()

        if (!this.canUseMeilisearch()) {
            logger.info('[Search] Meilisearch disabled, searching in MySQL')
            return this.searchWithMysql(params, startTime)
        }

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

    private async searchWithMeilisearch(params: SearchQueryDTO): Promise<{ hits: MovieResponse[]; estimatedTotalHits: number | undefined }> {
        const filters = this.buildMeilisearchFilters(params)
        const attrMap = {
            title: 'title',
            director: 'director',
            genres: 'genres',
            plot: 'plot',
        }

        const searchOptions: any = {
            filter: filters.length > 0 ? filters : undefined,
            page: params.page,
            limit: params.exact ? 100 : params.limit, // fetch more for exact filtering
            attributesToRetrieve: ['id', 'title', 'year', 'director', 'rating', 'genres', 'plot', 'poster', 'ageRating'],
            showRankingScore: true,
        }

        if (params.field && attrMap[params.field]) {
            searchOptions.attributesToSearchOn = [attrMap[params.field]]
        }

        const result = await this.movieIndex!.search(params.q, searchOptions)

        let hits = result.hits as unknown as MovieResponse[]
        let totalHits = (result as any).estimatedTotalHits ?? hits.length

        if (params.exact && params.field && attrMap[params.field]) {
            const attr = attrMap[params.field]
            const q = params.q.toLowerCase()
            const exactHits = hits.filter(hit => {
                const value = hit[attr as keyof MovieResponse] as string | string[]
                if (attr === 'genres') {
                    return Array.isArray(value) && value.some(g => g.toLowerCase() === q)
                }
                return typeof value === 'string' && value.toLowerCase() === q
            })
            hits = exactHits
            totalHits = exactHits.length
        }

        return {
            hits: hits.slice(0, params.limit),
            estimatedTotalHits: totalHits,
        }
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

    async suggest(query: SuggestQueryDTO): Promise<string[]> {
        if (!this.canUseMeilisearch()) {
            return this.movieRepo.suggest(query)
        }

        try {
            const attr = SUGGEST_ATTR[query.field]
            const result = await this.movieIndex!.search(query.q, {
                attributesToSearchOn: [attr],
                attributesToRetrieve: [attr],
                limit: query.limit * 5,
            })

            const hits = result.hits as Array<Record<string, string | string[]>>
            const values = query.field === 'genre'
                ? hits.flatMap(h => (Array.isArray(h[attr]) ? h[attr] : [String(h[attr])]))
                : hits.map(h => String(h[attr]))

            return [...new Set(values.filter(v => v.length > 0))].slice(0, query.limit)
        } catch (error) {
            logger.warn(`[Search] Suggest via Meilisearch failed, falling back to MySQL: ${(error as Error).message}`)
            return this.movieRepo.suggest(query)
        }
    }

    async indexMovie(movie: MovieResponse): Promise<void> {
        if (!this.canUseMeilisearch()) return
        try {
            await this.movieIndex!.addDocuments([movie])
        } catch (error) {
            logger.warn(`[Search] Failed to index movie ${movie.id}: ${(error as Error).message}`)
        }
    }

    async updateMovie(movie: MovieResponse): Promise<void> {
        if (!this.canUseMeilisearch()) return
        try {
            await this.movieIndex!.updateDocuments([movie])
        } catch (error) {
            logger.warn(`[Search] Failed to update movie ${movie.id}: ${(error as Error).message}`)
        }
    }

    async removeMovie(movieId: number): Promise<void> {
        if (!this.canUseMeilisearch()) return
        try {
            await this.movieIndex!.deleteDocument(movieId)
        } catch (error) {
            logger.warn(`[Search] Failed to remove movie ${movieId}: ${(error as Error).message}`)
        }
    }
}

export default SearchService
