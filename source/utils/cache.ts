import crypto from 'crypto'
import type Redis from 'ioredis'
import logger from './logger'

export async function getCached<T>(client: Redis, key: string): Promise<T | null> {
    const raw = await client.get(key)

    if (raw === null) {
        return null
    }

    try {
        const parsed = JSON.parse(raw) as T
        return parsed
    } catch (error) {
        logger.warn(`Failed to parse cached value for key "${key}": ${(error as Error).message}`)
        return null
    }
}

export async function setCached<T>(client: Redis, key: string, value: T, ttlSeconds: number): Promise<void> {
    const serialized = JSON.stringify(value)

    await client.set(key, serialized, 'EX', ttlSeconds)
}

export async function invalidatePattern(client: Redis, pattern: string): Promise<void> {
    const SCAN_BATCH_SIZE = 100
    let cursor = '0'

    do {
        const [nextCursor, matchedKeys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', SCAN_BATCH_SIZE)
        cursor = nextCursor

        if (matchedKeys.length > 0) {
            await client.del(...matchedKeys)
        }
    } while (cursor !== '0')
}

export function buildListKey(prefix: string, params: Record<string, unknown>): string {
    const sortedKeys = Object.keys(params).sort()

    const sortedParams: Record<string, unknown> = {}
    for (const key of sortedKeys) {
        sortedParams[key] = params[key]
    }

    const serialized = JSON.stringify(sortedParams)
    const hash = crypto.createHash('md5').update(serialized).digest('hex')
    const cacheKey = `${prefix}:${hash}`

    return cacheKey
}

export const CACHE_KEYS = {
    movie: (id: number) => `movie:${id}`,
    movieSimilar: (id: number, page: number, limit: number) => `movie:${id}:similar:${page}:${limit}`,
    movieList: (params: Record<string, unknown>) => buildListKey('movies:list', params),
    genres: () => 'movies:genres',
} as const
