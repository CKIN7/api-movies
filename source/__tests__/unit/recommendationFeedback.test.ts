import { RecommendationFeedbackService } from '../../services/recommendationFeedbackService'
import { RecommendationFeedbackRepository } from '../../repositories/RecommendationFeedbackRepository'
import { UserPreferencesService } from '../../services/userPreferencesService'
import MovieRepository from '../../repositories/MovieRepository'
import { invalidateUserRecommendations } from '../../utils/cache'
import AppError from '../../utils/AppError'

jest.mock('../../utils/cache', () => ({
    invalidateUserRecommendations: jest.fn(),
}))

function makeService(overrides: {
    applied?: boolean
    movieExists?: boolean
    genreIds?: number[]
    excludedMovieIds?: number[]
    createError?: Error
    excludedError?: Error
} = {}) {
    const feedbackRepo = {
        create: overrides.createError
            ? jest.fn().mockRejectedValue(overrides.createError)
            : jest.fn().mockResolvedValue(overrides.applied ?? true),
        getGenreIds: jest.fn().mockResolvedValue(overrides.genreIds ?? [1, 2]),
        getExcludedMovieIds: overrides.excludedError
            ? jest.fn().mockRejectedValue(overrides.excludedError)
            : jest.fn().mockResolvedValue(overrides.excludedMovieIds ?? []),
    }
    const prefsService = {
        updateGenreAffinity: jest.fn().mockResolvedValue(undefined),
    }
    const movieRepo = {
        findById: jest.fn().mockResolvedValue(overrides.movieExists === false ? null : { id: 7, title: 'Movie' }),
    }

    const service = new RecommendationFeedbackService(
        feedbackRepo as unknown as RecommendationFeedbackRepository,
        prefsService as unknown as UserPreferencesService,
        movieRepo as unknown as MovieRepository,
    )
    return { service, feedbackRepo, prefsService, movieRepo }
}

describe('RecommendationFeedbackService (unit)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('like: suma afinidad en todos los géneros de la película e invalida recs', async () => {
        const { service, prefsService } = makeService({ genreIds: [1, 2] })

        const result = await service.recordFeedback('user-1', { movieId: 7, action: 'like' })

        expect(result).toEqual({ movieId: 7, action: 'like', applied: true })
        expect(prefsService.updateGenreAffinity).toHaveBeenNthCalledWith(1, 'user-1', 1, 1)
        expect(prefsService.updateGenreAffinity).toHaveBeenNthCalledWith(2, 'user-1', 2, 1)
        expect(invalidateUserRecommendations).toHaveBeenCalledWith('user-1')
    })

    test('not_interested: resta afinidad e invalida recs', async () => {
        const { service, prefsService } = makeService({ genreIds: [3] })

        await service.recordFeedback('user-1', { movieId: 7, action: 'not_interested' })

        expect(prefsService.updateGenreAffinity).toHaveBeenCalledWith('user-1', 3, -1.5)
        expect(invalidateUserRecommendations).toHaveBeenCalledWith('user-1')
    })

    test('hide: resta afinidad de forma más suave', async () => {
        const { service, prefsService } = makeService({ genreIds: [3] })

        await service.recordFeedback('user-1', { movieId: 7, action: 'hide' })

        expect(prefsService.updateGenreAffinity).toHaveBeenCalledWith('user-1', 3, -0.5)
    })

    test('view: no toca afinidad ni invalida recs', async () => {
        const { service, prefsService } = makeService()

        const result = await service.recordFeedback('user-1', { movieId: 7, action: 'view' })

        expect(result.applied).toBe(true)
        expect(prefsService.updateGenreAffinity).not.toHaveBeenCalled()
        expect(invalidateUserRecommendations).not.toHaveBeenCalled()
    })

    test('feedback duplicado: no reaplica afinidad ni invalida', async () => {
        const { service, prefsService } = makeService({ applied: false })

        const result = await service.recordFeedback('user-1', { movieId: 7, action: 'like' })

        expect(result).toEqual({ movieId: 7, action: 'like', applied: false })
        expect(prefsService.updateGenreAffinity).not.toHaveBeenCalled()
        expect(invalidateUserRecommendations).not.toHaveBeenCalled()
    })

    test('película inexistente: lanza 404 sin guardar feedback', async () => {
        const { service, feedbackRepo } = makeService({ movieExists: false })

        await expect(service.recordFeedback('user-1', { movieId: 999, action: 'like' }))
            .rejects.toMatchObject({ statusCode: 404 })
        expect(feedbackRepo.create).not.toHaveBeenCalled()
    })

    test('getExcludedMovieIds devuelve solo los not_interested', async () => {
        const { service } = makeService({ excludedMovieIds: [4, 9] })

        await expect(service.getExcludedMovieIds('user-1')).resolves.toEqual([4, 9])
    })

    test('getExcludedMovieIds es fail-open si falla la consulta', async () => {
        const { service } = makeService({ excludedError: new Error('db down') })

        await expect(service.getExcludedMovieIds('user-1')).resolves.toEqual([])
    })

    test('error de escritura se propaga', async () => {
        const { service } = makeService({ createError: new AppError('db error', 500) })

        await expect(service.recordFeedback('user-1', { movieId: 7, action: 'like' }))
            .rejects.toMatchObject({ statusCode: 500 })
    })
})
