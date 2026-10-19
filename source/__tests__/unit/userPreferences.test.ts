import { UserPreferencesService } from '../../services/userPreferencesService'
import { UserPreferencesRepository } from '../../repositories/UserPreferencesRepository'
import { invalidateUserRecommendations } from '../../utils/cache'

jest.mock('../../utils/cache', () => ({
    invalidateUserRecommendations: jest.fn(),
}))

const mockUserPreferencesRepo = {
    findByUserId: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
    saveAffinity: jest.fn(),
    existingGenreIds: jest.fn(),
    existingDirectorIds: jest.fn(),
    existingActorIds: jest.fn(),
    getStats: jest.fn(),
}

const existingRow = {
    user_id: 'user-1',
    favorite_genres: '[1, 3]',
    favorite_directors: '[2]',
    favorite_actors: '[10]',
    disliked_genres: '[]',
    disliked_directors: '[]',
    disliked_actors: '[]',
    content_filters: '{}',
    genre_affinity: '{"1": {"score": 8, "updatedAt": "2026-10-13T10:00:00.000Z"}}',
    updated_at: '2026-10-13T10:00:00.000Z',
}

describe('UserPreferencesService (unit)', () => {
    let service: UserPreferencesService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new UserPreferencesService(
            mockUserPreferencesRepo as unknown as UserPreferencesRepository,
        )
    })

    describe('getPreferences', () => {
        test('retorna preferencias del usuario cuando existen', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue({
                ...existingRow,
                favorite_actors: null,
                genre_affinity: '{"1": 8.5}',
            })

            const result = await service.getPreferences('user-1')

            expect(result.favoriteGenres).toEqual([1, 3])
            expect(result.favoriteDirectors).toEqual([2])
            expect(result.favoriteActors).toEqual([])
            expect(result.genreAffinity).toEqual({ '1': 8.5 })
        })

        test('retorna preferencias vacías y updatedAt null cuando no existen', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)

            const result = await service.getPreferences('user-1')

            expect(result.favoriteGenres).toEqual([])
            expect(result.dislikedGenres).toEqual([])
            expect(result.contentFilters).toEqual({})
            expect(result.genreAffinity).toEqual({})
            expect(result.updatedAt).toBeNull()
        })
    })

    describe('updatePreferences', () => {
        test('actualiza favoritos, invalida recs y hace merge con campos no enviados', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1, 3])
            mockUserPreferencesRepo.findByUserId
                .mockResolvedValueOnce(existingRow)
                .mockResolvedValueOnce({ ...existingRow, favorite_genres: '[1, 3]' })

            const result = await service.updatePreferences('user-1', { favoriteGenres: [1, 3] })

            expect(mockUserPreferencesRepo.update).toHaveBeenCalledWith('user-1', {
                favoriteGenres: [1, 3],
                favoriteDirectors: [2],
                favoriteActors: [10],
                dislikedGenres: [],
                dislikedDirectors: [],
                dislikedActors: [],
                contentFilters: {},
            })
            expect(mockUserPreferencesRepo.insert).not.toHaveBeenCalled()
            expect(invalidateUserRecommendations).toHaveBeenCalledWith('user-1')
            expect(result.favoriteGenres).toEqual([1, 3])
        })

        test('inserta fila cuando no existe', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1])
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)
            mockUserPreferencesRepo.insert.mockResolvedValue(undefined)

            await service.updatePreferences('user-1', { favoriteGenres: [1] })

            expect(mockUserPreferencesRepo.insert).toHaveBeenCalledWith('user-1', expect.objectContaining({
                favoriteGenres: [1],
                favoriteDirectors: [],
                favoriteActors: [],
                dislikedGenres: [],
                contentFilters: {},
                genreAffinity: {},
            }))
            expect(mockUserPreferencesRepo.update).not.toHaveBeenCalled()
            expect(invalidateUserRecommendations).toHaveBeenCalledWith('user-1')
        })

        test('lanza 400 si genre_id no existe', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1])

            await expect(
                service.updatePreferences('user-1', { favoriteGenres: [1, 999] })
            ).rejects.toThrow('Uno o más genre_ids no existen')
            expect(mockUserPreferencesRepo.findByUserId).not.toHaveBeenCalled()
        })

        test('lanza 400 si director_id no existe', async () => {
            mockUserPreferencesRepo.existingDirectorIds.mockResolvedValue([2])

            await expect(
                service.updatePreferences('user-1', { favoriteDirectors: [2, 999] })
            ).rejects.toThrow('Uno o más director_ids no existen')
        })

        test('lanza 400 si actor_id no existe', async () => {
            mockUserPreferencesRepo.existingActorIds.mockResolvedValue([10])

            await expect(
                service.updatePreferences('user-1', { favoriteActors: [10, 999] })
            ).rejects.toThrow('Uno o más actor_ids no existen')
        })

        test('lanza 400 si un id es favorito y dislike a la vez', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1, 3])
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(existingRow)

            await expect(
                service.updatePreferences('user-1', { favoriteGenres: [1, 3], dislikedGenres: [3] })
            ).rejects.toThrow('no puede ser favorito y dislike')
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
        test('suma el delta, guarda con timestamp y persiste', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(existingRow)
            mockUserPreferencesRepo.saveAffinity.mockResolvedValue(undefined)

            await service.updateGenreAffinity('user-1', 1, 3)

            const saved = mockUserPreferencesRepo.saveAffinity.mock.calls[0][1]
            expect(saved['1'].score).toBe(11)
            expect(typeof saved['1'].updatedAt).toBe('string')
        })

        test('borra la clave cuando el delta deja el contador en cero o menos', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(existingRow)

            await service.updateGenreAffinity('user-1', 1, -8)

            expect(mockUserPreferencesRepo.saveAffinity).toHaveBeenCalledWith('user-1', {})
        })

        test('crea la fila con affinity cuando el usuario no tiene preferencias', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)
            mockUserPreferencesRepo.insert.mockResolvedValue(undefined)

            await service.updateGenreAffinity('user-1', 5, 3)

            const inserted = mockUserPreferencesRepo.insert.mock.calls[0][1]
            expect(inserted.genreAffinity['5'].score).toBe(3)
            expect(inserted.favoriteGenres).toEqual([])
        })

        test('no propaga error: loguea warn si falla la escritura', async () => {
            mockUserPreferencesRepo.findByUserId.mockRejectedValue(new Error('db down'))

            await expect(service.updateGenreAffinity('user-1', 1, 3)).resolves.toBeUndefined()
        })
    })
})
