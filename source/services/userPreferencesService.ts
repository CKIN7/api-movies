import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import { UserPreferences } from '../domain/UserPreferences'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import type { UpdateUserPreferencesDTO } from '../types/user'

export class UserPreferencesService {
    constructor(
        private userPreferencesRepository: UserPreferencesRepository,
    ) {}

    async getPreferences(userId: string) {
        try {
            const row = await this.userPreferencesRepository.findByUserId(userId)
            if (!row) {
                return {
                    favoriteGenres: [],
                    favoriteDirectors: [],
                    favoriteActors: [],
                    genreAffinity: {},
                    updatedAt: new Date(),
                }
            }
            return UserPreferences.fromRow(row).toResponse()
        } catch (error) {
            logger.error(`Error in getPreferences: ${(error as Error).message}`)
            throw new AppError('Error al obtener preferencias', 500)
        }
    }

    async updatePreferences(userId: string, dto: UpdateUserPreferencesDTO) {
        try {
            if (dto.favoriteGenres && dto.favoriteGenres.length > 0) {
                const found = await this.userPreferencesRepository.existingGenreIds(dto.favoriteGenres)
                if (found.length !== dto.favoriteGenres.length) {
                    throw new AppError('Uno o más genre_ids no existen', 400)
                }
            }

            if (dto.favoriteDirectors && dto.favoriteDirectors.length > 0) {
                const found = await this.userPreferencesRepository.existingDirectorIds(dto.favoriteDirectors)
                if (found.length !== dto.favoriteDirectors.length) {
                    throw new AppError('Uno o más director_ids no existen', 400)
                }
            }

            if (dto.favoriteActors && dto.favoriteActors.length > 0) {
                const found = await this.userPreferencesRepository.existingActorIds(dto.favoriteActors)
                if (found.length !== dto.favoriteActors.length) {
                    throw new AppError('Uno o más actor_ids no existen', 400)
                }
            }

            const row = await this.userPreferencesRepository.findByUserId(userId)
            const current = row ? UserPreferences.fromRow(row) : null

            const favoriteGenres = dto.favoriteGenres ?? current?.favoriteGenres ?? []
            const favoriteDirectors = dto.favoriteDirectors ?? current?.favoriteDirectors ?? []
            const favoriteActors = dto.favoriteActors ?? current?.favoriteActors ?? []

            if (row) {
                await this.userPreferencesRepository.update(userId, {
                    favoriteGenres,
                    favoriteDirectors,
                    favoriteActors,
                })
            } else {
                await this.userPreferencesRepository.insert(userId, {
                    favoriteGenres,
                    favoriteDirectors,
                    favoriteActors,
                    genreAffinity: {},
                })
            }

            return this.getPreferences(userId)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in updatePreferences: ${(error as Error).message}`)
            throw new AppError('Error al actualizar preferencias', 500)
        }
    }

    async getStats(userId: string) {
        try {
            return await this.userPreferencesRepository.getStats(userId)
        } catch (error) {
            logger.error(`Error in getStats: ${(error as Error).message}`)
            throw new AppError('Error al obtener estadísticas', 500)
        }
    }

    async updateGenreAffinity(userId: string, genreId: number, delta: number): Promise<void> {
        try {
            const row = await this.userPreferencesRepository.findByUserId(userId)
            const affinity = row
                ? UserPreferences.fromRow(row).genreAffinity
                : {}

            const key = String(genreId)
            affinity[key] = (affinity[key] ?? 0) + delta
            if (affinity[key] <= 0) delete affinity[key]

            if (row) {
                await this.userPreferencesRepository.saveAffinity(userId, affinity)
            } else {
                await this.userPreferencesRepository.insert(userId, {
                    favoriteGenres: [],
                    favoriteDirectors: [],
                    favoriteActors: [],
                    genreAffinity: affinity,
                })
            }
        } catch (error) {
            logger.error(`Error in updateGenreAffinity: ${(error as Error).message}`)
        }
    }
}
