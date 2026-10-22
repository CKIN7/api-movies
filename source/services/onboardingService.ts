import type { OnboardingDTO, OnboardingResult } from '../types/user'
import { UserPreferencesService } from './userPreferencesService'
import { UserSettingsService } from './userSettingsService'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import { invalidateUserRecommendations } from '../utils/cache'

export const ONBOARDING_GENRE_AFFINITY = 5

export class OnboardingService {
    constructor(
        private userPreferencesService: UserPreferencesService,
        private userSettingsService: UserSettingsService,
    ) {}

    async completeOnboarding(userId: string, dto: OnboardingDTO): Promise<OnboardingResult> {
        try {
            const settings = await this.userSettingsService.getSettings(userId)
            const firstRun = !settings.onboardingCompleted

            await this.userPreferencesService.updatePreferences(userId, {
                favoriteGenres: dto.favoriteGenres,
                favoriteDirectors: dto.favoriteDirectors,
            })

            if (firstRun) {
                for (const genreId of dto.favoriteGenres) {
                    await this.userPreferencesService.updateGenreAffinity(
                        userId,
                        genreId,
                        ONBOARDING_GENRE_AFFINITY,
                    )
                }
            }

            await this.userSettingsService.completeOnboarding(userId)
            await invalidateUserRecommendations(userId)

            const prefs = await this.userPreferencesService.getPreferences(userId)

            return {
                onboardingCompleted: true,
                seeded: firstRun,
                favoriteGenres: prefs.favoriteGenres,
                favoriteDirectors: prefs.favoriteDirectors,
            }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in completeOnboarding: ${(error as Error).message}`)
            throw new AppError('Error al completar el onboarding', 500)
        }
    }
}
