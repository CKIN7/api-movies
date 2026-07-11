import mysql from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export async function setupTestDb(): Promise<Connection> {
    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER || process.env.DB_user,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306
    })

    return conn
}

export async function teardownTestDb(conn: Connection): Promise<void> {
    await conn.end()
}

export async function clearTestData(conn: Connection): Promise<void> {
    await conn.execute('DELETE FROM movie_genres')
    await conn.execute('DELETE FROM movies')
    await conn.execute('DELETE FROM directors')
    await conn.execute('DELETE FROM genres')
    await conn.execute('ALTER TABLE directors AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE genres AUTO_INCREMENT = 1')
    await conn.execute('ALTER TABLE movies AUTO_INCREMENT = 1')
}

export async function seedTestData(conn: Connection): Promise<void> {
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (1, 'Christopher Nolan')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (2, 'Frank Darabont')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (3, 'Quentin Tarantino')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (4, 'Tim Burton')`)
    await conn.execute(`INSERT INTO directors (director_id, director_name) VALUES (5, 'Alex Proyas')`)

    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (1, 'action')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (2, 'sci-fi')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (3, 'drama')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (4, 'crime')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (5, 'horror')`)
    await conn.execute(`INSERT INTO genres (id_genre, genre_name) VALUES (6, 'noir')`)

    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (1, 'Inception', 2010, 8.8, 148, 'A thief who steals corporate secrets through dream-sharing.', 'https://example.com/inception.jpg', 1)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (2, 'The Dark Knight', 2008, 9.0, 152, 'When the menace known as the Joker wreaks havoc.', 'https://example.com/darkknight.jpg', 1)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (3, 'Interstellar', 2014, 8.6, 169, 'A team of explorers travel through a wormhole.', 'https://example.com/interstellar.jpg', 1)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (4, 'The Shawshank Redemption', 1994, 9.3, 142, 'Two imprisoned men bond over a number of years.', 'https://example.com/shawshank.jpg', 2)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (5, 'Pulp Fiction', 1994, 8.9, 154, 'The lives of two mob hitmen.', 'https://example.com/pulpfiction.jpg', 3)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (6, 'Dark Shadows', 1994, 7.0, 113, 'An immortal vampire returns to his manor.', 'https://example.com/darkshadows.jpg', 4)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (7, 'Dark City', 1998, 7.6, 100, 'A man struggles with memories of his past.', 'https://example.com/darkcity.jpg', 5)`)
    await conn.execute(`INSERT INTO movies (id, title, year, rating, duration, plot, poster, id_director) VALUES (8, 'The Dark Knight Rises', 2012, 8.4, 165, 'Eight years after the Joker, Batman faces Bane.', 'https://example.com/darkknightrises.jpg', 1)`)

    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (1, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (2, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (3, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (4, 3)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (5, 4)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (6, 3)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (6, 5)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (7, 2)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (7, 6)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (8, 1)`)
    await conn.execute(`INSERT INTO movie_genres (movie_id, genre_id) VALUES (8, 3)`)
}