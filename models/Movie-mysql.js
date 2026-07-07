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
        const query = `
        SELECT id,title,year,director_name as director,rating,duration,plot,poster,
        GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres FROM movies
        JOIN directors AS d ON movies.id_director = d.director_id
        JOIN movie_genres ON movies.id = movie_genres.movie_id 
        JOIN genres ON movie_genres.genre_id = genres.id_genre
        GROUP BY movies.id`           
        const [rows] = await connection.promise()
        .query(query);
        
        if(genre){
            const [rows] = await connection.promise()
            .query(query);
            const movieFiltered = rows.filter(movie => movie.genres?.toLocaleLowerCase().includes(genre.toLocaleLowerCase())
            );
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
         .query(`SELECT id,title,year,director_name as director,rating,duration,plot,poster,
         GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres 
         FROM movies 
         JOIN directors AS d ON movies.id_director = d.director_id
         JOIN movie_genres ON movies.id = movie_genres.movie_id 
         JOIN genres g ON movie_genres.genre_id = g.id_genre
         WHERE movies.id = ?
         GROUP BY movies.id
         `,[movieId]);
         return rows[0] || null;
         
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
        const genres = result.data.genre //now is an array

        for (const genreName of genres) {
            const [genreRows] = await connection.promise().query(
                'SELECT id_genre FROM genres WHERE genre_name = ?',
                [genreName]
            );
            
        let genreId;
        if (genreRows.length > 0) {
        genreId = genreRows[0].id_genre;
        } else {
        const [genreResult] = await connection.promise().query('INSERT INTO genres(genre_name) VALUES(?)', [genreName]);
        genreId = genreResult.insertId;
        }
        
        await connection.promise().query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?, ?)', [movieId, genreId]);

        }
        await connection.promise().commit();
        } catch (error) {
            await connection.promise().rollback()
            console.log(error);
            
            throw new AppError('Ocurrio un problema al crear la pelicula', 500);
        }
     

      
    }
    
    static async updateMovie({id, result}){

        try {
        
         const [rows] = await connection.promise().query('SELECT id FROM movies WHERE id = ?',[id]);
         if(rows.length === 0) return null
          
        await connection.promise().beginTransaction()
          
          // Actualizar director si viene
          if(result.data.director){
              // check if director exists in directors table before update
              const [directorRows] = await connection.promise().query('SELECT director_id FROM directors WHERE director_name = ?',[result.data.director])
              let director_id;
              if(directorRows.length > 0) {
                director_id = directorRows[0].director_id
              } else {
                const [directorResult] = await connection.promise().query('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
                director_id = directorResult.insertId;
              }
              
              await connection.promise().query('UPDATE movies SET id_director = ? WHERE id = ? ',[director_id,id])

          }

          //Actualizar campos basicos
          const fields = [];
          const values = [];

          for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster']) {
              if (result.data[key] !== undefined) {
                fields.push(`${key} = ?`)
                values.push(result.data[key])
              }
            }
              if (fields.length > 0) {
                values.push(id);
                await connection.promise().query(`UPDATE movies SET ${fields.join(', ')} WHERE id = ?`,values)
              }
          

          if(result.data.genre){
            await connection.promise().query('DELETE FROM movie_genres WHERE movie_id = ?', [id])

            for (const genreName of result.data.genre) {
                const [genreRows] = await connection.promise().query('SELECT id_genre FROM genres WHERE genre_name = ?', [genreName]);
              
              let genre_id;
              if(genreRows.length > 0){
                genre_id = genreRows[0].id_genre;
              } else{
                const [genreResult] = await connection.promise().query('INSERT INTO genres(genre_name) VALUES(?)',[genreName]);
                genre_id = genreResult.insertId;
              }

              await connection.promise().query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?,?)',[id,genre_id]);
            }

            
          }
          
          await connection.promise().commit();

          return await MovieModel.getMovieById(id);
          
        } 
        catch (error) {
            await connection.promise().rollback()
            console.log(error);
            
            throw new AppError('Ocurrio un problema al crear la pelicula', 500);
        }


    }

    static async deleteMovie(id){
        const movieIndex = data.movies.findIndex(movie => movie.id === parseInt(id))
        if(movieIndex === -1) return null

        data.movies.splice(movieIndex, 1)
        return true
    }
}

module.exports = MovieModel