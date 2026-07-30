import MovieService from '../../services/movieService'
import AppError from '../../utils/AppError'

function createMockRepos() {
    return {
        movieRepo: {
            findMany: jest.fn().mockName('findMany'),
            findById: jest.fn().mockName('findById'),
            findByIds: jest.fn().mockName('findByIds'),
            findRandomIds: jest.fn().mockName('findRandomIds'),
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

const fakeMovieRows = [
    { id: 1, title: 'Inception', year: 2010, director: 'Christopher Nolan', rating: 8.8, duration: 148, plot: 'A thief who steals corporate secrets through dream-sharing technology.', poster: 'https://example.com/inception.jpg', genres: 'Action, Sci-Fi, Thriller', cast: 'Leonardo DiCaprio||Cobb|||Joseph Gordon-Levitt||Arthur', age_rating: 'PG-13' },
    { id: 2, title: 'The Dark Knight', year: 2008, director: 'Christopher Nolan', rating: 9.0, duration: 152, plot: 'When the menace known as the Joker wreaks havoc on Gotham.', poster: 'https://example.com/dark-knight.jpg', genres: 'Action, Crime, Drama', cast: 'Christian Bale||Batman|||Heath Ledger||Joker', age_rating: 'PG-13' },
    { id: 3, title: 'Interstellar', year: 2014, director: 'Christopher Nolan', rating: 8.7, duration: 169, plot: 'A team of explorers travel through a wormhole in space.', poster: 'https://example.com/interstellar.jpg', genres: 'Adventure, Drama, Sci-Fi', cast: 'Matthew McConaughey||Cooper|||Anne Hathaway||Brand', age_rating: 'PG-13' },
    { id: 4, title: 'Pulp Fiction', year: 1994, director: 'Quentin Tarantino', rating: 8.9, duration: 154, plot: 'The lives of two mob hitmen, a boxer, a gangster and his wife intertwine.', poster: 'https://example.com/pulp-fiction.jpg', genres: 'Crime, Drama', cast: 'John Travolta||Vincent Vega|||Samuel L. Jackson||Jules Winnfield', age_rating: 'R' },
    { id: 5, title: 'The Matrix', year: 1999, director: 'Lana Wachowski', rating: 8.7, duration: 136, plot: 'A computer hacker learns about the true nature of his reality.', poster: 'https://example.com/matrix.jpg', genres: 'Action, Sci-Fi', cast: 'Keanu Reeves||Neo|||Laurence Fishburne||Morpheus', age_rating: 'R' },
]

function expectedResponse(row: typeof fakeMovieRows[0]) {
    return {
        id: row.id,
        title: row.title,
        year: row.year,
        director: row.director,
        rating: row.rating,
        duration: row.duration,
        plot: row.plot,
        poster: row.poster,
        genres: row.genres.split(', '),
        cast: row.cast.split('|||').map(p => {
            const [actor, character] = p.split('||')
            return { actor: actor.trim(), character: (character || '').trim() }
        }),
        ageRating: row.age_rating,
    }
}

describe('MovieService - findRandomBatch', () => {

    test('debe devolver lote de N películas cuando hay suficientes resultados', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([1, 3, 5])
        repos.movieRepo.findByIds.mockResolvedValue([fakeMovieRows[0], fakeMovieRows[2], fakeMovieRows[4]])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.findRandomBatch({ count: 3 })

        expect(result).toEqual({
            data: [fakeMovieRows[0], fakeMovieRows[2], fakeMovieRows[4]].map(expectedResponse)
        })
        expect(repos.movieRepo.findRandomIds).toHaveBeenCalledWith(expect.objectContaining({ count: 3 }))
        expect(repos.movieRepo.findByIds).toHaveBeenCalledWith([1, 3, 5])
    })

    test('debe devolver menos películas si hay pocos resultados', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([2])
        repos.movieRepo.findByIds.mockResolvedValue([fakeMovieRows[1]])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.findRandomBatch({ count: 5 })

        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(2)
    })

    test('debe lanzar AppError 404 si no hay resultados', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.findRandomBatch({ count: 3 })).rejects.toThrow(AppError)
        await expect(service.findRandomBatch({ count: 3 })).rejects.toMatchObject({ statusCode: 404 })
    })

    test('debe aplicar filtros correctamente', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([4])
        repos.movieRepo.findByIds.mockResolvedValue([fakeMovieRows[3]])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.findRandomBatch({ genre: ['crime'], minRating: 8, count: 1 })

        expect(result.data).toHaveLength(1)
        expect(result.data[0].id).toBe(4)
        expect(repos.movieRepo.findRandomIds).toHaveBeenCalledWith(
            expect.objectContaining({ genre: ['crime'], minRating: 8, count: 1 })
        )
    })

    test('debe lanzar AppError 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockRejectedValue(new Error('DB error'))

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.findRandomBatch({ count: 3 })).rejects.toMatchObject({ statusCode: 500 })
    })
})

describe('MovieService - findRandom (backward compat)', () => {

    test('debe devolver una sola película cuando no se envía count', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([1])
        repos.movieRepo.findById.mockResolvedValue(fakeMovieRows[0])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        const result = await service.findRandom({})

        expect(result).toEqual(expectedResponse(fakeMovieRows[0]))
        expect(repos.movieRepo.findRandomIds).toHaveBeenCalledWith(expect.objectContaining({}))
        expect(repos.movieRepo.findById).toHaveBeenCalledWith(1)
    })

    test('debe lanzar AppError 404 si no hay resultados', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([])

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.findRandom({})).rejects.toThrow(AppError)
        await expect(service.findRandom({})).rejects.toMatchObject({ statusCode: 404 })
    })

    test('debe lanzar AppError 404 si la película ya no está disponible', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockResolvedValue([999])
        repos.movieRepo.findById.mockResolvedValue(null)

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.findRandom({})).rejects.toThrow(AppError)
        await expect(service.findRandom({})).rejects.toMatchObject({ statusCode: 404 })
    })

    test('debe lanzar AppError 500 si el repositorio falla', async () => {
        const repos = createMockRepos()
        repos.movieRepo.findRandomIds.mockRejectedValue(new Error('DB error'))

        const service = new MovieService(repos.movieRepo as any, repos.directorRepo as any, repos.genreRepo as any, repos.auditRepo as any, repos.castRepo as any)

        await expect(service.findRandom({})).rejects.toMatchObject({ statusCode: 500 })
    })
})
