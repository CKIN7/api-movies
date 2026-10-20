import { OnboardingService, ONBOARDING_GENRE_AFFINITY } from '../../services/onboardingService'
import { UserPreferencesService } from '../../services/userPreferencesService'
import { UserSettingsService } from '../../services/userSettingsService'
import { invalidateUserRecommendations } from '../../utils/cache'
import AppError from '../../utils/AppError'

jest.mock('../../utils/cache', () => ({
    invalidateUserRecommendations: jest.fn(),
}))

function makeService(overrides: {
    onboardingCompleted?: boolean
    updateError?: Error
} = {}) {
    const prefsService = {
        updatePreferences: overrides.updateError
            ? jest.fn().mockRejectedValue(overrides.updateError)
            : jest.fn().mockResolvedValue({}),
        updateGenreAffinity: jest.fn().mockResolvedValue(undefined),
        getPreferences: jest.fn().mockResolvedValue({
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        }),
    }
    const settingsService = {
        getSettings: jest.fn().mockResolvedValue({
            onboardingCompleted: overrides.onboardingCompleted ?? false,
        }),
        completeOnboarding: jest.fn().mockResolvedValue({ onboardingCompleted: true }),
    }

    const service = new OnboardingService(
        prefsService as unknown as UserPreferencesService,
        settingsService as unknown as UserSettingsService,
    )
    return { service, prefsService, settingsService }
}

describe('OnboardingService (unit)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('primera ejecución: guarda favoritos y siembra afinidad por género', async () => {
        const { service, prefsService, settingsService } = makeService()

        const result = await service.completeOnboarding('user-1', {
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        })

        expect(prefsService.updatePreferences).toHaveBeenCalledWith('user-1', {
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        })
        expect(prefsService.updateGenreAffinity).toHaveBeenNthCalledWith(
            1, 'user-1', 1, ONBOARDING_GENRE_AFFINITY,
        )
        expect(prefsService.updateGenreAffinity).toHaveBeenNthCalledWith(
            2, 'user-1', 2, ONBOARDING_GENRE_AFFINITY,
        )
        expect(settingsService.completeOnboarding).toHaveBeenCalledWith('user-1')
        expect(invalidateUserRecommendations).toHaveBeenCalledWith('user-1')
        expect(result).toEqual({
            onboardingCompleted: true,
            seeded: true,
            favoriteGenres: [1, 2],
            favoriteDirectors: [10],
        })
    })

    test('segunda ejecución: actualiza favoritos pero no vuelve a sembrar afinidad', async () => {
        const { service, prefsService } = makeService({ onboardingCompleted: true })

        const result = await service.completeOnboarding('user-1', { favoriteGenres: [2] })

        expect(prefsService.updatePreferences).toHaveBeenCalled()
        expect(prefsService.updateGenreAffinity).not.toHaveBeenCalled()
        expect(result.seeded).toBe(false)
    })

    test('propaga el 400 de validación sin completar el onboarding', async () => {
        const { service, settingsService } = makeService({
            updateError: new AppError('genre_id inexistente', 400),
        })

        await expect(service.completeOnboarding('user-1', { favoriteGenres: [999] }))
            .rejects.toMatchObject({ statusCode: 400 })
        expect(settingsService.completeOnboarding).not.toHaveBeenCalled()
    })
})
