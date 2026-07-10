import { movieSchema } from '../schemas/movie'
import MovieModel from '../models/Movie-mysql'
import type { Request, Response } from 'express'
import MovieService from '../services/movieService'

class MovieController {
    private movieModel: MovieModel
    private movieService: MovieService

    constructor(movieModel?: MovieModel) {
        this.movieModel = movieModel || new MovieModel()
        this.movieService = new MovieService(this.movieModel)
    }

    getAll = async (req: Request, resp: Response) => {
    console.log('----Nueva request')
    console.log(req.method)
    console.log(req.url)
    console.log('------------------')

    const { genre, year, title } = req.query as { genre?: string, year?: string, title?: string }

    const movieFiltered = await this.movieService.getMovies({genre, year, title})

    resp.json(movieFiltered)
}

    getById = async (req: Request, resp: Response) => {
    
    const {id}  = req.params as { id: string }
    const movie = await this.movieModel.getMovieById(id)

    if (!movie) {
        return resp.status(404).json({ error: 'Pelicula no encontrada' })
    }

    resp.send(movie)

} 

    createMovie = async (req: Request, resp: Response) => { 

    const result = movieSchema.safeParse(req.body)
    console.log(req.body)
    
    if (result.error) {
        return resp.status(400).json({ error: result.error.message })
    }

    const newMovie = await this.movieModel.createMovie({result})

    resp.status(201).json({
        message: 'Pelicula creada con exito',
        data: newMovie
    })
}

    updateMovie = async (req: Request, resp: Response) => {
        const { id } = req.params as { id: string }

    const result = movieSchema.partial().safeParse(req.body)
    if (result.error) {
        return resp.status(400).json({ message: result.error.message })
    }
    
    const updateMovie = await this.movieModel.updateMovie({id, result})
    console.log(updateMovie)
    
    if(!updateMovie){
    return resp.status(404).json({ message: 'Pelicula no encontrada' })
    }
    
    resp.status(200).json({ message: 'Pelicula actualizada con exito PATCH', movie: updateMovie })
    }

    deleteMovie = async (req: Request, resp: Response) => {
        const { id } = req.params as { id: string }

    const movie = await this.movieModel.deleteMovie(id)
    if(!movie){
        return resp.status(404).json({ message: 'Pelicula no encontrada desde delete' })
    }


    resp.status(200).json({ message: 'Pelicula borrada con exito' })
    }
    
}

export default MovieController