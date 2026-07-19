import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

function createMockRepos() {
    return {
        movieRepo: {
            findMany: jest.fn().mockName('findMany'),
            findById: jest.fn().mockName('findById'),
            insert: jest.fn().mockName('insert'),
            update: jest.fn().mockName('update'),
            delete: jest.fn().mockName('delete'),
            transaction: jest.fn((fn: () => Promise<any>) => fn()).mockName('transaction'),
            countAll: jest.fn().mockName('countAll'),
        },
        directorRepo: {
            findByName: jest.fn().mockName('findByName'),
            create: jest.fn().mockName('create'),
            findOrCreate: jest.fn().mockName('findOrCreate'),
        },
        genreRepo: {
            findByName: jest.fn().mockName('findByName'),
            create: jest.fn().mockName('create'),
            findOrCreate: jest.fn().mockName('findOrCreate'),
            deleteByMovieId: jest.fn().mockName('deleteByMovieId'),
            linkToMovie: jest.fn().mockName('linkToMovie'),
        },
        auditRepo: {
            findByMovieId: jest.fn().mockName('findByMovieId'),
            countByMovieId: jest.fn().mockName('countByMovieId'),
            record: jest.fn().mockName('record'),
        },
        castRepo: {
            findByName: jest.fn().mockName('findByName'),
            create: jest.fn().mockName('create'),
            findOrCreate: jest.fn().mockName('findOrCreate'),
            linkToMovie: jest.fn().mockName('linkToMovie'),
            deleteByMovieId: jest.fn().mockName('deleteByMovieId'),
        },
    }
}

describe('MovieService - createMovie', () => {
    test('debe crear y devolver la película completa con id', async () => {
        const repos = createMockRepos()
        const fakeRow = {
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
        repos.directorRepo.findOrCreate.mockResolvedValue(1)
        repos.movieRepo.insert.mockResolvedValue(9)
        repos.genreRepo.findOrCreate.mockResolvedValue(1)
        repos.movieRepo.findById.mockResolvedValue(fakeRow)

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const inputData = {
            title: 'Nueva Película',
            year: 2024,
            rating: 7.5,
            duration: 120,
            plot: 'Un argumento de prueba',
            poster: 'https://example.com/poster.jpg',
            director: 'Nuevo Director',
            genre: ['drama'],
            available: true,
            cast: [{actor: 'leo', character: 'test'}]
        }

        const result = await service.createMovie(inputData)

        expect(result).toEqual({
            id: 9,
            title: 'Nueva Película',
            year: 2024,
            director: 'Nuevo Director',
            rating: 7.5,
            duration: 120,
            plot: 'Un argumento de prueba',
            poster: 'https://example.com/poster.jpg',
            genres: ['drama'],
            cast: []
        })
        expect(repos.movieRepo.insert).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'Nueva Película', directorId: 1 })
        )
    })

    test('debe lanzar AppError con status 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.transaction.mockRejectedValue(new Error('DB error'))

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const inputData = {
            title: 'Fallo',
            year: 2024,
            rating: 5,
            duration: 100,
            plot: '...',
            poster: 'https://example.com/p.jpg',
            director: 'Alguien',
            genre: ['drama'],
            available: true,
            cast: [{actor: 'Leo', character: 'prueba'}]
        }

        await expect(service.createMovie(inputData)).rejects.toThrow(AppError)
    })
})
