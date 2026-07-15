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
    }
}

describe('MovieService - getMovies', () => {
    test('debe devolver películas cuando el repositorio responde exitosamente', async () => {
        const repos = createMockRepos()
        const fakeMovies = [
            { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: '...', poster: '...', genres: 'Action, Sci-Fi' }
        ]
        repos.movieRepo.findMany.mockResolvedValue({ rows: fakeMovies, total: 1 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any)

        const result = await service.getMovies({ genre: 'action', page: 1, limit: 10 })

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
                genres: ['Action', 'Sci-Fi']
            }],
            meta: { total: 1, page: 1, limit: 10, totalPages: 1 }
        })
        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ genre: 'action', limit: 10, offset: 0 })
        )
    })

    test('debe llamar al repositorio con los parámetros correctos', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any)

        await service.getMovies({ title: 'incept', year: 2010, page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ title: 'incept', limit: 10, offset: 0 })
        )
    })

    test('debe llamar al repositorio sin parámetros cuando no se pasan filtros', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockResolvedValue({ rows: [], total: 0 })
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any)

        await service.getMovies({ page: 1, limit: 10 })

        expect(repos.movieRepo.findMany).toHaveBeenCalledWith(
            expect.objectContaining({ limit: 10, offset: 0 })
        )
    })

    test('debe lanzar AppError con status 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findMany.mockRejectedValue(new Error('DB error'))
        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any)

        await expect(service.getMovies({ page: 1, limit: 10 })).rejects.toThrow(AppError)
    })
})
