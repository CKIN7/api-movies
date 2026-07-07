import express from 'express'
import moviesRouter from './routes/movieRoutes'
import AppError from './utils/AppError'
import type { Request, Response, NextFunction } from 'express'

const app = express()

app.disable('x-powered-by')
app.use(express.json())

app.use('/movies', moviesRouter)

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
    const statusCode = err instanceof AppError ? err.statusCode : 500
    res.status(statusCode).json({ error: err.message })
})

app.use((req: Request, resp: Response) => {
    resp.status(404).send('Ruta no encontrada')
})

const PORT = 8089
app.listen(PORT, () => {
    console.log('Servidor escuchando en http://localhost:', PORT)
})
