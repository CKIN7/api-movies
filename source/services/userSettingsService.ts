import UserSettingsRepository from '../repositories/UserSettingsRepository'
import { UserSettings } from '../domain/UserSettings'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import type { UpdateUserSettingsDTO, UserSettingsResponse } from '../types/user'

const DEFAULT_SETTINGS: UserSettingsResponse = {
    language: 'es',
    theme: 'system',
    region: null,
    notifyEmail: true,
    notifyPush: false,
    privacyReviews: 'public',
    privacyWatchlist: 'public',
    privacyActivity: 'friends',
    spoilerFree: false,
    updatedAt: null,
}

export class UserSettingsService {
    constructor(private settingsRepo: UserSettingsRepository) {}

    async getSettings(userId: string): Promise<UserSettingsResponse> {
        try {
            const row = await this.settingsRepo.findByUserId(userId)
            if (!row) return { ...DEFAULT_SETTINGS }
            return UserSettings.fromRow(row).toResponse()
        } catch (error) {
            logger.error(`Error in getSettings: ${(error as Error).message}`)
            throw new AppError('Error al obtener la configuración', 500)
        }
    }

    async updateSettings(userId: string, dto: UpdateUserSettingsDTO): Promise<UserSettingsResponse> {
        try {
            const row = await this.settingsRepo.findByUserId(userId)
            const current = row ? UserSettings.fromRow(row).toResponse() : { ...DEFAULT_SETTINGS }

            await this.settingsRepo.save(userId, {
                language: dto.language ?? current.language,
                theme: dto.theme ?? current.theme,
                region: dto.region !== undefined ? dto.region : current.region,
                notifyEmail: dto.notifyEmail ?? current.notifyEmail,
                notifyPush: dto.notifyPush ?? current.notifyPush,
                privacyReviews: dto.privacyReviews ?? current.privacyReviews,
                privacyWatchlist: dto.privacyWatchlist ?? current.privacyWatchlist,
                privacyActivity: dto.privacyActivity ?? current.privacyActivity,
                spoilerFree: dto.spoilerFree ?? current.spoilerFree,
            })

            return this.getSettings(userId)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in updateSettings: ${(error as Error).message}`)
            throw new AppError('Error al actualizar la configuración', 500)
        }
    }
}
