import SearchService from '../../services/searchService'
import type { Index } from 'meilisearch'
import type MovieRepository from '../../repositories/MovieRepository'
import type { MovieResponse } from '../../domain/Movie'

describe('SearchService con MEILISEARCH_ENABLED=false', () => {
    const original = process.env.MEILISEARCH_ENABLED

    const mockIndex = {
        search: jest.fn(),
        addDocuments: jest.fn(),
        updateDocuments: jest.fn(),
        deleteDocument: jest.fn(),
    }
    const mockRepo = { findMany: jest.fn() }
    const query = { q: 'inception', page: 1, limit: 10, exact: false }
    let service: SearchService

    beforeEach(() => {
        jest.clearAllMocks()
        process.env.MEILISEARCH_ENABLED = 'false'
        service = new SearchService(mockIndex as unknown as Index, mockRepo as unknown as MovieRepository)
        mockRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
    })

    afterAll(() => {
        if (original === undefined) delete process.env.MEILISEARCH_ENABLED
        else process.env.MEILISEARCH_ENABLED = original
    })

    it('search() va directo a MySQL sin tocar Meilisearch', async () => {
        const res = await service.search(query)

        expect(mockIndex.search).not.toHaveBeenCalled()
        expect(mockRepo.findMany).toHaveBeenCalled()
        expect(res.meta.source).toBe('mysql')
        expect(res.meta.total).toBe(0)
    })

    it('indexMovie() es no-op', async () => {
        await service.indexMovie({ id: 1 } as unknown as MovieResponse)

        expect(mockIndex.addDocuments).not.toHaveBeenCalled()
    })

    it('updateMovie() es no-op', async () => {
        await service.updateMovie({ id: 1 } as unknown as MovieResponse)

        expect(mockIndex.updateDocuments).not.toHaveBeenCalled()
    })

    it('removeMovie() es no-op', async () => {
        await service.removeMovie(1)

        expect(mockIndex.deleteDocument).not.toHaveBeenCalled()
    })

    it('con el flag habilitado usa Meilisearch', async () => {
        process.env.MEILISEARCH_ENABLED = 'true'
        mockIndex.search.mockResolvedValue({ hits: [], estimatedTotalHits: 0 })

        const res = await service.search(query)

        expect(mockIndex.search).toHaveBeenCalled()
        expect(res.meta.source).toBe('meilisearch')
    })

    it('sin la variable definida queda habilitado por defecto', async () => {
        delete process.env.MEILISEARCH_ENABLED
        mockIndex.search.mockResolvedValue({ hits: [], estimatedTotalHits: 0 })

        const res = await service.search(query)

        expect(mockIndex.search).toHaveBeenCalled()
        expect(res.meta.source).toBe('meilisearch')
    })
})
