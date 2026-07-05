const mysql = require('mysql2');
const crypto = require('crypto');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'moviesdb'
})


class MovieModel {
    
    static async getMovies({genre} = {}) {
        try {
        const [rows] = await connection.promise().query('SELECT d* FROM movies');
        console.log(rows)
        // if (genre) {
        // movieFiltered = await data.movies.filter(movie => movie.genre.toLocaleLowerCase() === genre.toLocaleLowerCase())
        // return movieFiltered;
        // }
        // return movieFiltered;
        } catch (error) {
        console.error('Error en getMovies:', error.message);
        throw new Error('Error al obtener películas');
error.statusCode = 500;
throw error;
        }
        
    }

    static async getMovieById(id){
        const movieId = Number(id)

        const movie = data.movies.find(movie => movie.id === movieId);

        return movie;
    }

    static async createMovie({result}){

      const newMovie = {
        ...result.data,
        id: crypto.randomUUID() }

    data.movies.push(newMovie);
    
    return newMovie
    }

    static async updateMovie({id, result}){
        const movieIndex = data.movies.findIndex(movie => movie.id === parseInt(id))
        if(movieIndex === -1) return null
        
       const updateMovie = {
        ...data.movies[movieIndex],
        ...result.data }
        data.movies[movieIndex] = updateMovie;
        return updateMovie

    }

    static async deleteMovie(id){
        const movieIndex = data.movies.findIndex(movie => movie.id === parseInt(id))
        if(movieIndex === -1) return null

        data.movies.splice(movieIndex, 1)
        return true
    }
}

module.exports = MovieModel