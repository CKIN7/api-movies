import { Request, Response, NextFunction } from 'express'
import { rateLimiterMiddleware } from './rateLimiterStrategies'

export const rateLimiterGlobal = async (req: Request, res: Response, next: NextFunction) => {
  await rateLimiterMiddleware(req, res, next)
}

export const rateLimiterAuth = async (req: Request, res: Response, next: NextFunction) => {
  await rateLimiterMiddleware(req, res, next)
}

export const rateLimiterWrite = async (req: Request, res: Response, next: NextFunction) => {
  await rateLimiterMiddleware(req, res, next)
}

export const rateLimiterUser = async (req: Request, res: Response, next: NextFunction) => {
  await rateLimiterMiddleware(req, res, next)
}