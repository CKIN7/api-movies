import MovieService from '../../services/movieService'
import type { AgeRating } from '../../types/movie'
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

const sampleInput = {
    title: 'Service Edge',
    year: 2024,
    rating: 5,
    duration: 100,
    plot: 'Service edge plot',
    poster: 'https://example.com/service.jpg',
    director: 'Service Director',
    genre: ['drama'],
    available: true,
    ageRating: 'PG-13' as AgeRating,
    cast: []
}

describe('MovieService — error propagation', () => {

    test('AppError del repositorio se propaga sin cambiar statusCode', async () => {
        const repos = createMockRepos()
        repos.movieRepo.transaction.mockRejectedValue(new AppError('Conflicto: título duplicado', 409))

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.createMovie(sampleInput)).rejects.toThrow(AppError)
        await expect(service.createMovie(sampleInput)).rejects.toMatchObject({
            statusCode: 409,
            message: 'Conflicto: título duplicado'
        })
    })

    test('Error genérico (no AppError) se envuelve en AppError 500', async () => {
        const repos = createMockRepos()
        repos.movieRepo.transaction.mockRejectedValue(new Error('DB connection lost'))

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.createMovie(sampleInput)).rejects.toThrow(AppError)
        await expect(service.createMovie(sampleInput)).rejects.toMatchObject({ statusCode: 500 })
    })

    test('Director con espacios alrededor no se transforma (solo genre hace trim)', async () => {
        const repos = createMockRepos()
        const fakeRow = {
            id: 11,
            title: 'Service Edge',
            year: 2024,
            director: 'Service Director',
            rating: 5,
            duration: 100,
            plot: 'Service edge plot',
            poster: 'https://example.com/service.jpg',
            genres: 'drama',
            cast: '',
            age_rating: 'PG-13',
        }
        repos.directorRepo.findOrCreate.mockResolvedValue(1)
        repos.movieRepo.insert.mockResolvedValue(11)
        repos.genreRepo.findOrCreate.mockResolvedValue(1)
        repos.movieRepo.findById.mockResolvedValue(fakeRow)

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)
        const input = { ...sampleInput, director: '  Christopher Nolan  ' }

        const result = await service.createMovie(input)

        expect(result).toMatchObject({ id: 11 })
    })
})
