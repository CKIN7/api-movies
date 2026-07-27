import type { Request, Response, NextFunction } from 'express'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Observer
// ═══════════════════════════════════════════════════════════════
//  Se suscribe a eventos del Response de Express ('close' para
//  requests abortadas, 'finish' para requests completadas) para
//  loguear la duración y el resultado de cada petición HTTP.
// ═══════════════════════════════════════════════════════════════

export function requestLogger(req: Request, res: Response, next: NextFunction) {
    const start = Date.now()
    const { method, originalUrl, ip } = req
    const userAgent = req.get('user-agent') || 'unknown'

    res.on('close', () => {
        if (!res.writableEnded) {
            logger.warn('Request aborted', { method, url: originalUrl, ip, duration: `${Date.now() - start}ms` })
        }
    })

    res.on('finish', () => {
        const duration = Date.now() - start
        const { statusCode } = res

        const meta = {
            method,
            url: originalUrl,
            status: statusCode,
            duration: `${duration}ms`,
            ip,
            userAgent
        }

        if (statusCode >= 500) {
            logger.error(`${method} ${originalUrl} ${statusCode}`, meta)
        } else if (statusCode >= 400) {
            logger.warn(`${method} ${originalUrl} ${statusCode}`, meta)
        } else {
            logger.info(`${method} ${originalUrl} ${statusCode}`, meta)
        }
    })

    next()
}
