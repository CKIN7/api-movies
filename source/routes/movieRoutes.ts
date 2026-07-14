import express from 'express'
import MovieController from '../controllers/movieController'

export function createMovieRoutes(controller: MovieController) {
    const router = express.Router()
    router.get('/', controller.getAll)
    router.get('/:id', controller.getById)
    router.get('/:id/audit-log', controller.getAuditLog)
    router.post('/', controller.createMovie)
    router.patch('/:id', controller.updateMovie)
    router.delete('/:id', controller.deleteMovie)
    return router
}