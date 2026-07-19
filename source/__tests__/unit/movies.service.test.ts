import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

function createMockRepos() {
    return {
        movieRepo: {
            findMany: jest.fn().mockName('findMany'),
            findById: jest.fn().mockName('findById'),
            findSimilar: jest.fn().mockName('findSimilar'),
            insert: jest.fn().mockName('insert'),
            update: jest.fn().mockName('update'),
            delete: jest.fn().mockName('delete'),
            transaction: jest.fn().mockName('transaction'),
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

describe('MovieService - getMovies', () => {
    test('debe devolver películas cuando el repositorio responde exitosamente', async () => {
        const repos = createMockRepos()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ]
        repos.movieRepo.findMany.mockResolvedValue({ rows: fakeMovies, total: 1 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.getMovies({ genre: ['action'], genreMode: 'and', page: 1, limit: 10 })

        expect(result).toEqual({
            data: [{
                id: 1,
                title: 'Inception',
                year: 2010,
                director: 'Christopher Nolan',
                rating: 8.8,
                duration: 148,
                plot: '...',
                poster: '...',
                genres: ['Action', 'Sci-Fi'],
                cast: []
            }],
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })
        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ genre: ['action'], genreMode: 'and', limit: 10, offset: 0 })
        )
    })

    test('debe llamar al repositorio con los parámetros correctos', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await service.getMovies({ title: 'incept', genreMode: 'and', minYear: 2010, maxYear: 2010, page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'incept', limit: 10, offset: 0 })
        )
    })

    test('debe llamar al repositorio sin parámetros cuando no se pasan filtros', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await service.getMovies({ genreMode: 'and', page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        )
    })

    test('debe lanzar AppError con status 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockRejectedValue(new Error('DB error'))
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.getMovies({ genreMode: 'and', page: 1, limit: 10 })).rejects.toThrow(AppError)
    })
})

describe('MovieService - getSimilarMovies', () => {
    const fakeSimilarRows = [
        { id: 8, title: 'The Dark Knight Rises', year: 2012, director: 'Christopher Nolan', rating: 8.4, genres: 'action, drama', similarityScore: 6 },
        { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, genres: 'action, sci-fi', similarityScore: 6 },
    ]

    test('debe llamar a findSimilar del repositorio con los parámetros correctos', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findById.mockResolvedValue({ id: 1, title: 'Inception' })
        repos.movieRepo.findSimilar.mockResolvedValue({ rows: fakeSimilarRows, total: 2 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await service.getSimilarMovies(1, 1, 10)

        expect(repos.movieRepo.findSimilar).toHaveBeenCalledWith(1, 10, 0)
    })

    test('debe devolver paginated response con similarityScore en data', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findById.mockResolvedValue({ id: 1, title: 'Inception' })
        repos.movieRepo.findSimilar.mockResolvedValue({ rows: fakeSimilarRows, total: 2 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.getSimilarMovies(1, 1, 10)

        expect(result).toEqual({
            data: [
                { id: 8, title: 'The Dark Knight Rises', year: 2012, director: 'Christopher Nolan', rating: 8.4, genres: ['action', 'drama'], similarityScore: 6 },
                { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, genres: ['action', 'sci-fi'], similarityScore: 6 },
            ],
            meta: { total: 2, page: 1, limit: 10, totalPages: 1 }
        })
    })

    test('debe lanzar AppError 404 si la película origen no existe', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findById.mockResolvedValue(null)
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.getSimilarMovies(999, 1, 10)).rejects.toThrow(AppError)
        await expect(service.getSimilarMovies(999, 1, 10)).rejects.toMatchObject({ statusCode: 404 })
    })

    test('debe calcular totalPages correctamente', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findById.mockResolvedValue({ id: 1, title: 'Inception' })
        repos.movieRepo.findSimilar.mockResolvedValue({ rows: fakeSimilarRows, total: 25 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.getSimilarMovies(1, 3, 10)

        expect(result.meta).toEqual({ total: 25, page: 3, limit: 10, totalPages: 3 })
    })

    test('debe lanzar AppError 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findById.mockResolvedValue({ id: 1, title: 'Inception' })
        repos.movieRepo.findSimilar.mockRejectedValue(new Error('DB error'))
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.getSimilarMovies(1, 1, 10)).rejects.toMatchObject({ statusCode: 500 })
    })
})
