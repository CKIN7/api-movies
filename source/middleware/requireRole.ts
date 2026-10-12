import type { Request, Response, NextFunction } from 'express'
import AppError from '../utils/AppError'
import { Role, ROLE_RANK } from '../types/user'

// ═══════════════════════════════════════════════════════════════
//  RBAC: requireRole(minRole)
// ═══════════════════════════════════════════════════════════════
//  Jerarquía: admin > premium > user. Exige siempre un rol
//  mínimo, de modo que roles superiores también pasan:
//    requireRole('admin')    → solo admin
//    requireRole('premium')  → premium y admin
//    requireRole('user')     → cualquier rol autenticado
//
//  Debe encadenarse tras requireAuth, que es quien popula
//  req.user con { id, role } a partir del claim del JWT.
// ═══════════════════════════════════════════════════════════════

export function requireRole(minRole: Role) {
    return (req: Request, _resp: Response, next: NextFunction) => {
        const role = req.user?.role
        if (!role) throw new AppError('No autenticado', 401)
        if (ROLE_RANK[role] < ROLE_RANK[minRole]) {
            throw new AppError('No tienes permisos para esta acción', 403)
        }
        next()
    }
}
