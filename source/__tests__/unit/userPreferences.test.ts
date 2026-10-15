import { UserPreferencesService } from '../../services/userPreferencesService'
import { UserPreferencesRepository } from '../../repositories/UserPreferencesRepository'

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
    genre_affinity: '{"1": 8}',
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
        test('actualiza favoritos sobre fila existente (merge con campos no enviados)', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1, 3])
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(existingRow)
            mockUserPreferencesRepo.update.mockResolvedValue(undefined)
            mockUserPreferencesRepo.findByUserId
                .mockResolvedValueOnce(existingRow)
                .mockResolvedValueOnce({ ...existingRow, favorite_genres: '[1, 3]' })

            const result = await service.updatePreferences('user-1', { favoriteGenres: [1, 3] })

            expect(mockUserPreferencesRepo.update).toHaveBeenCalledWith('user-1', {
                favoriteGenres: [1, 3],
                favoriteDirectors: [2],
                favoriteActors: [10],
            })
            expect(mockUserPreferencesRepo.insert).not.toHaveBeenCalled()
            expect(result.favoriteGenres).toEqual([1, 3])
        })

        test('inserta fila cuando no existe', async () => {
            mockUserPreferencesRepo.existingGenreIds.mockResolvedValue([1])
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)
            mockUserPreferencesRepo.insert.mockResolvedValue(undefined)

            await service.updatePreferences('user-1', { favoriteGenres: [1] })

            expect(mockUserPreferencesRepo.insert).toHaveBeenCalledWith('user-1', {
                favoriteGenres: [1],
                favoriteDirectors: [],
                favoriteActors: [],
                genreAffinity: {},
            })
            expect(mockUserPreferencesRepo.update).not.toHaveBeenCalled()
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
        test('suma el delta al affinity existente y persiste', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue({
                ...existingRow,
                genre_affinity: '{"1": 5, "3": 2}',
            })
            mockUserPreferencesRepo.saveAffinity.mockResolvedValue(undefined)

            await service.updateGenreAffinity('user-1', 1, 3)

            expect(mockUserPreferencesRepo.saveAffinity).toHaveBeenCalledWith('user-1', {
                '1': 8,
                '3': 2,
            })
        })

        test('borra la clave cuando el delta deja el contador en cero o menos', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue({
                ...existingRow,
                genre_affinity: '{"1": 5}',
            })

            await service.updateGenreAffinity('user-1', 1, -5)

            expect(mockUserPreferencesRepo.saveAffinity).toHaveBeenCalledWith('user-1', {})
        })

        test('crea la fila con affinity cuando el usuario no tiene preferencias', async () => {
            mockUserPreferencesRepo.findByUserId.mockResolvedValue(null)
            mockUserPreferencesRepo.insert.mockResolvedValue(undefined)

            await service.updateGenreAffinity('user-1', 5, 3)

            expect(mockUserPreferencesRepo.insert).toHaveBeenCalledWith('user-1', {
                favoriteGenres: [],
                favoriteDirectors: [],
                favoriteActors: [],
                genreAffinity: { '5': 3 },
            })
        })
    })
})
