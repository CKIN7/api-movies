import MovieRepository from "../repositories/MovieRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import AppError from "../utils/AppError";
import logger from "../utils/logger";
import type { CreateReviewDTO, CreateReviewResult, PaginatedReviewsResponse } from '../types/review';
import { Review } from "../domain/Review";


class ReviewService {
    constructor(
        private reviewRepository: ReviewRepository,
        private movieRepository: MovieRepository
    ) {}

    async getReviews(movieId: number, page: number, limit: number): Promise<PaginatedReviewsResponse>{
        try {
            const movie = await this.movieRepository.findById(movieId)
            if(!movie) throw new AppError('Pelicula no existe', 400);
            
            const offset = (page - 1) * limit

            // 3. Queries paralelas (listado + summary)
            const [reviews, summary] = await Promise.all([
                this.reviewRepository.findByMovieId(movieId, limit, offset),
                this.reviewRepository.summaryByMovieId(movieId)
            ]) 

            const data = reviews.map(r => Review.fromRow(r).toResponse());

            const totalPages = Math.ceil(summary.count / limit);

            return {
                data,
                meta: {total: summary.count, page, limit, totalPages},
                summary
            }

            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getReviews: ${(error as Error).message}`)
            throw new AppError('Error al obtener reviews', 500)
        }
    } 

    async createReview(userId: string, movieId: number, dto: CreateReviewDTO): Promise<CreateReviewResult>{
        try {

            const movie = await this.movieRepository.findById(movieId)
            if(!movie) throw new AppError('Pelicula no existe', 400);
            
            const {review, isNew} = await this.reviewRepository.upsert(userId, movieId, dto)

            return {
                review: Review.fromRow(review).toResponse(),
                isNew
            }

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en createReview: ${(error as Error).message}`)
            throw new AppError('Error al intentar crear una pelicula', 500)
        }
    }
    
    async getMyReview(userId, movieId) {
        try {
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getMyReview: ${(error as Error).message}`)
            throw new AppError('Error al intentar obtener review', 500)
        }
    }
}

export default ReviewService