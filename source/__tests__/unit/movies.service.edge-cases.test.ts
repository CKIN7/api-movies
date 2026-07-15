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

const sampleInput = {
    title: 'Service Edge',
    year: 2024,
    rating: 5,
    duration: 100,
    plot: 'Service edge plot',
    poster: 'https://example.com/service.jpg',
    director: 'Service Director',
    genre: ['drama'],
    available: true
}

/* ────────────────────────────
   PROPAGACIÓN DE ERRORES
   ──────────────────────────── */
describe('MovieService — error propagation', () => {

    test('AppError del modelo se propaga sin cambiar statusCode', async () => {
        // Arrange
        const mockModel = createMockModel()
        const originalError = new AppError('Conflicto: título duplicado', 409)
        mockModel.createMovie.mockRejectedValue(originalError)
        const service = new (await import('../../services/movieService')).default({} as any, mockModel as any)

        // Act / Assert
        await expect(service.createMovie(sampleInput)).rejects.toThrow(AppError)
        await expect(service.createMovie(sampleInput)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Conflicto: título duplicado'
        })
    })

    test('Error genérico (no AppError) se envuelve en AppError 500', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockRejectedValue(new Error('DB connection lost'))
        const service = new (await import('../../services/movieService')).default({} as any, mockModel as any)

        // Act / Assert
        await expect(service.createMovie(sampleInput)).rejects.toThrow(AppError)
        await expect(service.createMovie(sampleInput)).rejects.toMatchObject({ statusCode: 500 })
    })

    test('Error con campos especiales en input se pasan correctamente al modelo', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockResolvedValue({ id: 10, ...sampleInput, genres: 'drama' })
        const service = new (await import('../../services/movieService')).default({} as any, mockModel as any)
        const input = {
            ...sampleInput,
            title: 'Movie <script>alert("xss")</script>',
            director: "Robert'; DROP TABLE movies; --",
            genre: ['acción', 'comedia']
        }

        // Act
        const result = await service.createMovie(input)

        // Assert
        expect(result).toMatchObject({ id: 10 })
        expect(mockModel.createMovie).toHaveBeenCalledWith({ result: { data: input } })
    })

    test('Director con espacios alrededor no se transforma (solo genre hace trim)', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockResolvedValue({ id: 11, ...sampleInput, genres: 'drama' })
        const service = new (await import('../../services/movieService')).default({} as any, mockModel as any)
        const input = { ...sampleInput, director: '  Christopher Nolan  ' }

        // Act
        const result = await service.createMovie(input)

        // Assert
        expect(result).toMatchObject({ id: 11 })
        expect(mockModel.createMovie).toHaveBeenCalledWith(
            expect.objectContaining({
                result: expect.objectContaining({
                    data: expect.objectContaining({ director: '  Christopher Nolan  ' })
                })
            })
        )
    })
})
