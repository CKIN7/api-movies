import express from 'express'
import { createMovieRoutes } from './routes/movieRoutes'
import MovieController from './controllers/movieController'
import MovieModel from './models/Movie-mysql'
import AppError from './utils/AppError'
import type { Request, Response, NextFunction } from 'express'

export function createApp(movieModel?: MovieModel) {
    const app = express()

    app.disable('x-powered-by')
    app.use(express.json())

    const model = movieModel || new MovieModel()
    const controller = new MovieController(model)
    const router = createMovieRoutes(controller)

    app.use('/movies', router)

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        const statusCode = err instanceof AppError ? err.statusCode : 500
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
        console.log('Servidor escuchando en http://localhost:', PORT)
    })
}