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

export function setCached<T>(client: Redis, key: string, value: T, ttlSeconds: number): Promise<void> {
    return client.set(key, JSON.stringify(value), 'EX', ttlSeconds).then(() => undefined)
}

export async function invalidatePattern(client: Redis, pattern: string): Promise<void> {
    let cursor = '0'
    do {
        const [nextCursor, keys] = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
            await client.del(...keys)
        }
    } while (cursor !== '0')
}

export function buildListKey(prefix: string, params: Record<string, unknown>): string {
    const sorted = Object.keys(params)
        .sort()
        .reduce((acc, key) => {
            acc[key] = params[key]
            return acc
        }, {} as Record<string, unknown>)
    const hash = crypto.createHash('md5').update(JSON.stringify(sorted)).digest('hex')
    return `${prefix}:${hash}`
}

export const CACHE_KEYS = {
    movie: (id: number) => `movie:${id}`,
    movieSimilar: (id: number, page: number, limit: number) => `movie:${id}:similar:${page}:${limit}`,
    movieList: (params: Record<string, unknown>) => buildListKey('movies:list', params),
    genres: () => 'movies:genres',
} as const
