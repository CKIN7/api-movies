import request from 'supertest'
import { createApp } from '../../api'
import SearchService from '../../services/searchService'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import { disconnectRedis } from '../../utils/redisClient'
import type { Connection } from 'mysql2/promise'

let db: Connection

beforeAll(async () => { db = await setupTestDb() }, 30000)
afterAll(async () => {
    await teardownTestDb(db)
    await disconnectRedis().catch(() => {})
}, 30000)
beforeEach(async () => { await clearTestData(db); await seedTestData(db) }, 30000)

const mockSearchResult = {
    data: [
        {
            id: 1,
            title: 'Inception',
            year: 2010,
            director: 'Christopher Nolan',
            rating: 8.8,
            duration: 148,
            plot: 'A thief who steals corporate secrets...',
            poster: 'https://example.com/inception.jpg',
            ageRating: 'PG-13',
            genres: ['Action', 'Sci-Fi'],
            cast: [],
            averageRating: 8.5,
            reviewsCount: 100,
        },
    ],
    meta: {
        total: 1,
        page: 1,
        limit: 10,
        totalPages: 1,
        query: 'inception',
        processingTimeMs: 5,
        source: 'meilisearch' as const,
    },
}

describe('Search API Integration', () => {
    let mockSearchService: { search: jest.Mock; suggest: jest.Mock }

    beforeEach(() => {
        mockSearchService = {
            search: jest.fn().mockResolvedValue(mockSearchResult),
            suggest: jest.fn().mockResolvedValue(['Inception', 'Inception: The Cobol Job']),
        }
    })

    describe('GET /movies/search', () => {
        it('returns search results with valid query', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'inception' })

            expect(res.status).toBe(200)
            expect(res.body.data).toHaveLength(1)
            expect(res.body.data[0].title).toBe('Inception')
            expect(res.body.meta.query).toBe('inception')
            expect(res.body.meta.source).toBe('meilisearch')
        })

        it('returns 400 when q is missing', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({})

            expect(res.status).toBe(400)
        })

        it('returns 400 when q is too short', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'ab' })

            expect(res.status).toBe(400)
        })

        it('returns 400 when q exceeds max length', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'a'.repeat(201) })

            expect(res.status).toBe(400)
        })

        it('passes pagination params to service', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            await request(app)
                .get('/movies/search')
                .query({ q: 'action', page: 2, limit: 5 })

            expect(mockSearchService.search).toHaveBeenCalledWith(
                expect.objectContaining({ q: 'action', page: 2, limit: 5 })
            )
        })

        it('passes filters to service', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            await request(app)
                .get('/movies/search')
                .query({ q: 'action', genre: 'sci-fi', minYear: 2010, maxYear: 2020 })

            expect(mockSearchService.search).toHaveBeenCalledWith(
                expect.objectContaining({
                    q: 'action',
                    genre: 'sci-fi',
                    minYear: 2010,
                    maxYear: 2020,
                })
            )
        })

        it('returns empty results when no matches', async () => {
            mockSearchService.search.mockResolvedValue({
                data: [],
                meta: {
                    total: 0,
                    page: 1,
                    limit: 10,
                    totalPages: 0,
                    query: 'zzzz',
                    processingTimeMs: 2,
                    source: 'meilisearch' as const,
                },
            })

            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'zzzz' })

            expect(res.status).toBe(200)
            expect(res.body.data).toEqual([])
            expect(res.body.meta.total).toBe(0)
        })

        it('returns 400 when minYear > maxYear', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'action', minYear: 2020, maxYear: 2010 })

            expect(res.status).toBe(400)
        })

        it('returns 400 when minRating > maxRating', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search')
                .query({ q: 'action', minRating: 9, maxRating: 5 })

            expect(res.status).toBe(400)
        })
    })

    describe('GET /movies/search/suggest', () => {
        it('returns suggestions with valid query', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search/suggest')
                .query({ q: 'ince', field: 'title' })

            expect(res.status).toBe(200)
            expect(res.body).toEqual(['Inception', 'Inception: The Cobol Job'])
            expect(mockSearchService.suggest).toHaveBeenCalledWith({ q: 'ince', field: 'title', limit: 8 })
        })

        it('passes field and limit to the service', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            await request(app)
                .get('/movies/search/suggest')
                .query({ q: 'chris', field: 'director', limit: 5 })

            expect(mockSearchService.suggest).toHaveBeenCalledWith({ q: 'chris', field: 'director', limit: 5 })
        })

        it('returns 400 when q is missing', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search/suggest')
                .query({ field: 'title' })

            expect(res.status).toBe(400)
        })

        it('returns 400 when q is shorter than 3 chars', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search/suggest')
                .query({ q: 'ab', field: 'title' })

            expect(res.status).toBe(400)
        })

        it('returns 400 when field is invalid', async () => {
            const app = createApp(undefined, mockSearchService as unknown as SearchService)

            const res = await request(app)
                .get('/movies/search/suggest')
                .query({ q: 'ince', field: 'actor' })

            expect(res.status).toBe(400)
        })
    })
})
