import type { Request, Response, NextFunction } from 'express'
import AppError from '../utils/AppError'
import jwt from 'jsonwebtoken'

export function requireAuth(req: Request, resp: Response, next: NextFunction) {
    const bearer = req.headers.authorization

    if(!bearer) throw new AppError('El bearer no puede estar vacio', 401)
    if(bearer && !bearer.startsWith('Bearer')) throw new AppError('Error', 401)
    
    const token = bearer.slice(7)
    if(!token) throw new AppError('Error', 401)
    
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as jwt.JwtPayload

    if(payload.type === 'refresh') throw new AppError('Error', 401)
    
    
}