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
        const [rows] = await connection.promise()
        .query(`SELECT id,title,year,director_name as director,rating,duration,plot,poster,genre_name FROM movies
        JOIN directors AS d ON movies.id_director = d.director_id
        JOIN movie_genres ON movies.id = movie_genres.movie_id 
        JOIN genres ON movie_genres.genre_id = genres.id_genre`);
        
        if(genre){
            const [rows] = await connection.promise()
            .query(`SELECT id,title,year,director_name as director,rating,duration,plot,poster,genre_name FROM movies
            JOIN directors AS d ON movies.id_director = d.director_id
            JOIN movie_genres ON movies.id = movie_genres.movie_id 
            JOIN genres ON movie_genres.genre_id = genres.id_genre`)
            let movieFiltered = rows.filter(movie => movie.genre_name?.toLocaleLowerCase() === genre.toLocaleLowerCase())
            
            return movieFiltered;
        }
        return rows;

        } catch (error) {
        console.error('Error en getMovies:', error.message); // msg para depurar
        throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500);
        }
        
    }

    static async getMovieById(id){

        try {
         const movieId = Number(id)
         const [rows] = await connection.promise()
         .query(`SELECT id,title,year,director_name as director,rating,duration,plot,poster,genre_name FROM movies 
         JOIN directors AS d ON movies.id_director = d.director_id
         JOIN movie_genres ON movies.id = movie_genres.movie_id JOIN genres ON movie_genres.genre_id = genres.id_genre`)
         const movie = rows.find(movie => movie.id === movieId)
         return movie;
         
        } catch (error) {
         console.error('Error en getMovies:', error.message); // msg para depurar
         throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500);
        }
        
    }

    static async createMovie({result}){

        try {

        await connection.promise().beginTransaction();
        // check if director exists in directors table before insert
        const [directorRows] = await connection.promise().query('SELECT director_id FROM directors WHERE director_name = ?', [result.data.director])
        let directorId;
        if(directorRows.length > 0){
            directorId = directorRows[0].director_id
        } else{
            const [directorResult] = await connection.promise().query('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
            directorId = directorResult.insertId;
        }
        
        const {title,year,director,rating,duration,plot,poster} = result.data
        const values = [title, year, rating, duration, plot, poster, directorId]
        const [movieResult] = await connection.promise()
        .query('INSERT INTO movies(title,year,rating,duration,plot,poster, id_director) VALUES(?,?,?,?,?,?,?)',values);
        
        const movieId = movieResult.insertId; //recuperamos y guardamos el id incremental de la DB
        
        // check if genre exists in genres table before insert
        const [genreRows] = await connection.promise().query('SELECT id_genre FROM genres WHERE genre_name = ?', [result.data.genre]);
            console.log(genreRows);
            
        let genreId;
        if (genreRows.length > 0) {
        genreId = genreRows[0].id_genre;
        } else {
        const [genreResult] = await connection.promise().query('INSERT INTO genres(genre_name) VALUES(?)', [result.data.genre])
        genreId = genreResult.insertId;
        }
        
        await connection.promise().query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?, ?)', [movieId, genreId])

        await connection.promise().commit();
        } catch (error) {
            await connection.promise().rollback()
            console.log(error);
            
            throw new AppError('Ocurrio un problema al crear la pelicula', 500);
        }
     

      
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