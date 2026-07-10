import MovieModel from "../models/Movie-mysql";
import AppError from "../utils/AppError";

class MovieService {
    private movieModel: MovieModel

    constructor(movieModels?: MovieModel) { 
        this.movieModel = movieModels || new MovieModel()
    }

    getMovies = async (params: {genre?: string, year?: string, title?: string}) => {
        try {
            return await this.movieModel.getMovies(params)
        } catch (error) {
         console.error('Error en getMovies:', (error as Error).message)
         throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)

        }
    }
}

export default MovieService