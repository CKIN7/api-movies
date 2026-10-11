import { MeiliSearch } from 'meilisearch'
import type { Index } from 'meilisearch'
import logger from './logger'

let meiliClient: MeiliSearch | null = null

export function getMeiliClient(): MeiliSearch {
    if (meiliClient) return meiliClient

    const host = process.env.MEILISEARCH_HOST ?? 'http://localhost:7700'
    const apiKey = process.env.MEILISEARCH_API_KEY

    meiliClient = new MeiliSearch({ host, apiKey })

    logger.info(`[Meilisearch] Connected to ${host}`)
    return meiliClient
}

export function getMovieIndex(): Index {
    const client = getMeiliClient()
    return client.index('movies')
}

export function isMeilisearchEnabled(): boolean {
    return process.env.MEILISEARCH_ENABLED !== 'false'
}

export function isMeilisearchHealthy(): Promise<boolean> {
    return getMeiliClient()
        .health()
        .then(() => true)
        .catch(() => false)
}

export async function disconnectMeilisearch(): Promise<void> {
    if (meiliClient) {
        meiliClient = null
    }
}

export const MOVIE_INDEX_CONFIG = {
    searchableAttributes: ['title', 'director', 'genres', 'plot'],
    filterableAttributes: ['year', 'rating', 'genres', 'ageRating'],
    sortableAttributes: ['rating', 'year'],
    rankingRules: ['words', 'typo', 'proximity', 'attribute', 'sort', 'exactness'],
} as const
