import { UserPreferencesRepository } from '../repositories/UserPreferencesRepository'
import { UserPreferences } from '../domain/UserPreferences'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import type { UpdateUserPreferencesDTO } from '../types/user'
import { DbLogger } from '../utils/DbLogger'

export class UserPreferencesService {
    constructor(
        private userPreferencesRepository: UserPreferencesRepository,
        private conn: any,
    ) {}

    private async query(sql: string, params?: any[]) {
        return await DbLogger.query('query', sql, params || [], () => this.conn.query(sql, params)) as any
    }

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
                const [rows] = await this.query(
                    'SELECT id_genre FROM genres WHERE id_genre IN (?)',
                    [dto.favoriteGenres]
                )
                if ((rows as any[]).length !== dto.favoriteGenres.length) {
                    throw new AppError('Uno o más genre_ids no existen', 400)
                }
            }

            if (dto.favoriteDirectors && dto.favoriteDirectors.length > 0) {
                const [rows] = await this.query(
                    'SELECT director_id FROM directors WHERE director_id IN (?)',
                    [dto.favoriteDirectors]
                )
                if ((rows as any[]).length !== dto.favoriteDirectors.length) {
                    throw new AppError('Uno o más director_ids no existen', 400)
                }
            }

            if (dto.favoriteActors && dto.favoriteActors.length > 0) {
                const [rows] = await this.query(
                    'SELECT actor_id FROM actors WHERE actor_id IN (?)',
                    [dto.favoriteActors]
                )
                if ((rows as any[]).length !== dto.favoriteActors.length) {
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
