import ReviewService from '../../services/reviewService'
import logger from '../../utils/logger'

const reviewRepo = {
    upsert: jest.fn(),
    findByUserAndMovie: jest.fn(),
    findByMovieId: jest.fn(),
    summaryByMovieId: jest.fn(),
    findById: jest.fn(),
}

const movieRepo = {
    findById: jest.fn(),
    conn: { query: jest.fn() },
}

const userPreferencesService = {
    updateGenreAffinity: jest.fn(),
}

const notifier = {
    notifyReviewPublished: jest.fn(),
}

function buildService() {
    return new ReviewService(
        reviewRepo as any,
        movieRepo as any,
        userPreferencesService as any,
        notifier,
    )
}

const reviewRow = {
    id: 7,
    movie_id: 1,
    user_id: 'user-1',
    rating: 4.5,
    comment: 'Excelente',
    created_at: '2026-10-29T10:00:00.000Z',
    updated_at: '2026-10-29T10:00:00.000Z',
}

describe('ReviewService -> notificación (F3)', () => {
    let service: ReviewService

    beforeEach(() => {
        jest.clearAllMocks()
        service = buildService()
        movieRepo.findById.mockResolvedValue({ id: 1, title: 'Inception' })
        movieRepo.conn.query.mockResolvedValue([[]])
        userPreferencesService.updateGenreAffinity.mockResolvedValue(undefined)
        notifier.notifyReviewPublished.mockResolvedValue(undefined)
    })

    test('notifica cuando la review es nueva', async () => {
        reviewRepo.findByUserAndMovie.mockResolvedValue(null)
        reviewRepo.upsert.mockResolvedValue({ review: reviewRow, isNew: true })

        const result = await service.createReview('user-1', 1, { rating: 4.5, comment: 'Excelente' })

        expect(result.isNew).toBe(true)
        expect(notifier.notifyReviewPublished).toHaveBeenCalledWith({
            userId: 'user-1',
            movieId: 1,
            movieTitle: 'Inception',
            reviewId: '7',
        })
    })

    test('no notifica cuando la review se actualiza', async () => {
        reviewRepo.findByUserAndMovie.mockResolvedValue(reviewRow)
        reviewRepo.upsert.mockResolvedValue({ review: reviewRow, isNew: false })

        const result = await service.createReview('user-1', 1, { rating: 4.5, comment: 'Excelente' })

        expect(result.isNew).toBe(false)
        expect(notifier.notifyReviewPublished).not.toHaveBeenCalled()
    })

    test('si la notificación falla, la review se crea igual (best-effort)', async () => {
        reviewRepo.findByUserAndMovie.mockResolvedValue(null)
        reviewRepo.upsert.mockResolvedValue({ review: reviewRow, isNew: true })
        notifier.notifyReviewPublished.mockRejectedValue(new Error('redis caido'))

        const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger as any)

        const result = await service.createReview('user-1', 1, { rating: 4.5, comment: 'Excelente' })

        expect(result.isNew).toBe(true)
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('Error al encolar la notificacion de review'),
        )

        errorSpy.mockRestore()
    })
})