import { movieSchema } from '../schemas/movie'
import { movieQuerySchema } from '../schemas/movieQuery'
import { auditLogQuerySchema } from '../schemas/auditLogQuerySchema'
import type { Request, Response } from 'express'
import MovieService from '../services/movieService'
import logger from '../utils/logger'

class MovieController {
    constructor(private movieService: MovieService) {}

    getAll = async (req: Request, resp: Response) => {
        const parsed = movieQuerySchema.parse(req.query)
        const result = await this.movieService.getMovies(parsed)
        resp.json(result)
    }

    getById = async (req: Request, resp: Response) => {
        const id = Number(req.params.id)
        const movie = await this.movieService.getMovieById(id)
        resp.json(movie)
    }

    createMovie = async (req: Request, resp: Response) => {
        const result = movieSchema.safeParse(req.body)
        if (result.error) {
            return resp.status(400).json({ error: result.error.message })
        }

        const newMovie = await this.movieService.createMovie(result.data)
        resp.status(201).json({
            message: 'Pelicula creada con exito',
            data: newMovie
        })
    }

    updateMovie = async (req: Request, resp: Response) => {
        const id = Number(req.params.id)

        const result = movieSchema.partial().safeParse(req.body)
        if (result.error) {
            return resp.status(400).json({ message: result.error.message })
        }

        const movie = await this.movieService.updateMovie(id, result.data)
        logger.info(`Película actualizada: ${id}`, { movie })
        resp.status(200).json({ message: 'Pelicula actualizada con exito', movie })
    }

    deleteMovie = async (req: Request, resp: Response) => {
        const id = Number(req.params.id)
        await this.movieService.deleteMovie(id)
        resp.status(200).json({ message: 'Pelicula borrada con exito' })
    }

    getAuditLog = async (req: Request, resp: Response) => {
        const { id } = req.params
        const { field, page, limit } = req.query

        const parsed = auditLogQuerySchema.safeParse({ id, field, page, limit })

        if (parsed.error) {
            return resp.status(400).json({ error: parsed.error.message })
        }

        const result = await this.movieService.getAuditLog(parsed.data)
        resp.json(result)
    }
}

export default MovieController
