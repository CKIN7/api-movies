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
        const service = new (await import('../../services/movieService')).default(mockModel as any)

        // Act
        const promise = service.createMovie(sampleInput)

        // Assert
        // ? esperar que promise rechace con AppError
        // ? el statusCode debe ser 409 (NO 500)
        // ? el mensaje debe ser 'Conflicto: título duplicado'
    })

    test('Error genérico (no AppError) se envuelve en AppError 500', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockRejectedValue(new Error('DB connection lost'))
        const service = new (await import('../../services/movieService')).default(mockModel as any)

        // Act
        const promise = service.createMovie(sampleInput)

        // Assert
        // ? esperar que promise rechace con AppError
        // ? statusCode debe ser 500
    })

    test('Error con campos especiales en input se pasan correctamente al modelo', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockResolvedValue({ id: 10, ...sampleInput, genres: 'drama' })
        const service = new (await import('../../services/movieService')).default(mockModel as any)
        const input = {
            ...sampleInput,
            title: 'Movie <script>alert("xss")</script>',
            director: "Robert'; DROP TABLE movies; --",
            genre: ['acción', 'comedia']
        }

        // Act
        const result = await service.createMovie(input)

        // Assert
        // ? el modelo fue llamado CON los mismos valores sin modificar
        // ? mockModel.createMovie llamado con { result: { data: input } }
        // ? result tiene id: 10
    })

    test('Director con espacios alrededor no se transforma (solo genre hace trim)', async () => {
        // Arrange
        const mockModel = createMockModel()
        mockModel.createMovie.mockResolvedValue({ id: 11, ...sampleInput, genres: 'drama' })
        const service = new (await import('../../services/movieService')).default(mockModel as any)
        const input = { ...sampleInput, director: '  Christopher Nolan  ' }

        // Act
        const result = await service.createMovie(input)

        // Assert
        // ? el director debe llegar al modelo con los espacios: '  Christopher Nolan  '
        // ? (el trim solo se aplica en genre, no en director)
    })
})
