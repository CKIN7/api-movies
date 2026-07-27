import { Movie } from "../domain/Movie";
import MovieRepository from "../repositories/MovieRepository";
import { MovieQueryDTO } from "../schemas/movieQuery";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class ExportService {
    constructor(
        private movieRepository: MovieRepository
    ){}

    async getAll(params: MovieQueryDTO){
        try {
            const result = await this.movieRepository.findMany({...params, page: 1, limit: 999999}, 0)

            return result.rows.map(Movie.fromRow).map(m => m.toResponse())
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en getAll: ${(error as Error).message}`)
            throw new AppError('Error al obtener películas', 500)
        }
    }
}

export default ExportService