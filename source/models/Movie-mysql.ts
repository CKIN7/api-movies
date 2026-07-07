import mysql from 'mysql2'
import AppError from '../utils/AppError'

const connection = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: '',
    database: 'moviesdb'
})


class MovieModel {
    
    static async getMovies({genre, year}: {genre?: string, year?: string} = {}) {
        try {
        let query = `
        SELECT m.id, m.title, m.year, d.director_name as director, m.rating, m.duration, m.plot, m.poster,
        GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres 
        FROM movies m
        JOIN directors d ON m.id_director = d.director_id
        JOIN movie_genres mg ON m.id = mg.movie_id 
        JOIN genres g ON mg.genre_id = g.id_genre
        `
        
        const params = []
        const conditions = []
        
        if(year){
          conditions.push('m.year = ?')
          params.push(year)
        }

        if(genre){
            conditions.push(`
               m.id IN (
                    SELECT mg2.movie_id
                    FROM movie_genres mg2
                    JOIN genres g2 ON mg2.genre_id = g2.id_genre
                    WHERE g2.genre_name = ?
                )
              `)
              params.push(genre)
        }

        if(conditions.length > 0){
          query += ' WHERE ' + conditions.join(' AND ')
        }

        query += ` GROUP BY m.id`

        const [rows] = await connection.promise().query(query, params)
        return rows

        } catch (error) {
        console.error('Error en getMovies:', (error as Error).message)
        throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
        
    }

    static async getMovieById(id: string){

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
         `,[movieId])
         return (rows as any[])[0] || null
         
        } catch (error) {
         console.error('Error en getMovies:', (error as Error).message)
         throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
        
    }

    static async createMovie({result}: {result: any}){

        try {

        await connection.promise().beginTransaction()
        const [directorRows] = await connection.promise().query('SELECT director_id FROM directors WHERE director_name = ?', [result.data.director])
        let directorId: number
        if((directorRows as any[]).length > 0){
            directorId = (directorRows as any[])[0].director_id
        } else{
            const [directorResult] = await connection.promise().query('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
            directorId = (directorResult as any).insertId
        }
        
        const {title,year,rating,duration,plot,poster} = result.data
        const values = [title, year, rating, duration, plot, poster, directorId]
        const [movieResult] = await connection.promise()
        .query('INSERT INTO movies(title,year,rating,duration,plot,poster, id_director) VALUES(?,?,?,?,?,?,?)',values)
        
        const movieId = (movieResult as any).insertId
        
        const genres = result.data.genre

        for (const genreName of genres) {
            const [genreRows] = await connection.promise().query(
                'SELECT id_genre FROM genres WHERE genre_name = ?',
                [genreName]
            )
            
        let genreId: number
        if ((genreRows as any[]).length > 0) {
        genreId = (genreRows as any[])[0].id_genre
        } else {
        const [genreResult] = await connection.promise().query('INSERT INTO genres(genre_name) VALUES(?)', [genreName])
        genreId = (genreResult as any).insertId
        }
        
        await connection.promise().query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?, ?)', [movieId, genreId])

        }
        await connection.promise().commit()
        } catch (error) {
            await connection.promise().rollback()
            console.log(error)
            
            throw new AppError('Ocurrio un problema al crear la pelicula', 500)
        }
     
    }
    
    static async updateMovie({id, result}: {id: string, result: any}){

        try {
        
         const [rows] = await connection.promise().query('SELECT id FROM movies WHERE id = ?',[id])
         if((rows as any[]).length === 0) return null
          
        await connection.promise().beginTransaction()
          
          if(result.data.director){
              const [directorRows] = await connection.promise().query('SELECT director_id FROM directors WHERE director_name = ?',[result.data.director])
              let director_id: number
              if((directorRows as any[]).length > 0) {
                director_id = (directorRows as any[])[0].director_id
              } else {
                const [directorResult] = await connection.promise().query('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
                director_id = (directorResult as any).insertId
              }
              
              await connection.promise().query('UPDATE movies SET id_director = ? WHERE id = ? ',[director_id,id])

          }

          const fields: string[] = []
          const values: string[] = []

          for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster']) {
              if (result.data[key] !== undefined) {
                fields.push(`${key} = ?`)
                values.push(result.data[key])
              }
            }
              if (fields.length > 0) {
                values.push(id)
                await connection.promise().query(`UPDATE movies SET ${fields.join(', ')} WHERE id = ?`,values)
              }
          

          if(result.data.genre){
            await connection.promise().query('DELETE FROM movie_genres WHERE movie_id = ?', [id])

            for (const genreName of result.data.genre) {
                const [genreRows] = await connection.promise().query('SELECT id_genre FROM genres WHERE genre_name = ?', [genreName])
              
              let genre_id: number
              if((genreRows as any[]).length > 0){
                genre_id = (genreRows as any[])[0].id_genre
              } else{
                const [genreResult] = await connection.promise().query('INSERT INTO genres(genre_name) VALUES(?)',[genreName])
                genre_id = (genreResult as any).insertId
              }

              await connection.promise().query('INSERT INTO movie_genres(movie_id, genre_id) VALUES(?,?)',[id,genre_id])
            }
            
          }
          
          await connection.promise().commit()

          return await MovieModel.getMovieById(id)
          
        } 
        catch (error) {
            await connection.promise().rollback()
            console.log(error)
            
            throw new AppError('Ocurrio un problema al crear la pelicula', 500)
        }

    }

    static async deleteMovie(id: string){
        
        try {
         const [rows] = await connection.promise().query('SELECT id FROM movies WHERE id = ?',[id])
         if ((rows as any[]).length === 0) return null

         await connection.promise().beginTransaction()

         await connection.promise().query('DELETE FROM movie_genres WHERE movie_id = ?', [id])
         await connection.promise().query('DELETE FROM movies WHERE id = ?', [id])

         await connection.promise().commit()
         return true

        } catch (error) {
          await connection.promise().rollback()
          console.log(error)
          throw new AppError('Ocurrio un problema al crear la pelicula', 500)
        }
        
        
    }
}

export default MovieModel
