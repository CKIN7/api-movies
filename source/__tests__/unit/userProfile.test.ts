import { UserProfileService } from '../../services/userProfileService'
import { invalidateUserRecommendations } from '../../utils/cache'

jest.mock('../../utils/cache', () => ({
    invalidateUserRecommendations: jest.fn(),
}))

const mockProfileRepo = {
    findByUserId: jest.fn(),
    insert: jest.fn(),
    update: jest.fn(),
}

const mockUserRepo = {
    findById: jest.fn(),
}

const mockPrefsService = {
    getStats: jest.fn(),
}

const fullRow = {
    user_id: 'u1',
    display_name: 'Ana',
    bio: 'Fan del sci-fi',
    avatar_url: 'https://example.com/ana.png',
    country: 'ES',
    birth_year: 1990,
    is_public: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-02T00:00:00.000Z',
}

describe('UserProfileService (unit)', () => {
    let service: UserProfileService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new UserProfileService(mockProfileRepo as any, mockUserRepo as any, mockPrefsService as any)
    })

    describe('getMyProfile', () => {
        test('devuelve defaults cuando no existe fila', async () => {
            mockProfileRepo.findByUserId.mockResolvedValue(null)

            const result = await service.getMyProfile('u1')

            expect(result.displayName).toBeNull()
            expect(result.isPublic).toBe(false)
        })

        test('mapea la fila existente', async () => {
            mockProfileRepo.findByUserId.mockResolvedValue(fullRow)

            const result = await service.getMyProfile('u1')

            expect(result.displayName).toBe('Ana')
            expect(result.isPublic).toBe(true)
            expect(result.country).toBe('ES')
        })
    })

    describe('updateProfile', () => {
        test('inserta cuando no existe y invalida recs', async () => {
            mockProfileRepo.findByUserId
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce(fullRow)

            await service.updateProfile('u1', { displayName: 'Ana', isPublic: true })

            expect(mockProfileRepo.insert).toHaveBeenCalledWith('u1', expect.objectContaining({
                displayName: 'Ana',
                isPublic: true,
            }))
            expect(mockProfileRepo.update).not.toHaveBeenCalled()
            expect(invalidateUserRecommendations).toHaveBeenCalledWith('u1')
        })

        test('hace merge parcial conservando campos no enviados', async () => {
            mockProfileRepo.findByUserId
                .mockResolvedValueOnce(fullRow)
                .mockResolvedValueOnce({ ...fullRow, display_name: 'Ana María' })
            mockProfileRepo.update.mockResolvedValue(undefined)

            await service.updateProfile('u1', { displayName: 'Ana María' })

            expect(mockProfileRepo.update).toHaveBeenCalledWith('u1', expect.objectContaining({
                displayName: 'Ana María',
                bio: 'Fan del sci-fi',
                country: 'ES',
            }))
        })
    })

    describe('getPublicProfile', () => {
        test('lanza 404 si el usuario no existe', async () => {
            mockUserRepo.findById.mockResolvedValue(null)

            await expect(service.getPublicProfile('missing')).rejects.toThrow('Perfil no encontrado')
        })

        test('devuelve tarjeta minimal si el perfil es privado', async () => {
            mockUserRepo.findById.mockResolvedValue({ id: 'u1' })
            mockProfileRepo.findByUserId.mockResolvedValue({ ...fullRow, is_public: 0 })

            const result = await service.getPublicProfile('u1')

            expect(result.isPublic).toBe(false)
            expect(result.displayName).toBeNull()
            expect(mockPrefsService.getStats).not.toHaveBeenCalled()
        })

        test('incluye stats si el perfil es público', async () => {
            mockUserRepo.findById.mockResolvedValue({ id: 'u1' })
            mockProfileRepo.findByUserId.mockResolvedValue(fullRow)
            mockPrefsService.getStats.mockResolvedValue({
                topGenres: [], topDirectors: [], totalReviews: 3, totalWatchlist: 2,
            })

            const result = await service.getPublicProfile('u1')

            expect(result.isPublic).toBe(true)
            expect(result.displayName).toBe('Ana')
            expect(result.stats?.totalReviews).toBe(3)
        })
    })
})
