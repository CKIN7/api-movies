import UserProfileRepository from '../repositories/UserProfileRepository'
import UserRepository from '../repositories/UserRepository'
import { UserPreferencesService } from './userPreferencesService'
import { UserProfile } from '../domain/UserProfile'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import { invalidateUserRecommendations } from '../utils/cache'
import type { PublicProfileResponse, UpdateUserProfileDTO, UserProfileResponse } from '../types/user'

const EMPTY_PROFILE: UserProfileResponse = {
    displayName: null,
    bio: null,
    avatarUrl: null,
    country: null,
    birthYear: null,
    isPublic: false,
    createdAt: '',
    updatedAt: '',
}

const PRIVATE_CARD: PublicProfileResponse = {
    displayName: null,
    bio: null,
    avatarUrl: null,
    country: null,
    isPublic: false,
}

export class UserProfileService {
    constructor(
        private profileRepo: UserProfileRepository,
        private userRepo: UserRepository,
        private prefsService: UserPreferencesService,
    ) {}

    async getMyProfile(userId: string): Promise<UserProfileResponse> {
        try {
            const row = await this.profileRepo.findByUserId(userId)
            if (!row) return { ...EMPTY_PROFILE }
            return UserProfile.fromRow(row).toResponse()
        } catch (error) {
            logger.error(`Error in getMyProfile: ${(error as Error).message}`)
            throw new AppError('Error al obtener el perfil', 500)
        }
    }

    async updateProfile(userId: string, dto: UpdateUserProfileDTO): Promise<UserProfileResponse> {
        try {
            const row = await this.profileRepo.findByUserId(userId)
            const current = row ? UserProfile.fromRow(row) : null

            const data = {
                displayName: dto.displayName !== undefined ? dto.displayName : current?.displayName ?? null,
                bio: dto.bio !== undefined ? dto.bio : current?.bio ?? null,
                avatarUrl: dto.avatarUrl !== undefined ? dto.avatarUrl : current?.avatarUrl ?? null,
                country: dto.country !== undefined ? dto.country : current?.country ?? null,
                birthYear: dto.birthYear !== undefined ? dto.birthYear : current?.birthYear ?? null,
                isPublic: dto.isPublic !== undefined ? dto.isPublic : current?.isPublic ?? false,
            }

            if (row) {
                await this.profileRepo.update(userId, data)
            } else {
                await this.profileRepo.insert(userId, data)
            }

            // Hoy recommendationService no lee user_profiles, pero birthYear y country
            // alimentarán filtros demográficos (edad y catálogo regional) en el futuro.
            // Se invalida solo si cambian esos campos para no recomputar recs por
            // cambios cosméticos (displayName, bio, avatarUrl, isPublic).
            const demographicsChanged =
                data.birthYear !== (current?.birthYear ?? null) ||
                data.country !== (current?.country ?? null)

            if (demographicsChanged) {
                await invalidateUserRecommendations(userId)
            }

            return this.getMyProfile(userId)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in updateProfile: ${(error as Error).message}`)
            throw new AppError('Error al actualizar el perfil', 500)
        }
    }

    async getPublicProfile(id: string): Promise<PublicProfileResponse> {
        try {
            const user = await this.userRepo.findById(id)
            if (!user) throw new AppError('Perfil no encontrado', 404)

            const row = await this.profileRepo.findByUserId(id)
            if (!row) return { ...PRIVATE_CARD }

            const profile = UserProfile.fromRow(row)
            if (!profile.isPublic) return { ...PRIVATE_CARD }

            const stats = await this.prefsService.getStats(id)

            return {
                displayName: profile.displayName,
                bio: profile.bio,
                avatarUrl: profile.avatarUrl,
                country: profile.country,
                isPublic: true,
                stats,
            }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in getPublicProfile: ${(error as Error).message}`)
            throw new AppError('Error al obtener el perfil', 500)
        }
    }
}
