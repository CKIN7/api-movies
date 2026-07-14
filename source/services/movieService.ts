import AuditLogModel from "../models/AuditLog";
import MovieModel from "../models/Movie-mysql";
import { AuditLogQuery } from "../types/auditLog";
import { GetMoviesParams, MovieInput, MovieRow, PaginatedResponse } from "../types/movie";
import AppError from "../utils/AppError";
import logger from "../utils/logger";

class MovieService {
    private movieModel: MovieModel
    private auditLogModel: AuditLogModel
    
    constructor(auditLogModel: AuditLogModel, movieModels?: MovieModel) { 
        this.movieModel = movieModels || new MovieModel()
        this.auditLogModel = auditLogModel
    }

    getMovies = async (params: GetMoviesParams): Promise<PaginatedResponse<MovieRow[]>> => {
        try {

            if(params.sort !== undefined && typeof params.sort !== "string"){
                throw new AppError('No se permiten parámetros duplicados en "sort"',400)
            }

            if(params.order !== undefined && typeof params.order !== "string"){
                throw new AppError('No se permiten parámetros duplicados en "order"',400)
            }

            if(params.page === "") delete params.page

            if(params.page !== undefined){
                
                if(typeof params.page !== "string"){
                    throw new AppError('No se permiten parámetros duplicados en "page"',400)
                }

                

                const pageNum = Number(params.page)

                if(!Number.isInteger(pageNum) || pageNum < 1){
                    throw new AppError("page debe ser un entero positivo", 400)
                }
                
            }

            if(params.limit === "") delete params.limit

            if (params.limit !== undefined) {
                
                if(typeof params.limit !== "string"){
                    throw new AppError('No se permiten parámetros duplicados en "limit"',400)
                }

                if (params.limit === "") {
                    throw new AppError("limit no puede estar vacío", 400)
                }

                const limitNum = Number(params.limit)

                if(!Number.isInteger(limitNum) || limitNum < 1 || limitNum > 100){
                    throw new AppError("limit debe ser un entero entre 1 y 100", 400)
                }
            }

            const page = params.page !== undefined ? parseInt(params.page, 10) : 1
            const limit = params.limit !== undefined ? parseInt(params.limit, 10) : 10

            const offset = (page - 1) * limit




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
                order,
                limit,
                offset
            }
            
            const result = await this.movieModel.getMovies(normalizedParams)

            const totalPages = Math.ceil(result.total / limit)
            
            return {
                data: result.rows, meta: {total: result.total, page, limit, totalPages}
            }

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

    getAuditLog = async (query: AuditLogQuery) => {
        
        try {
            
            const movie = await this.movieModel.getMovieById(String(query.id));
            if(!movie) throw new AppError('Película no encontrada', 404);

            
            
        } catch (error) {
            
        }
        
    }
}

export default MovieService