import MovieModel from "../models/Movie-mysql";
import AppError from "../utils/AppError";

class MovieService {
    private movieModel: MovieModel

    constructor(movieModels?: MovieModel) { 
        this.movieModel = movieModels || new MovieModel()
    }

    getMovies = async (params: {genre?: string, year?: string, title?: string, sort?: string, order?: string}) => {
        try {
            const {sort, order} = params
            const whiteListSet = new Set<string>(['year', 'rating', 'title']);

            if(sort && !whiteListSet.has(sort)){
            throw new AppError('el valor del parametro es invalido', 400)

            } else{
            return await this.movieModel.getMovies(params)

            }

        } catch (error) {
         // 1. Si el error ya es una instancia de AppError, déjalo pasar sin modificarlo
         if (error instanceof AppError) {
            throw error
         }

         // 2. Si es cualquier otro error inesperado (base de datos, etc.), entonces sí devuelves el 500
            console.error('Error en getMovies:', (error as Error).message)
            throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
    }
}

export default MovieService