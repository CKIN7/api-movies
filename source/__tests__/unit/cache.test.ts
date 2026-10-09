import RedisMock from 'ioredis-mock'
import type Redis from 'ioredis'
import { getCached, setCached, invalidatePattern, buildListKey, CACHE_KEYS } from '../../utils/cache'

describe('cache helper', () => {
    let client: Redis

    beforeEach(() => {
        client = new RedisMock()
    })

    afterEach(async () => {
        await client.flushall()
        await client.disconnect()
    })

    describe('getCached', () => {
        it('returns null when key does not exist', async () => {
            const result = await getCached(client, 'missing:key')
            expect(result).toBeNull()
        })

        it('returns parsed object when key exists', async () => {
            await client.set('movie:1', JSON.stringify({ id: 1, title: 'Inception' }))
            const result = await getCached<{ id: number; title: string }>(client, 'movie:1')
            expect(result).toEqual({ id: 1, title: 'Inception' })
        })

        it('returns null when stored value is invalid JSON', async () => {
            await client.set('bad:key', 'not-json{{{')
            const result = await getCached(client, 'bad:key')
            expect(result).toBeNull()
        })
    })

    describe('setCached', () => {
        it('stores JSON string with TTL', async () => {
            await setCached(client, 'movie:1', { id: 1 }, 60)
            const raw = await client.get('movie:1')
            expect(JSON.parse(raw!)).toEqual({ id: 1 })
            const ttl = await client.ttl('movie:1')
            expect(ttl).toBeGreaterThan(0)
            expect(ttl).toBeLessThanOrEqual(60)
        })
    })

    describe('invalidatePattern', () => {
        it('deletes all keys matching pattern', async () => {
            await client.set('movies:list:abc', '1')
            await client.set('movies:list:def', '2')
            await client.set('movies:list:ghi', '3')
            await client.set('movie:1', 'keep')

            await invalidatePattern(client, 'movies:list:*')

            expect(await client.get('movies:list:abc')).toBeNull()
            expect(await client.get('movies:list:def')).toBeNull()
            expect(await client.get('movies:list:ghi')).toBeNull()
            expect(await client.get('movie:1')).toBe('keep')
        })

        it('does nothing when no keys match', async () => {
            await client.set('movie:1', 'value')
            await invalidatePattern(client, 'movies:list:*')
            expect(await client.get('movie:1')).toBe('value')
        })
    })

    describe('buildListKey', () => {
        it('generates same hash regardless of key order', () => {
            const key1 = buildListKey('movies:list', { a: 1, b: 2, c: 3 })
            const key2 = buildListKey('movies:list', { c: 3, b: 2, a: 1 })
            expect(key1).toBe(key2)
        })

        it('generates different hash for different values', () => {
            const key1 = buildListKey('movies:list', { genre: 'action' })
            const key2 = buildListKey('movies:list', { genre: 'comedy' })
            expect(key1).not.toBe(key2)
        })
    })

    describe('CACHE_KEYS', () => {
        it('builds correct key patterns', () => {
            expect(CACHE_KEYS.movie(42)).toBe('movie:42')
            expect(CACHE_KEYS.movieSimilar(42, 1, 10)).toBe('movie:42:similar:1:10')
            expect(CACHE_KEYS.genres()).toBe('movies:genres')
            expect(CACHE_KEYS.movieList({ page: 1 })).toMatch(/^movies:list:[a-f0-9]{32}$/)
        })
    })
})
