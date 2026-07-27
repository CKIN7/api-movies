import ExportService from '../../services/exportService'
import type { MovieQueryDTO } from '../../schemas/movieQuery'

describe('ExportService', () => {
    function createMockRepo() {
        return {
            findMany: jest.fn().mockName('findMany'),
        }
    }

    test('debe llamar a findMany con limit 999999 y offset 0', async () => {
        const repo = createMockRepo()
        repo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = new ExportService(repo as any)

        const filters: MovieQueryDTO = {
            genreMode: 'and',
            page: 1,
            limit: 10,
        }

        await service.getAll(filters)

        expect(repo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ page: 1, limit: 999999 }),
            0
        )
    })

    test('debe devolver array de MovieResponse', async () => {
        const repo = createMockRepo()
        repo.findMany.mockResolvedValue({
            rows: [
                { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi', age_rating: 'PG-13', cast: '' },
            ],
            total: 1,
        })
        const service = new ExportService(repo as any)

        const result = await service.getAll({ genreMode: 'and', page: 1, limit: 10 })

        expect(Array.isArray(result)).toBe(true)
        expect(result).toHaveLength(1)
        expect(result[0]).toHaveProperty('title', 'Inception')
        expect(result[0]).toHaveProperty('genres')
        expect(result[0]).toHaveProperty('cast')
    })

    test('debe propagar el error si findMany falla', async () => {
        const repo = createMockRepo()
        repo.findMany.mockRejectedValue(new Error('DB error'))
        const service = new ExportService(repo as any)

        await expect(service.getAll({ genreMode: 'and', page: 1, limit: 10 })).rejects.toThrow('Error al obtener películas')
    })
})
