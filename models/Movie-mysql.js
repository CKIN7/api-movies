const mysql = require('mysql2');
const crypto = require('crypto');
const AppError = require('../utils/AppError');

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'moviesdb'
})


class MovieModel {
    
    static async getMovies({genre} = {}) {
        try {
        const [rows] = await connection.promise().query('SELECT * FROM movies');
        
        if(genre){
            const [rows] = await connection.promise().query(
            'SELECT title,year,director,rating,duration,plot,poster,genre_name FROM movies JOIN movie_genres ON movies.id = movie_genres.movie_id JOIN genres ON movie_genres.genre_id = genres.id_genre')
            let movieFiltered = rows.filter(movie => movie.genre_name?.toLocaleLowerCase() === genre.toLocaleLowerCase())
            console.log(movieFiltered);
            
            return movieFiltered;
        }
        return rows;

        } catch (error) {
        console.error('Error en getMovies:', error.message); // msg para depurar
        throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500);
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