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

describe('MovieService - createMovie', () => {
    test('debe crear y devolver la película completa con id', async () => {
        const mockModel = createMockModel()
        const fakeCreatedMovie = {
            id: 9,
            title: 'Nueva Película',
            year: 2024,
            director: 'Nuevo Director',
            rating: 7.5,
            duration: 120,
            plot: 'Un argumento de prueba',
            poster: 'https://example.com/poster.jpg',
            genres: 'drama'
        }
        mockModel.createMovie.mockResolvedValue(fakeCreatedMovie)

        const service = new (await import('../../services/movieService')).default(mockModel as any)

        const inputData = {
            title: 'Nueva Película',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'Un argumento de prueba',
            poster: 'https://example.com/poster.jpg',
            director: 'Nuevo Director',
            genre: ['drama'],
            available: true
        }

        const result = await service.createMovie(inputData)

        expect(result).toEqual(fakeCreatedMovie)
        expect(mockModel.createMovie).toHaveBeenCalledWith({ result: { data: inputData } })
    })

    test('debe lanzar AppError con status 500 si el modelo falla', async () => {
        const mockModel = createMockModel()
        mockModel.createMovie.mockRejectedValue(new Error('DB error'))

        const service = new (await import('../../services/movieService')).default(mockModel as any)

        const inputData = {
            title: 'Fallo',
            year: 2024,
            rating: 5,
            duration: 100,
            plot: '...',
            poster: 'https://example.com/p.jpg',
            director: 'Alguien',
            genre: ['drama'],
            available: true
        }

        await expect(service.createMovie(inputData)).rejects.toThrow(AppError)
    })
})
