import express from 'express'
import { createMovieRoutes } from './routes/movieRoutes'
import MovieController from './controllers/movieController'
import MovieService from './services/movieService'
import MovieRepository from './repositories/MovieRepository'
import DirectorRepository from './repositories/DirectorRepository'
import GenreRepository from './repositories/GenreRepository'
import AuditLogRepository from './repositories/AuditLogRepository'
import CastRepository from './repositories/CastRepository'
import AppError from './utils/AppError'
import { ZodError } from 'zod'
import logger from './utils/logger'
import { requestLogger } from './middleware/requestLogger'
import type { Request, Response, NextFunction } from 'express'
import connection from './db/connection'

export function createApp(movieService?: MovieService) {
    const app = express()

    app.disable('x-powered-by')
    app.use(express.json())
    app.use(requestLogger)

    const conn = connection

    const movieRepo = new MovieRepository(conn)
    const directorRepo = new DirectorRepository(conn)
    const genreRepo = new GenreRepository(conn)
    const auditRepo = new AuditLogRepository(conn)
    const castRepo = new CastRepository(conn)
    const _service = movieService || new MovieService(movieRepo, directorRepo, genreRepo, auditRepo, castRepo)
    const controller = new MovieController(_service)
    const router = createMovieRoutes(controller)

    app.use('/movies', router)

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        const statusCode = err instanceof AppError ? err.statusCode : err instanceof ZodError ? 400 : 500
        logger.error(`Error handler: ${err.message}`, { statusCode, stack: err.stack })
        res.status(statusCode).json({ error: err.message })
    })

    app.use((req: Request, resp: Response) => {
        resp.status(404).send('Ruta no encontrada')
    })

    return app
}

if (require.main === module) {
    const app = createApp()
    const PORT = 8089
    app.listen(PORT, () => {
        logger.info(`Servidor escuchando en http://localhost:${PORT}`)
    })
}
