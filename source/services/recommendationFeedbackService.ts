import type { FeedbackAction, RecommendationFeedbackDTO, RecommendationFeedbackResult } from '../types/recommendation'
import type { RecommendationFeedbackRepository } from '../repositories/RecommendationFeedbackRepository'
import type { UserPreferencesService } from './userPreferencesService'
import type MovieRepository from '../repositories/MovieRepository'
import AppError from '../utils/AppError'
import logger from '../utils/logger'
import { invalidateUserRecommendations } from '../utils/cache'

export const FEEDBACK_AFFINITY_DELTA: Record<FeedbackAction, number> = {
    view: 0,
    hide: -0.5,
    like: 1,
    not_interested: -1.5,
}

export class RecommendationFeedbackService {
    constructor(
        private feedbackRepository: RecommendationFeedbackRepository,
        private userPreferencesService: UserPreferencesService,
        private movieRepository: MovieRepository,
    ) {}

    async recordFeedback(userId: string, dto: RecommendationFeedbackDTO): Promise<RecommendationFeedbackResult> {
        const movie = await this.movieRepository.findById(dto.movieId)
        if (!movie) {
            throw new AppError('Película no encontrada', 404)
        }

        const applied = await this.feedbackRepository.create(userId, dto.movieId, dto.action)
        const delta = FEEDBACK_AFFINITY_DELTA[dto.action]

        if (applied && delta !== 0) {
            const genreIds = await this.feedbackRepository.getGenreIds(dto.movieId)
            for (const genreId of genreIds) {
                await this.userPreferencesService.updateGenreAffinity(userId, genreId, delta)
            }
        }

        if (applied && dto.action !== 'view') {
            await invalidateUserRecommendations(userId)
        }

        return { ...dto, applied }
    }

    async getExcludedMovieIds(userId: string): Promise<number[]> {
        try {
            return await this.feedbackRepository.getExcludedMovieIds(userId)
        } catch (error) {
            logger.warn(`No se pudo cargar feedback de recomendaciones de ${userId}: ${(error as Error).message}`)
            return []
        }
    }
}
