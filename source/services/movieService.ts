import MovieModel from "../models/Movie-mysql";
import { MovieInput } from "../types/movie";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class MovieService {
    private movieModel: MovieModel

    constructor(movieModels?: MovieModel) { 
        this.movieModel = movieModels || new MovieModel()
    }

    getMovies = async (params: {genre?: string, year?: string, title?: string, sort?: string, order?: string}) => {
        try {

            if(params.sort !== undefined && typeof params.sort !== "string"){
                throw new AppError('No se permiten parámetros duplicados en "sort"',400)
            }

            if(params.order !== undefined && typeof params.order !== "string"){
                throw new AppError('No se permiten parámetros duplicados en "order"',400)
            }

            const sort = params.sort?.toLowerCase();
            let order = params.order?.toLowerCase();
            
            const whiteListSet = new Set<string>(['year', 'rating', 'title']);
            const allowedOrders = new Set(['asc', 'desc'])
            
            if(sort && !whiteListSet.has(sort)){
            throw new AppError('el valor del parametro sort es invalido', 400)
            }
            
            if(order && !allowedOrders.has(order)){
              throw new AppError('el valor del parametro order es invalido', 400)
            }

            if(sort && !order){
                order = 'asc'
            }

            const normalizedParams = {
                ...params,
                order
            }
            
            return await this.movieModel.getMovies(normalizedParams)

        } catch (error) {
         // 1. Si el error ya es una instancia de AppError, déjalo pasar sin modificarlo
         if (error instanceof AppError) {
            throw error
         }

         // 2. Si es cualquier otro error inesperado (base de datos, etc.), entonces sí devuelves el 500
            logger.error(`Error en getMovies: ${(error as Error).message}`)
            throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
    }

    createMovie = async (inputData: MovieInput) => {

        try {
            
        

        return await this.movieModel.createMovie({ result: { data: inputData } })

        } catch (error) {
            if(error instanceof AppError){
                throw error
            }

            logger.error(`Error en createMovie: ${(error as Error).message}`)
            throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
    }
}

export default MovieService