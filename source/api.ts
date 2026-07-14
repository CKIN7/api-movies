import express from 'express'
import { createMovieRoutes } from './routes/movieRoutes'
import MovieController from './controllers/movieController'
import MovieModel from './models/Movie-mysql'
import AppError from './utils/AppError'
import logger from './utils/logger'
import { requestLogger } from './middleware/requestLogger'
import type { Request, Response, NextFunction } from 'express'
import connection from './db/connection'
import AuditLogModel from './models/AuditLog'

export function createApp(movieModel?: MovieModel) {
    const app = express()

    app.disable('x-powered-by')
    app.use(express.json())
    app.use(requestLogger)
    
    const conn = connection

    const auditLogModel = new AuditLogModel(conn)
    const model = movieModel || new MovieModel(auditLogModel,conn)
    const controller = new MovieController(auditLogModel, model)
    const router = createMovieRoutes(controller)

    app.use('/movies', router)

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        const statusCode = err instanceof AppError ? err.statusCode : 500
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