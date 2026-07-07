import _data from '../movies.json'
import crypto from 'crypto'
import { MovieRecord, MoviesData, MovieInput } from '../types/movie'

const data = _data as MoviesData

class MovieModel {
    static async getMovies({genre}: {genre?: string} = {}) {
        let movieFiltered = data.movies

        if (genre) {
        movieFiltered = data.movies.filter((movie: MovieRecord) => movie.genre.toLocaleLowerCase() === genre.toLocaleLowerCase())
        return movieFiltered
        }
        return movieFiltered
    }

    static async getMovieById(id: string) {
        const movieId = Number(id)

        const movie = data.movies.find((movie: MovieRecord) => movie.id === movieId)

        return movie
    }

    static async createMovie({result}: {result: { data: MovieInput }}) {

      const newMovie = {
        ...result.data,
        id: crypto.randomUUID() }

    data.movies.push(newMovie as unknown as MovieRecord)
    
    return newMovie
    }

    static async updateMovie({id, result}: {id: string, result: { data: Partial<MovieInput> }}){
        const movieIndex = data.movies.findIndex((movie: MovieRecord) => movie.id === parseInt(id))
        if(movieIndex === -1) return null
        
       const updateMovie = {
        ...data.movies[movieIndex],
        ...result.data }
        data.movies[movieIndex] = updateMovie as MovieRecord
        return updateMovie
    }

    static async deleteMovie(id: string){
        const movieIndex = data.movies.findIndex((movie: MovieRecord) => movie.id === parseInt(id))
        if(movieIndex === -1) return null

        data.movies.splice(movieIndex, 1)
        return true
    }
}

export default MovieModel
