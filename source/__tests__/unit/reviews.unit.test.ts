import { createApp } from '../../api'
import ReviewService from '../../services/reviewService'
import ReviewRepository from '../../repositories/ReviewRepository'
import MovieRepository from '../../repositories/MovieRepository'
import type { CreateReviewDTO, UpdateReviewDTO } from '../../types/review'
import type { ReviewRow, ReviewsSummary, CreateReviewResult } from '../../types/review'

// Create mock functions first (without casting)
const mockMovieRepo = {
    findById: jest.fn(),
}

const mockReviewRepo = {
    upsert: jest.fn(),
    findByMovieId: jest.fn(),
    summaryByMovieId: jest.fn(),
    findByUserAndMovie: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
}

// Setup mock implementations
mockMovieRepo.findById.mockResolvedValue({ id: 1 })

mockReviewRepo.upsert.mockResolvedValue({
    review: { id: 1, movieId: 1, userId: 'user-123', rating: 4.5, comment: 'Excelente', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' },
    isNew: true,
})

mockReviewRepo.findByMovieId.mockResolvedValue([
    { id: 1, movieId: 1, userId: 'u1', rating: 4.5, comment: 'Genial', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'u1@test.com' },
])

mockReviewRepo.summaryByMovieId.mockResolvedValue({ average: 4.5, count: 1 })

mockReviewRepo.findByUserAndMovie.mockResolvedValue({ id: 1, movieId: 1, userId: 'user-123', rating: 4.5, comment: 'Buena', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' })

mockReviewRepo.findById.mockResolvedValue({ id: 1, movieId: 1, userId: 'user-123', rating: 4.5, comment: 'Buena', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' })

mockReviewRepo.update.mockResolvedValue({ id: 1, movieId: 1, userId: 'user-123', rating: 5, comment: 'Actualizada', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' })

mockReviewRepo.delete.mockResolvedValue(true)

// Create service with mocks (cast to repository types after setting up mocks)
const mockMovieRepoTyped = mockMovieRepo as unknown as MovieRepository
const mockReviewRepoTyped = mockReviewRepo as unknown as ReviewRepository

const mockReviewService = new ReviewService(mockReviewRepoTyped, mockMovieRepoTyped)

const mockApp = createApp(mockReviewService as any)

describe('ReviewService (unit)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    describe('createReview', () => {
        const dto = { rating: 4.5, comment: 'Excelente' }
        const userId = 'user-123'
        const movieId = 1

        test('debe crear review nueva y devolver isNew=true', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce({ id: movieId })
            mockReviewRepo.upsert.mockResolvedValueOnce({
                review: { id: 1, movieId, userId, rating: 4.5, comment: 'Excelente', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' },
                isNew: true,
            })

            const result = await mockReviewService.createReview(userId, movieId, dto)

            expect(result.isNew).toBe(true)
            expect(result.review.rating).toBe(4.5)
            expect(result.review.comment).toBe('Excelente')
        })

        test('debe hacer upsert y devolver isNew=false si review ya existe', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce({ id: movieId })
            mockReviewRepo.upsert.mockResolvedValueOnce({
                review: { id: 1, movieId, userId, rating: 5, comment: 'Actualizada', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' },
                isNew: false,
            })

            const result = await mockReviewService.createReview(userId, movieId, { rating: 5, comment: 'Actualizada' })

            expect(result.isNew).toBe(false)
            expect(result.review.rating).toBe(5)
        })

        test('debe lanzar 404 si película no existe', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce(null)

            await expect(mockReviewService.createReview(userId, 999, dto)).rejects.toThrow('Película no encontrada')
        })
    })

    describe('getReviews', () => {
        const movieId = 1
        const page = 1
        const limit = 10

        test('debe devolver reviews paginadas con summary', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce({ id: movieId })
            mockReviewRepo.findByMovieId.mockResolvedValueOnce([
                { id: 1, movieId, userId: 'u1', rating: 4.5, comment: 'Genial', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'u1@test.com' },
            ])
            mockReviewRepo.summaryByMovieId.mockResolvedValueOnce({ average: 4.5, count: 1 })

            const result = await mockReviewService.getReviews(movieId, page, limit)

            expect(result.data).toHaveLength(1)
            expect(result.meta.total).toBe(1)
            expect(result.summary.average).toBe(4.5)
            expect(result.summary.count).toBe(1)
        })

        test('debe lanzar 404 si película no existe', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce(null)

            await expect(mockReviewService.getReviews(999, 1, 10)).rejects.toThrow('Película no encontrada')
        })
    })

    describe('getMyReview', () => {
        const userId = 'user-123'
        const movieId = 1

        test('debe devolver review del usuario', async () => {
            const review = { id: 1, movieId, userId, rating: 4.5, comment: 'Buena', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' }
            mockMovieRepo.findById.mockResolvedValueOnce({ id: movieId })
            mockReviewRepo.findByUserAndMovie.mockResolvedValueOnce(review)

            const result = await mockReviewService.getMyReview(userId, movieId)

            expect(result).toEqual(review)
        })

        test('debe devolver null si no tiene review', async () => {
            mockMovieRepo.findById.mockResolvedValueOnce({ id: movieId })
            mockReviewRepo.findByUserAndMovie.mockResolvedValueOnce(null)

            const result = await mockReviewService.getMyReview(userId, movieId)

            expect(result).toBeNull()
        })
    })

    describe('updateMyReview', () => {
        const userId = 'user-123'
        const movieId = 1

        test('debe actualizar review existente', async () => {
            const updatedReview = { id: 1, movieId, userId, rating: 5, comment: 'Actualizada', createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), email: 'user@test.com' }
            mockReviewRepo.update.mockResolvedValueOnce(updatedReview)

            const result = await mockReviewService.updateMyReview(userId, movieId, { rating: 5 })

            expect(result.rating).toBe(5)
        })

        test('debe lanzar 400 si body vacío', async () => {
            await expect(mockReviewService.updateMyReview(userId, movieId, {})).rejects.toThrow('No hay campos para actualizar')
        })

        test('debe lanzar 404 si review no existe', async () => {
            mockReviewRepo.update.mockResolvedValueOnce(null)

            await expect(mockReviewService.updateMyReview(userId, movieId, { rating: 5 })).rejects.toThrow('Reseña no encontrada')
        })
    })

    describe('deleteMyReview', () => {
        const userId = 'user-123'
        const movieId = 1

        test('debe eliminar review existente', async () => {
            mockReviewRepo.delete.mockResolvedValueOnce(true)

            await expect(mockReviewService.deleteMyReview(userId, movieId)).resolves.not.toThrow()
        })

        test('debe lanzar 404 si review no existe', async () => {
            mockReviewRepo.delete.mockResolvedValueOnce(false)

            await expect(mockReviewService.deleteMyReview(userId, movieId)).rejects.toThrow('Reseña no encontrada')
        })
    })
})