import SearchService from '../../services/searchService'
import type { Index } from 'meilisearch'
import type MovieRepository from '../../repositories/MovieRepository'
import type { SuggestQueryDTO } from '../../schemas/suggestQuerySchema'

describe('SearchService.suggest', () => {
    const original = process.env.MEILISEARCH_ENABLED

    const mockIndex = { search: jest.fn() }
    const mockRepo = { suggest: jest.fn() }
    const query = (over: Partial<SuggestQueryDTO> = {}): SuggestQueryDTO => ({
        q: 'batman',
        field: 'title',
        limit: 8,
        ...over,
    })
    let service: SearchService

    beforeEach(() => {
        jest.clearAllMocks()
        delete process.env.MEILISEARCH_ENABLED
        service = new SearchService(mockIndex as unknown as Index, mockRepo as unknown as MovieRepository)
    })

    afterAll(() => {
        if (original === undefined) delete process.env.MEILISEARCH_ENABLED
        else process.env.MEILISEARCH_ENABLED = original
    })

    it('devuelve valores únicos de title sin duplicados', async () => {
        mockIndex.search.mockResolvedValue({
            hits: [{ title: 'The Batman' }, { title: 'The Batman' }, { title: 'Batman Begins' }],
        })

        const res = await service.suggest(query())

        expect(res).toEqual(['The Batman', 'Batman Begins'])
        expect(mockIndex.search).toHaveBeenCalledWith('batman', expect.objectContaining({
            attributesToSearchOn: ['title'],
            limit: 40,
        }))
    })

    it('mapea director a atributo director', async () => {
        mockIndex.search.mockResolvedValue({ hits: [{ director: 'Christopher Nolan' }, { director: 'Christopher Nolan' }] })

        const res = await service.suggest(query({ q: 'chris', field: 'director' }))

        expect(res).toEqual(['Christopher Nolan'])
        expect(mockIndex.search).toHaveBeenCalledWith('chris', expect.objectContaining({
            attributesToSearchOn: ['director'],
        }))
    })

    it('aplaniza y deduplica genres desde arrays', async () => {
        mockIndex.search.mockResolvedValue({
            hits: [
                { genres: ['Action', 'Sci-Fi'] },
                { genres: ['Action', 'Drama'] },
            ],
        })

        const res = await service.suggest(query({ q: 'act', field: 'genre' }))

        expect(res).toEqual(['Action', 'Sci-Fi', 'Drama'])
        expect(mockIndex.search).toHaveBeenCalledWith('act', expect.objectContaining({
            attributesToSearchOn: ['genres'],
        }))
    })

    it('respeta el limit después de deduplicar', async () => {
        mockIndex.search.mockResolvedValue({
            hits: [{ title: 'A' }, { title: 'B' }, { title: 'C' }, { title: 'D' }],
        })

        const res = await service.suggest(query({ limit: 2 }))

        expect(res).toEqual(['A', 'B'])
    })

    it('descarta valores vacíos', async () => {
        mockIndex.search.mockResolvedValue({ hits: [{ title: '' }, { title: 'Inception' }] })

        const res = await service.suggest(query())

        expect(res).toEqual(['Inception'])
    })

    it('cae a MySQL cuando Meilisearch falla', async () => {
        mockIndex.search.mockRejectedValue(new Error('Meili caído'))
        mockRepo.suggest.mockResolvedValue(['The Batman'])

        const res = await service.suggest(query())

        expect(res).toEqual(['The Batman'])
        expect(mockRepo.suggest).toHaveBeenCalledWith(query())
    })

    it('cae a MySQL directo cuando el flag está deshabilitado', async () => {
        process.env.MEILISEARCH_ENABLED = 'false'
        mockRepo.suggest.mockResolvedValue(['The Batman'])

        const res = await service.suggest(query())

        expect(res).toEqual(['The Batman'])
        expect(mockIndex.search).not.toHaveBeenCalled()
    })

    it('cae a MySQL directo cuando el índice es null', async () => {
        const svc = new SearchService(null, mockRepo as unknown as MovieRepository)
        mockRepo.suggest.mockResolvedValue(['The Batman'])

        const res = await svc.suggest(query())

        expect(res).toEqual(['The Batman'])
        expect(mockIndex.search).not.toHaveBeenCalled()
    })
})
