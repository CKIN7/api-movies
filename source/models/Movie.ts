import data from '../movies.json'
import crypto from 'crypto'

class MovieModel {
    static async getMovies({genre}: {genre?: string} = {}) {
        let movieFiltered = await data.movies

        if (genre) {
        movieFiltered = await data.movies.filter((movie: any) => movie.genre.toLocaleLowerCase() === genre.toLocaleLowerCase())
        return movieFiltered
        }
        return movieFiltered
    }

    static async getMovieById(id: string) {
        const movieId = Number(id)

        const movie = data.movies.find((movie: any) => movie.id === movieId)

        return movie
    }

    static async createMovie({result}: {result: any}) {

      const newMovie = {
        ...result.data,
        id: crypto.randomUUID() }

    data.movies.push(newMovie)
    
    return newMovie
    }

    static async updateMovie({id, result}: {id: string, result: any}){
        const movieIndex = data.movies.findIndex((movie: any) => movie.id === parseInt(id))
        if(movieIndex === -1) return null
        
       const updateMovie = {
        ...data.movies[movieIndex],
        ...result.data }
        data.movies[movieIndex] = updateMovie
        return updateMovie
    }

    static async deleteMovie(id: string){
        const movieIndex = data.movies.findIndex((movie: any) => movie.id === parseInt(id))
        if(movieIndex === -1) return null

        data.movies.splice(movieIndex, 1)
        return true
    }
}

export default MovieModel
