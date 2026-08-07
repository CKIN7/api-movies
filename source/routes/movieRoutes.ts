import express from 'express'
import MovieController from '../controllers/movieController'
import { requireAuth } from '../middleware/requireAuth'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method
// ═══════════════════════════════════════════════════════════════
//  createMovieRoutes() es una función factory que recibe un
//  controller ya inyectado y devuelve un router de Express
//  completamente configurado.
// ═══════════════════════════════════════════════════════════════

export function createMovieRoutes(controller: MovieController) {
    const router = express.Router()
    router.get('/', controller.getAll)
    router.get('/random', controller.getRandom)
    router.get('/genres', controller.getGenres)
    router.get('/suggest', controller.getSuggest)
    router.get('/:id', controller.getById)
    router.get('/:id/similar', controller.getSimilar)
    router.get('/:id/audit-log', controller.getAuditLog)
    router.post('/', requireAuth, controller.createMovie)
    router.patch('/:id', requireAuth, controller.updateMovie)
    router.delete('/:id', requireAuth, controller.deleteMovie)
    return router
}