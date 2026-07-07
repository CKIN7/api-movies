import mysql from 'mysql2'
import AppError from '../utils/AppError'
import { MovieRow, MovieInput } from '../types/movie'
import type { RowDataPacket, ResultSetHeader } from 'mysql2/promise'

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306
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

        const [rows] = await connection.promise().query<RowDataPacket[]>(query, params)
        return rows as MovieRow[]

        } catch (error) {
        console.error('Error en getMovies:', (error as Error).message)
        throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
        
    }

    static async getMovieById(id: string){

        try {
         const movieId = Number(id)
         const [rows] = await connection.promise()
         .query<RowDataPacket[]>(`SELECT id,title,year,director_name as director,rating,duration,plot,poster,
         GROUP_CONCAT(genre_name ORDER BY genre_name SEPARATOR ', ') AS genres 
         FROM movies 
         JOIN directors AS d ON movies.id_director = d.director_id
         JOIN movie_genres ON movies.id = movie_genres.movie_id 
         JOIN genres g ON movie_genres.genre_id = g.id_genre
         WHERE movies.id = ?
         GROUP BY movies.id
         `,[movieId])
         return (rows as MovieRow[])[0] || null
         
        } catch (error) {
         console.error('Error en getMovies:', (error as Error).message)
         throw new AppError('Pelicula no encontrada (msg personalizado con status code para el cliente)', 500)
        }
        
    }

    static async createMovie({result}: {result: { data: MovieInput }}){

        try {

        await connection.promise().beginTransaction()
        const [directorRows] = await connection.promise().query<RowDataPacket[]>('SELECT director_id FROM directors WHERE director_name = ?', [result.data.director])
        let directorId: number
        if(directorRows.length > 0){
            directorId = directorRows[0].director_id as number
        } else{
            const [directorResult] = await connection.promise().query<ResultSetHeader>('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
            directorId = directorResult.insertId
        }
        
        const {title,year,rating,duration,plot,poster} = result.data
        const values = [title, year, rating, duration, plot, poster, directorId]
        const [movieResult] = await connection.promise()
        .query<ResultSetHeader>('INSERT INTO movies(title,year,rating,duration,plot,poster, id_director) VALUES(?,?,?,?,?,?,?)',values)
        
        const movieId = movieResult.insertId
        
        const genres = result.data.genre

        for (const genreName of genres) {
            const [genreRows] = await connection.promise().query<RowDataPacket[]>(
                'SELECT id_genre FROM genres WHERE genre_name = ?',
                [genreName]
            )
            
        let genreId: number
        if (genreRows.length > 0) {
        genreId = genreRows[0].id_genre as number
        } else {
        const [genreResult] = await connection.promise().query<ResultSetHeader>('INSERT INTO genres(genre_name) VALUES(?)', [genreName])
        genreId = genreResult.insertId
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
    
    static async updateMovie({id, result}: {id: string, result: { data: Partial<MovieInput> }}){

        try {
        
         const [rows] = await connection.promise().query<RowDataPacket[]>('SELECT id FROM movies WHERE id = ?',[id])
         if(rows.length === 0) return null
          
        await connection.promise().beginTransaction()
          
          if(result.data.director){
              const [directorRows] = await connection.promise().query<RowDataPacket[]>('SELECT director_id FROM directors WHERE director_name = ?',[result.data.director])
              let director_id: number
              if(directorRows.length > 0) {
                director_id = directorRows[0].director_id as number
              } else {
                const [directorResult] = await connection.promise().query<ResultSetHeader>('INSERT INTO directors(director_name) VALUES(?)',[result.data.director])
                director_id = directorResult.insertId
              }
              
              await connection.promise().query('UPDATE movies SET id_director = ? WHERE id = ? ',[director_id,id])

          }

          const fields: string[] = []
          const values: string[] = []

          for (const key of ['title', 'year', 'rating', 'duration', 'plot', 'poster']) {
              if ((result.data as Record<string, unknown>)[key] !== undefined) {
                fields.push(`${key} = ?`)
                values.push((result.data as Record<string, unknown>)[key] as string)
              }
            }
              if (fields.length > 0) {
                values.push(id)
                await connection.promise().query(`UPDATE movies SET ${fields.join(', ')} WHERE id = ?`,values)
              }
          

          if(result.data.genre){
            await connection.promise().query('DELETE FROM movie_genres WHERE movie_id = ?', [id])

            for (const genreName of result.data.genre) {
                const [genreRows] = await connection.promise().query<RowDataPacket[]>('SELECT id_genre FROM genres WHERE genre_name = ?', [genreName])
              
              let genre_id: number
              if(genreRows.length > 0){
                genre_id = genreRows[0].id_genre as number
              } else{
                const [genreResult] = await connection.promise().query<ResultSetHeader>('INSERT INTO genres(genre_name) VALUES(?)',[genreName])
                genre_id = genreResult.insertId
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
         const [rows] = await connection.promise().query<RowDataPacket[]>('SELECT id FROM movies WHERE id = ?',[id])
         if (rows.length === 0) return null

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
