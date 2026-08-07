import type { Request, Response, NextFunction } from 'express'
import AppError from '../utils/AppError'
import jwt from 'jsonwebtoken'

export function requireAuth(req: Request, resp: Response, next: NextFunction) {
    const header = req.headers.authorization

    if(!header) throw new AppError('El bearer no puede estar vacio', 401)
    if(!header.startsWith('Bearer ')) throw new AppError('Formato de token inválido', 401)
    
    const token = header.slice(7)
    if(!token) throw new AppError('Token vacío', 401)
    
    let payload: { sub?: string; type?: string }
    try {
    payload = jwt.verify(token, process.env.JWT_SECRET!) as { sub?: string; type?: string }

    } catch {
      throw new AppError('Token inválido o expirado', 401) 
    }
    if(!payload.sub) throw new AppError('Token inválido', 401)
    if(payload.type !== 'access') throw new AppError('Token inválido', 401)

    req.user = {id: payload.sub}
    next();
}