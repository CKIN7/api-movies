import RedisMock from 'ioredis-mock'
import MovieService from '../../services/movieService'
import type Redis from 'ioredis'

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
            findAll: jest.fn().mockName('findAll'),
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

const mockMovieRow = {
    id: 1,
    title: 'Inception',
    year: 2010,
    director: 'Christopher Nolan',
    rating: 8.8,
    duration: 148,
    plot: 'A thief who steals corporate secrets...',
    poster: 'https://example.com/inception.jpg',
    age_rating: 'PG-13',
    genres: 'Action, Sci-Fi',
    cast: 'Leonardo DiCaprio||Dom Cobb',
    average_rating: 8.5,
    reviews_count: 100,
}

describe('MovieService + Redis Cache Integration', () => {
    let redis: Redis
    let repos: ReturnType<typeof createMockRepos>
    let service: MovieService

    beforeEach(async () => {
        redis = new RedisMock() as unknown as Redis
        await redis.flushall()
        repos = createMockRepos()
        service = new MovieService(
            repos.movieRepo as any,
            repos.directorRepo as any,
            repos.genreRepo as any,
            repos.auditRepo as any,
            repos.castRepo as any,
            redis,
        )
    })

    afterEach(async () => {
        await redis.disconnect()
    })

    describe('getMovieById', () => {
        it('caches result and serves second call from cache', async () => {
            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)

            const first = await service.getMovieById(1)
            const second = await service.getMovieById(1)

            expect(first).toEqual(second)
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(1)

            const cached = await redis.get('movie:1')
            expect(cached).not.toBeNull()
            expect(JSON.parse(cached!)).toEqual(first)
        })

        it('returns fresh data after cache invalidation', async () => {
            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)
            await service.getMovieById(1)
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(1)

            repos.movieRepo.findById.mockResolvedValue({ ...mockMovieRow, title: 'Inception 2' })
            await redis.del('movie:1')

            const result = await service.getMovieById(1)
            expect(result.title).toBe('Inception 2')
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(2)
        })
    })

    describe('getMovies', () => {
        it('caches listado and serves second call from cache', async () => {
            repos.movieRepo.findMany.mockResolvedValue({ rows: [mockMovieRow], total: 1 })

            const params = { genre: ['action'], genreMode: 'and' as const, page: 1, limit: 10 }
            const first = await service.getMovies(params)
            const second = await service.getMovies(params)

            expect(first).toEqual(second)
            expect(repos.movieRepo.findMany).toHaveBeenCalledTimes(1)
        })

        it('uses different cache keys for different queries', async () => {
            repos.movieRepo.findMany.mockResolvedValue({ rows: [mockMovieRow], total: 1 })

            await service.getMovies({ genre: ['action'], genreMode: 'and', page: 1, limit: 10 })
            await service.getMovies({ genre: ['comedy'], genreMode: 'and', page: 1, limit: 10 })

            expect(repos.movieRepo.findMany).toHaveBeenCalledTimes(2)
        })
    })

    describe('getSimilarMovies', () => {
        it('caches similar movies and serves second call from cache', async () => {
            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)
            repos.movieRepo.findSimilar.mockResolvedValue({
                rows: [{ id: 2, title: 'The Dark Knight', year: 2008, director: 'Christopher Nolan', rating: 9.0, genres: 'Action', similarityScore: 5 }],
                total: 1,
            })

            const first = await service.getSimilarMovies(1, 1, 10)
            const second = await service.getSimilarMovies(1, 1, 10)

            expect(first).toEqual(second)
            expect(repos.movieRepo.findSimilar).toHaveBeenCalledTimes(1)
        })
    })

    describe('getAllGenres', () => {
        it('caches genres and serves second call from cache', async () => {
            repos.genreRepo.findAll.mockResolvedValue(['Action', 'Comedy', 'Drama'])

            const first = await service.getAllGenres()
            const second = await service.getAllGenres()

            expect(first).toEqual(second)
            expect(repos.genreRepo.findAll).toHaveBeenCalledTimes(1)
        })
    })

    describe('Cache invalidation on mutations', () => {
        it('updateMovie invalidates movie cache and similar cache', async () => {
            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)
            repos.movieRepo.findSimilar.mockResolvedValue({
                rows: [{ id: 2, title: 'The Dark Knight', year: 2008, director: 'Christopher Nolan', rating: 9.0, genres: 'Action', similarityScore: 5 }],
                total: 1,
            })
            await service.getMovieById(1)
            await service.getSimilarMovies(1, 1, 10)
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(2)

            repos.movieRepo.transaction.mockImplementation(async (fn: () => Promise<any>) => fn())
            repos.movieRepo.update.mockResolvedValue(true)

            await service.updateMovie(1, { title: 'Updated Title' })

            repos.movieRepo.findById.mockResolvedValue({ ...mockMovieRow, title: 'Updated Title' })
            const result = await service.getMovieById(1)
            expect(result.title).toBe('Updated Title')
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(5)
        })

        it('deleteMovie invalidates movie cache', async () => {
            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)
            await service.getMovieById(1)
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(1)

            repos.movieRepo.transaction.mockImplementation(async (fn: () => Promise<any>) => fn())
            repos.movieRepo.delete.mockResolvedValue(true)

            await service.deleteMovie(1)

            const cached = await redis.get('movie:1')
            expect(cached).toBeNull()
        })

        it('createMovie invalidates list cache and genres', async () => {
            repos.movieRepo.findMany.mockResolvedValue({ rows: [mockMovieRow], total: 1 })
            repos.genreRepo.findAll.mockResolvedValue(['Action'])

            await service.getMovies({ genreMode: 'and', page: 1, limit: 10 })
            await service.getAllGenres()
            expect(repos.movieRepo.findMany).toHaveBeenCalledTimes(1)
            expect(repos.genreRepo.findAll).toHaveBeenCalledTimes(1)

            repos.movieRepo.transaction.mockImplementation(async (fn: () => Promise<any>) => fn())
            repos.movieRepo.insert.mockResolvedValue(2)
            repos.directorRepo.findOrCreate.mockResolvedValue(1)
            repos.genreRepo.findOrCreate.mockResolvedValue(1)
            repos.movieRepo.findById.mockResolvedValue({ ...mockMovieRow, id: 2 })

            await service.createMovie({
                title: 'New Movie',
                year: 2024,
                rating: 7.5,
                duration: 120,
                plot: 'A new plot',
                poster: 'https://example.com/new.jpg',
                director: 'New Director',
                genre: ['Action'],
                cast: [],
                ageRating: 'PG-13',
                available: true,
            })

            repos.movieRepo.findMany.mockResolvedValue({ rows: [mockMovieRow, { ...mockMovieRow, id: 2 }], total: 2 })
            await service.getMovies({ genreMode: 'and', page: 1, limit: 10 })
            expect(repos.movieRepo.findMany).toHaveBeenCalledTimes(2)
        })
    })

    describe('Fail-open when Redis is unavailable', () => {
        it('falls back to MySQL when Redis throws', async () => {
            const failingRedis = {
                status: 'ready',
                get: jest.fn().mockRejectedValue(new Error('Redis down')),
                set: jest.fn().mockRejectedValue(new Error('Redis down')),
                del: jest.fn().mockRejectedValue(new Error('Redis down')),
                scan: jest.fn().mockRejectedValue(new Error('Redis down')),
            } as unknown as Redis

            repos.movieRepo.findById.mockResolvedValue(mockMovieRow)
            const serviceWithBadRedis = new MovieService(
                repos.movieRepo as any,
                repos.directorRepo as any,
                repos.genreRepo as any,
                repos.auditRepo as any,
                repos.castRepo as any,
                failingRedis,
            )

            const result = await serviceWithBadRedis.getMovieById(1)
            expect(result.title).toBe('Inception')
            expect(repos.movieRepo.findById).toHaveBeenCalledTimes(1)
        })
    })
})
