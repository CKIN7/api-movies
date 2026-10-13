import { UserPreferencesService } from '../../services/userPreferencesService'
import { UserPreferencesRepository } from '../../repositories/UserPreferencesRepository'

const mockUserPreferencesRepo = {
    findByUserId: jest.fn(),
    upsert: jest.fn(),
    updateGenreAffinity: jest.fn(),
    getStats: jest.fn(),
}

const mockConn = {
    query: jest.fn(),
}

describe('UserPreferencesService (unit)', () => {
    let service: UserPreferencesService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new UserPreferencesService(
            mockUserPreferencesRepo as unknown as UserPreferencesRepository,
            mockConn as any
        )
    })

    describe('getPreferences', () => {
        test('retorna preferencias del usuario cuando existen', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue({
                user_id: 'user-1',
                favorite_genres: '[1, 3]',
                favorite_directors: '[2]',
                favorite_actors: null,
                genre_affinity: '{"1": 8.5}',
                updated_at: '2026-10-13T10:00:00.000Z',
            })

            const result = await service.getPreferences('user-1')

            expect(result.favoriteGenres).toEqual([1, 3])
            expect(result.favoriteDirectors).toEqual([2])
            expect(result.favoriteActors).toEqual([])
            expect(result.genreAffinity).toEqual({ '1': 8.5 })
        })

        test('retorna preferencias vacías cuando no existen', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)

            const result = await service.getPreferences('user-1')

            expect(result.favoriteGenres).toEqual([])
            expect(result.favoriteDirectors).toEqual([])
            expect(result.favoriteActors).toEqual([])
            expect(result.genreAffinity).toEqual({})
        })
    })

    describe('updatePreferences', () => {
        test('actualiza preferencias válidas', async () => {
            mockConn.query.mockResolvedValue([[{ id_genre: 1 }, { id_genre: 3 }]])
            mockUserPreferencesRepo.upsert.mockResolvedValue(undefined)
            mockUserPreferencesRepo.findByUserId.mockResolvedValue({
                user_id: 'user-1',
                favorite_genres: '[1, 3]',
                favorite_directors: null,
                favorite_actors: null,
                genre_affinity: null,
                updated_at: '2026-10-13T10:00:00.000Z',
            })

            const result = await service.updatePreferences('user-1', { favoriteGenres: [1, 3] })

            expect(mockUserPreferencesRepo.upsert).toHaveBeenCalledWith('user-1', {
                favoriteGenres: [1, 3],
                favoriteDirectors: undefined,
                favoriteActors: undefined,
            })
            expect(result.favoriteGenres).toEqual([1, 3])
        })

        test('lanza 400 si genre_id no existe', async () => {
            mockConn.query.mockResolvedValue([[{ id_genre: 1 }]])

            await expect(
                service.updatePreferences('user-1', { favoriteGenres: [1, 999] })
            ).rejects.toThrow('Uno o más genre_ids no existen')
        })

        test('lanza 400 si director_id no existe', async () => {
            mockConn.query.mockResolvedValue([[{ director_id: 2 }]])

            await expect(
                service.updatePreferences('user-1', { favoriteDirectors: [2, 999] })
            ).rejects.toThrow('Uno o más director_ids no existen')
        })

        test('lanza 400 si actor_id no existe', async () => {
            mockConn.query.mockResolvedValue([[{ actor_id: 10 }]])

            await expect(
                service.updatePreferences('user-1', { favoriteActors: [10, 999] })
            ).rejects.toThrow('Uno o más actor_ids no existen')
        })
    })

    describe('getStats', () => {
        test('retorna estadísticas del usuario', async () => {
            mockUserPreferencesRepo.getStats.mockResolvedValue({
                topGenres: [{ genreId: 1, genreName: 'Drama', count: 5 }],
                topDirectors: [{ directorId: 2, directorName: 'Nolan', count: 3 }],
                totalReviews: 10,
                totalWatchlist: 5,
            })

            const result = await service.getStats('user-1')

            expect(result.totalReviews).toBe(10)
            expect(result.totalWatchlist).toBe(5)
            expect(result.topGenres).toHaveLength(1)
        })
    })

    describe('updateGenreAffinity', () => {
        test('llama al repository con parámetros correctos', async () => {
            mockUserPreferencesRepo.updateGenreAffinity.mockResolvedValue(undefined)

            await service.updateGenreAffinity('user-1', 5, 3)

            expect(mockUserPreferencesRepo.updateGenreAffinity).toHaveBeenCalledWith('user-1', 5, 3)
        })
    })
})
