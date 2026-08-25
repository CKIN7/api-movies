import MovieRepository from "../repositories/MovieRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class ReviewService {
    constructor(
        private reviewRepository: ReviewRepository,
        private movieRepository: MovieRepository
    ) {}

    async getReviews(movieId: number, page: number, limit: number){
        try {
            const movie = await this.movieRepository.findById(movieId)
            if(!movie) throw new AppError('Pelicula no existe', 400);

            const review = await this.reviewRepository.findByMovieId({movie, page, limit})
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getReviews: ${(error as Error).message}`)
            throw new AppError('Error al obtener reviews', 500)
        }
    } 
}

export default ReviewService