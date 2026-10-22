import SearchService from '../../services/searchService'
import type { Index } from 'meilisearch'

function createMockIndex() {
    return {
        search: jest.fn().mockName('search'),
        addDocuments: jest.fn().mockName('addDocuments'),
        updateDocuments: jest.fn().mockName('updateDocuments'),
        deleteDocument: jest.fn().mockName('deleteDocument'),
    } as unknown as Index
}

function createMockMovieRepo() {
    return {
        findMany: jest.fn().mockName('findMany'),
    }
}

const mockMovieRow = {
    id: 1,
    title: 'Inception',
    year: 2010,
    director: 'Christopher Nolan',
    rating: 8.8,
    duration: 148,
    plot: 'A thief who steals corporate secrets...',
    poster: 'https://example.com/inception.jpg',
    age_rating: 'PG-13',
    genres: 'Action, Sci-Fi',
    cast: '',
    average_rating: 8.5,
    reviews_count: 100,
}

const mockMovieResponse = {
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
}

describe('SearchService', () => {
    const originalMeilisearchEnabled = process.env.MEILISEARCH_ENABLED
    let mockIndex: Index
    let mockMovieRepo: ReturnType<typeof createMockMovieRepo>
    let service: SearchService

    beforeEach(() => {
        process.env.MEILISEARCH_ENABLED = 'true'
        mockIndex = createMockIndex()
        mockMovieRepo = createMockMovieRepo()
        mockMovieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        service = new SearchService(mockIndex, mockMovieRepo as any)
    })

    afterAll(() => {
        if (originalMeilisearchEnabled === undefined) delete process.env.MEILISEARCH_ENABLED
        else process.env.MEILISEARCH_ENABLED = originalMeilisearchEnabled
    })

    describe('search', () => {
        it('returns results from Meilisearch when available', async () => {
            const mockMeiliResult = {
                hits: [mockMovieResponse],
                estimatedTotalHits: 1,
                query: 'inception',
            }
            ;(mockIndex.search as jest.Mock).mockResolvedValue(mockMeiliResult)

            const result = await service.search({ q: 'inception', page: 1, limit: 10, exact: false })

            expect(result.data).toEqual([mockMovieResponse])
            expect(result.meta.total).toBe(1)
            expect(result.meta.source).toBe('meilisearch')
            expect(result.meta.query).toBe('inception')
            expect(mockIndex.search).toHaveBeenCalledWith('inception', expect.objectContaining({
                page: 1,
                limit: 10,
            }))
        })

        it('falls back to MySQL when Meilisearch fails', async () => {
            ;(mockIndex.search as jest.Mock).mockRejectedValue(new Error('Meilisearch unavailable'))
            mockMovieRepo.findMany.mockResolvedValue({
                rows: [mockMovieRow],
                total: 1,
            })

            const result = await service.search({ q: 'inception', page: 1, limit: 10, exact: false })

            expect(result.data).toEqual([mockMovieResponse])
            expect(result.meta.total).toBe(1)
            expect(result.meta.source).toBe('mysql')
            expect(mockMovieRepo.findMany).toHaveBeenCalled()
        })

        it('applies filters correctly', async () => {
            const mockMeiliResult = {
                hits: [mockMovieResponse],
                estimatedTotalHits: 1,
                query: 'action',
            }
            ;(mockIndex.search as jest.Mock).mockResolvedValue(mockMeiliResult)

            await service.search({
                q: 'action',
                page: 1,
                limit: 10,
                genre: 'sci-fi',
                minYear: 2010,
                maxYear: 2020,
                minRating: 7,
                maxRating: 10,
                exact: false,
            })

            expect(mockIndex.search).toHaveBeenCalledWith('action', expect.objectContaining({
                filter: [
                    'genres = "sci-fi"',
                    'year >= 2010',
                    'year <= 2020',
                    'rating >= 7',
                    'rating <= 10',
                ],
            }))
        })

        it('exact + field envía matchingStrategy all y attributesToSearchOn a Meilisearch', async () => {
            ;(mockIndex.search as jest.Mock).mockResolvedValue({
                hits: [mockMovieResponse],
                estimatedTotalHits: 1,
            })

            const result = await service.search({ q: 'batman', page: 1, limit: 10, exact: true, field: 'title' })

            expect(mockIndex.search).toHaveBeenCalledWith('batman', expect.objectContaining({
                matchingStrategy: 'all',
                attributesToSearchOn: ['title'],
                limit: 10,
            }))
            expect(result.data).toEqual([mockMovieResponse])
            expect(result.meta.total).toBe(1)
        })

        it('exact con genre usa el atributo genres en attributesToSearchOn', async () => {
            ;(mockIndex.search as jest.Mock).mockResolvedValue({
                hits: [mockMovieResponse],
                estimatedTotalHits: 1,
            })

            await service.search({ q: 'act', page: 1, limit: 10, exact: true, field: 'genres' })

            expect(mockIndex.search).toHaveBeenCalledWith('act', expect.objectContaining({
                matchingStrategy: 'all',
                attributesToSearchOn: ['genres'],
            }))
        })

        it('sin exact no se envía matchingStrategy aunque field esté presente', async () => {
            ;(mockIndex.search as jest.Mock).mockResolvedValue({
                hits: [mockMovieResponse],
                estimatedTotalHits: 1,
            })

            await service.search({ q: 'batman', page: 1, limit: 10, exact: false, field: 'title' })

            expect(mockIndex.search).toHaveBeenCalledWith('batman', expect.not.objectContaining({
                matchingStrategy: expect.anything(),
            }))
        })

        it('returns empty results when no matches found', async () => {
            const mockMeiliResult = {
                hits: [],
                estimatedTotalHits: 0,
                query: 'zzzz',
            }
            ;(mockIndex.search as jest.Mock).mockResolvedValue(mockMeiliResult)

            const result = await service.search({ q: 'zzzz', page: 1, limit: 10, exact: false })

            expect(result.data).toEqual([])
            expect(result.meta.total).toBe(0)
        })
    })

    describe('indexMovie', () => {
        it('calls addDocuments on the index', async () => {
            await service.indexMovie(mockMovieResponse)

            expect(mockIndex.addDocuments).toHaveBeenCalledWith([mockMovieResponse])
        })

        it('does not throw when indexing fails', async () => {
            ;(mockIndex.addDocuments as jest.Mock).mockRejectedValue(new Error('Index failed'))

            await expect(service.indexMovie(mockMovieResponse)).resolves.not.toThrow()
        })
    })

    describe('updateMovie', () => {
        it('calls updateDocuments on the index', async () => {
            await service.updateMovie(mockMovieResponse)

            expect(mockIndex.updateDocuments).toHaveBeenCalledWith([mockMovieResponse])
        })

        it('does not throw when update fails', async () => {
            ;(mockIndex.updateDocuments as jest.Mock).mockRejectedValue(new Error('Update failed'))

            await expect(service.updateMovie(mockMovieResponse)).resolves.not.toThrow()
        })
    })

    describe('removeMovie', () => {
        it('calls deleteDocument on the index', async () => {
            await service.removeMovie(1)

            expect(mockIndex.deleteDocument).toHaveBeenCalledWith(1)
        })

        it('does not throw when delete fails', async () => {
            ;(mockIndex.deleteDocument as jest.Mock).mockRejectedValue(new Error('Delete failed'))

            await expect(service.removeMovie(1)).resolves.not.toThrow()
        })
    })
})
