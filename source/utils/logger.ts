import winston from 'winston'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Singleton
// ═══════════════════════════════════════════════════════════════
//  El caché de módulos de Node.js garantiza una única instancia
//  de cada logger (logger y dbLogger) en toda la aplicación.
//  Donde sea que se importe este módulo, recibe la misma instancia.
// ═══════════════════════════════════════════════════════════════

const textFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : ''
        return `[${timestamp}] ${level.toUpperCase()}: ${message} ${metaStr}`
    })
)

const logger = winston.createLogger({
    level: 'info',
    format: textFormat,
    transports: [
        new winston.transports.Console(),
        new winston.transports.File({ filename: 'logs/error.log', level: 'error', format: winston.format.json() }),
        new winston.transports.File({ filename: 'logs/combined.log', format: winston.format.json() })
    ]
})

const dbLogger = winston.createLogger({
    level: 'info',
    format: textFormat,
    transports: [
        new winston.transports.File({ filename: 'logs/db.log' })
    ]
})

export { dbLogger }
export default logger
