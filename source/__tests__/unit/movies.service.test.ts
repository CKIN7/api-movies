import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

function createMockModel() {
    return {
        getMovies: jest.fn().mockName('getMovies'),
        getMovieById: jest.fn().mockName('getMovieById'),
        createMovie: jest.fn().mockName('createMovie'),
        updateMovie: jest.fn().mockName('updateMovie'),
        deleteMovie: jest.fn().mockName('deleteMovie')
    }
}

describe('MovieService - getMovies', () => {
    test('debe devolver películas cuando el modelo responde exitosamente', async () => {
        const mockModel = createMockModel()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ]
        mockModel.getMovies.mockResolvedValue({ rows: fakeMovies, total: 1 })
        const service = new MovieService({} as any, mockModel as any)

        const result = await service.getMovies({ genre: 'action' })

        expect(result).toEqual({
            data: fakeMovies,
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })
        expect(mockModel.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ genre: 'action', limit: 10, offset: 0 })
        )
    })

    test('debe llamar al modelo con los parámetros correctos', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService({} as any, mockModel as any)

        await service.getMovies({ title: 'incept', year: '2010' })

        expect(mockModel.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'incept', year: '2010' })
        )
    })

    test('debe llamar al modelo sin parámetros cuando no se pasan filtros', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService({} as any, mockModel as any)

        await service.getMovies({})

        expect(mockModel.getMovies).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        )
    })

    test('debe lanzar AppError con status 500 si el modelo falla', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockRejectedValue(new Error('DB error'))
        const service = new MovieService({} as any, mockModel as any)

        await expect(service.getMovies({})).rejects.toThrow(AppError)
    })
})
