import express from 'express'
import UserController from '../controllers/userController'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method
// ═══════════════════════════════════════════════════════════════
//  createUserRoutes() recibe un controller inyectado y devuelve
//  un router de Express para la gestión de usuarios (RBAC).
//  Montado en api.ts bajo /users → PATCH /users/:id/role
// ═══════════════════════════════════════════════════════════════

export function createUserRoutes(controller: UserController) {
    const router = express.Router()
    router.patch('/:id/role', requireAuth, requireRole('admin'), controller.updateRole)
    return router
}
