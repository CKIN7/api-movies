const { movieSchema } = require('../schemas/movie');
// const MovieModel = require('../models/Movie');
const MovieModel = require('../models/Movie-mysql');

class MovieController {
    static async getAll (req, resp)  {
    console.log('----Nueva request');
    console.log(req.method);
    console.log(req.url);
    console.log('------------------');

    const { genre } = req.query;

    let movieFiltered = await MovieModel.getMovies({genre})

    resp.json(movieFiltered)
}

    static async getById(req, resp)  {
   
    const {id}  = req.params
    const movie = await MovieModel.getMovieById(id);

    if (!movie) {
        return resp.status(404).json({ error: 'Pelicula no encontrada' })
    }

    resp.send(movie)

} 

    static async createMovie(req, resp){ 

    const result = movieSchema.safeParse(req.body)
    console.log(req.body);
    
    if (result.error) {
        return resp.status(400).json({ error: result.error.message })
    }

    const newMovie = await MovieModel.createMovie({result})

    resp.status(201).json({
        message: 'Pelicula creada con exito',
        data: newMovie
    })
}

    static async updateMovie(req, resp){
        const { id } = req.params;

    const result = movieSchema.partial().safeParse(req.body)
    if (result.error) {
        return resp.status(400).json({ message: result.error.message })
    }
    
    const updateMovie = await MovieModel.updateMovie({id, result})
    console.log(updateMovie);
    
    if(!updateMovie){
    return resp.status(404).json({ message: 'Pelicula no encontrada' })

    }
    
    resp.status(200).json({ message: 'Pelicula actualizada con exito PATCH', movie: updateMovie })
    }

    static async deleteMovie(req,resp) {
        const { id } = req.params

    const movie = await MovieModel.deleteMovie(id);
    if(!movie){
        return resp.status(404).json({ message: 'Pelicula no encontrada desde delete' })
    }


    resp.status(200).json({ message: 'Pelicula borrada con exito' })
    }
    
}

module.exports = MovieController;