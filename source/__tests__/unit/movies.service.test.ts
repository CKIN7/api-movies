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
        mockModel.getMovies.mockResolvedValue(fakeMovies)
        const service = new MovieService(mockModel as any)

        const result = await service.getMovies({ genre: 'action' })

        // Escribe aquí tu assert:
        expect(result).toEqual(fakeMovies)
        expect(mockModel.getMovies).toHaveBeenCalledWith({ genre: 'action' })
    })

    test('debe llamar al modelo con los parámetros correctos', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockResolvedValue([])
        const service = new MovieService(mockModel as any)

        await service.getMovies({ title: 'incept', year: '2010' })

        // Escribe aquí tu assert:
        expect(mockModel.getMovies).toHaveBeenCalledWith({ title: 'incept', year: '2010' })
    })

    test('debe llamar al modelo sin parámetros cuando no se pasan filtros', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockResolvedValue([])
        const service = new MovieService(mockModel as any)

        await service.getMovies({})

        // Escribe aquí tu assert:
        expect(mockModel.getMovies).toHaveBeenCalledWith({})
    })

    test('debe lanzar AppError con status 500 si el modelo falla', async () => {
        const mockModel = createMockModel()
        mockModel.getMovies.mockRejectedValue(new Error('DB error'))
        const service = new MovieService(mockModel as any)

        // Escribe aquí tu assert:
        await expect(service.getMovies({})).rejects.toThrow(AppError)
    })
})