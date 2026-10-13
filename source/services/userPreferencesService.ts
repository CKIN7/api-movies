import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import { GenreRepository } from '../repositories/GenreRepository'
import { DirectorRepository } from '../repositories/DirectorRepository'
import { CastRepository } from '../repositories/CastRepository'
import { UserPreferences } from '../domain/UserPreferences'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import type { UpdateUserPreferencesDTO } from '../types/user'

export class UserPreferencesService {
    constructor(
        private userPreferencesRepository: UserPreferencesRepository,
        private genreRepository: GenreRepository,
        private directorRepository: DirectorRepository,
        private castRepository: CastRepository,
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
                const genres = await this.genreRepository.findByIds(dto.favoriteGenres)
                if (genres.length !== dto.favoriteGenres.length) {
                    throw new AppError('Uno o más genre_ids no existen', 400)
                }
            }

            if (dto.favoriteDirectors && dto.favoriteDirectors.length > 0) {
                const directors = await this.directorRepository.findByIds(dto.favoriteDirectors)
                if (directors.length !== dto.favoriteDirectors.length) {
                    throw new AppError('Uno o más director_ids no existen', 400)
                }
            }

            if (dto.favoriteActors && dto.favoriteActors.length > 0) {
                const actors = await this.castRepository.findByIds(dto.favoriteActors)
                if (actors.length !== dto.favoriteActors.length) {
                    throw new AppError('Uno o más actor_ids no existen', 400)
                }
            }

            await this.userPreferencesRepository.upsert(userId, {
                favoriteGenres: dto.favoriteGenres,
                favoriteDirectors: dto.favoriteDirectors,
                favoriteActors: dto.favoriteActors,
            })

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
            await this.userPreferencesRepository.updateGenreAffinity(userId, genreId, delta)
        } catch (error) {
            logger.error(`Error in updateGenreAffinity: ${(error as Error).message}`)
        }
    }
}
