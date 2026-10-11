import { getMeiliClient, getMovieIndex, MOVIE_INDEX_CONFIG } from '../utils/meilisearchClient'
import connection from '../db/connection'
import { Movie } from '../domain/Movie'
import logger from '../utils/logger'

const BATCH_SIZE = 1000

async function reindex(): Promise<void> {
    logger.info('[Reindex] Starting full reindex...')

    const conn = connection
    const client = getMeiliClient()
    const index = getMovieIndex()

    logger.info('[Reindex] Deleting existing index...')
    try {
        await index.delete()
    } catch {
        logger.info('[Reindex] Index did not exist, skipping delete')
    }

    logger.info('[Reindex] Creating index with configuration...')
    await client.createIndex('movies', { primaryKey: 'id' })
    await index.updateSettings(MOVIE_INDEX_CONFIG)

    const [countResult] = await conn.query('SELECT COUNT(*) as total FROM movies') as any
    const totalMovies = countResult[0].total
    logger.info(`[Reindex] Found ${totalMovies} movies in MySQL`)

    let offset = 0
    let indexedCount = 0

    while (offset < totalMovies) {
        const [rows] = await conn.query(
            'SELECT m.id, m.title, m.year, d.director_name as director, m.rating, m.duration, m.plot, m.poster, m.age_rating, GROUP_CONCAT(DISTINCT genre_name ORDER BY genre_name SEPARATOR \', \') AS genres FROM movies m JOIN directors d ON m.id_director = d.director_id JOIN movie_genres mg ON m.id = mg.movie_id JOIN genres g ON mg.genre_id = g.id_genre GROUP BY m.id LIMIT ? OFFSET ?',
            [BATCH_SIZE, offset]
        ) as any

        if (rows.length === 0) break

        const documents = rows.map((row: any) => {
            const movie = Movie.fromRow(row).toResponse()
            return {
                id: movie.id,
                title: movie.title,
                year: movie.year,
                director: movie.director,
                rating: movie.rating,
                plot: movie.plot,
                poster: movie.poster,
                ageRating: movie.ageRating,
                genres: movie.genres,
            }
        })

        await index.addDocuments(documents)
        indexedCount += documents.length
        offset += BATCH_SIZE

        logger.info(`[Reindex] Indexed ${indexedCount}/${totalMovies} movies`)
    }

    logger.info(`[Reindex] Complete! ${indexedCount} movies indexed`)
    await conn.end()
}

reindex()
    .then(() => process.exit(0))
    .catch((error) => {
        logger.error(`[Reindex] Failed: ${error.message}`)
        process.exit(1)
    })
