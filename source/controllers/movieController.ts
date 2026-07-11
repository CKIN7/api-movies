import { movieSchema } from '../schemas/movie'
// import MovieModel from '../models/Movie'
import MovieModel from '../models/Movie-mysql'
import type { Request, Response } from 'express'

class MovieController {
    static async getAll (req: Request, resp: Response)  {
    console.log('----Nueva request')
    console.log(req.method)
    console.log(req.url)
    console.log('------------------')

    const { genre, year } = req.query as { genre?: string, year?: string }

    let movieFiltered = await MovieModel.getMovies({genre, year})

    resp.json(movieFiltered)
}

    static async getById(req: Request, resp: Response)  {
    
    const {id}  = req.params as { id: string }
    const movie = await MovieModel.getMovieById(id)

    if (!movie) {
        return resp.status(404).json({ error: 'Pelicula no encontrada' })
    }

    resp.send(movie)

} 

    static async createMovie(req: Request, resp: Response){ 

    const result = movieSchema.safeParse(req.body)
    console.log(req.body)
    
    if (result.error) {
        return resp.status(400).json({ error: result.error.message })
    }

    const newMovie = await MovieModel.createMovie({result})

    resp.status(201).json({
        message: 'Pelicula creada con exito',
        data: newMovie
    })
}

    static async updateMovie(req: Request, resp: Response){
        const { id } = req.params as { id: string }

    const result = movieSchema.partial().safeParse(req.body)
    if (result.error) {
        return resp.status(400).json({ message: result.error.message })
    }
    
    const updateMovie = await MovieModel.updateMovie({id, result})
    console.log(updateMovie)
    
    if(!updateMovie){
    return resp.status(404).json({ message: 'Pelicula no encontrada' })
    }
    
    resp.status(200).json({ message: 'Pelicula actualizada con exito PATCH', movie: updateMovie })
    }

    static async deleteMovie(req: Request, resp: Response) {
        const { id } = req.params as { id: string }

    const movie = await MovieModel.deleteMovie(id)
    if(!movie){
        return resp.status(404).json({ message: 'Pelicula no encontrada desde delete' })
    }


    resp.status(200).json({ message: 'Pelicula borrada con exito' })
    }
    
}

export default MovieController
