import MovieRepository from "../repositories/MovieRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class ReviewService {
    constructor(
        private reviewRepository: ReviewRepository,
        private movieRepository: MovieRepository
    ) {}

    async getReviews(dto){
        try {
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getReviews: ${(error as Error).message}`)
            throw new AppError('Error al obtener reviews', 500)
        }
    } 
}

export default ReviewService