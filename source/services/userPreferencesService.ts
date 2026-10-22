import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import { UserPreferences } from '../domain/UserPreferences'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import { invalidateUserRecommendations } from '../utils/cache'
import type { ContentFilters, GenreAffinity, UpdateUserPreferencesDTO } from '../types/user'

function intersection(a: number[], b: number[]): number[] {
    const set = new Set(b)
    return a.filter((id) => set.has(id))
}

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
                    dislikedGenres: [],
                    dislikedDirectors: [],
                    dislikedActors: [],
                    contentFilters: {},
                    genreAffinity: {},
                    updatedAt: null,
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
            await this.validateIds(dto)

            const row = await this.userPreferencesRepository.findByUserId(userId)
            const current = row ? UserPreferences.fromRow(row) : null

            const favoriteGenres = dto.favoriteGenres ?? current?.favoriteGenres ?? []
            const favoriteDirectors = dto.favoriteDirectors ?? current?.favoriteDirectors ?? []
            const favoriteActors = dto.favoriteActors ?? current?.favoriteActors ?? []
            const dislikedGenres = dto.dislikedGenres ?? current?.dislikedGenres ?? []
            const dislikedDirectors = dto.dislikedDirectors ?? current?.dislikedDirectors ?? []
            const dislikedActors = dto.dislikedActors ?? current?.dislikedActors ?? []
            const contentFilters: ContentFilters = dto.contentFilters ?? current?.contentFilters ?? {}

            this.assertNoConflict(favoriteGenres, dislikedGenres, 'género')
            this.assertNoConflict(favoriteDirectors, dislikedDirectors, 'director')
            this.assertNoConflict(favoriteActors, dislikedActors, 'actor')

            const data = {
                favoriteGenres,
                favoriteDirectors,
                favoriteActors,
                dislikedGenres,
                dislikedDirectors,
                dislikedActors,
                contentFilters,
            }

            if (row) {
                await this.userPreferencesRepository.update(userId, data)
            } else {
                await this.userPreferencesRepository.insert(userId, { ...data, genreAffinity: {} })
            }

            await invalidateUserRecommendations(userId)

            return this.getPreferences(userId)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in updatePreferences: ${(error as Error).message}`)
            throw new AppError('Error al actualizar preferencias', 500)
        }
    }

    private async validateIds(dto: UpdateUserPreferencesDTO): Promise<void> {
        const genreIds = [...(dto.favoriteGenres ?? []), ...(dto.dislikedGenres ?? [])]
        if (genreIds.length > 0) {
            const found = await this.userPreferencesRepository.existingGenreIds(genreIds)
            if (found.length !== new Set(genreIds).size) {
                throw new AppError('Uno o más genre_ids no existen', 400)
            }
        }

        const directorIds = [...(dto.favoriteDirectors ?? []), ...(dto.dislikedDirectors ?? [])]
        if (directorIds.length > 0) {
            const found = await this.userPreferencesRepository.existingDirectorIds(directorIds)
            if (found.length !== new Set(directorIds).size) {
                throw new AppError('Uno o más director_ids no existen', 400)
            }
        }

        const actorIds = [...(dto.favoriteActors ?? []), ...(dto.dislikedActors ?? [])]
        if (actorIds.length > 0) {
            const found = await this.userPreferencesRepository.existingActorIds(actorIds)
            if (found.length !== new Set(actorIds).size) {
                throw new AppError('Uno o más actor_ids no existen', 400)
            }
        }
    }

    private assertNoConflict(favorites: number[], disliked: number[], label: string): void {
        if (intersection(favorites, disliked).length > 0) {
            throw new AppError(`Un ${label} no puede ser favorito y dislike a la vez`, 400)
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
            const affinity: GenreAffinity = row
                ? UserPreferences.fromRow(row).genreAffinity
                : {}

            const key = String(genreId)
            const currentValue = affinity[key]
            const currentScore = typeof currentValue === 'number'
                ? currentValue
                : currentValue?.score ?? 0
            const nextScore = currentScore + delta

            if (nextScore <= 0) {
                delete affinity[key]
            } else {
                affinity[key] = { score: nextScore, updatedAt: new Date().toISOString() }
            }

            if (row) {
                await this.userPreferencesRepository.saveAffinity(userId, affinity)
            } else {
                await this.userPreferencesRepository.insert(userId, {
                    favoriteGenres: [],
                    favoriteDirectors: [],
                    favoriteActors: [],
                    dislikedGenres: [],
                    dislikedDirectors: [],
                    dislikedActors: [],
                    contentFilters: {},
                    genreAffinity: affinity,
                })
            }
        } catch (error) {
            logger.warn('No se pudo actualizar genreAffinity', {
                userId,
                genreId,
                delta,
                error: (error as Error).message,
            })
        }
    }
}
