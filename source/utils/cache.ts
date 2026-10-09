import crypto from 'crypto'
import type Redis from 'ioredis'

export function getCached<T>(client: Redis, key: string): Promise<T | null> {
    return client.get(key).then((raw) => {
        if (raw === null) return null
        try {
            return JSON.parse(raw) as T
        } catch {
            return null
        }
    })
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
