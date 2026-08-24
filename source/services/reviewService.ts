import MovieRepository from "../repositories/MovieRepository";
import ReviewRepository from "../repositories/ReviewRepository";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class ReviewService {
    constructor(
        private reviewRepository: ReviewRepository,
        private movieRepository: MovieRepository
    ) {}

    async getReviews(params){
        try {
            const movieId = await this.movieRepository.findById(params.id)
            if(!movieId) throw new AppError('Pelicula no existe', 400);

            const review = await this.reviewRepository.findByMovieId({movieId, params.page, params.limit})
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getReviews: ${(error as Error).message}`)
            throw new AppError('Error al obtener reviews', 500)
        }
    } 
}

export default ReviewService