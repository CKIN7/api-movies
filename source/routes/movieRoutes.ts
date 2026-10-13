import express from 'express'
import MovieController from '../controllers/movieController'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

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
    router.get('/:id/audit-log', requireAuth, requireRole('admin'), controller.getAuditLog)
    router.post('/', requireAuth, requireRole('admin'), controller.createMovie)
    router.patch('/:id', requireAuth, requireRole('admin'), controller.updateMovie)
    router.delete('/:id', requireAuth, requireRole('admin'), controller.deleteMovie)
    return router
}