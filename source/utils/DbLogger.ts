import logger, { dbLogger } from './logger'

// ═══════════════════════════════════════════════════════════════
//  Patrones: Decorator + Adapter
// ═══════════════════════════════════════════════════════════════
//  Decorator: Envuelve cada consulta SQL con logging (timing,
//  parámetros, filas) sin modificar la lógica del repositorio.
//  Adapter: Adapta conn.query() a una interfaz con logging,
//  permitiendo que los repositorios usen DbLogger.query() en
//  lugar de conn.query() directamente.
// ═══════════════════════════════════════════════════════════════

export class DbLogger {
    static async query<T>(label: string, sql: string, params: any[], exec: () => Promise<T>): Promise<T> {
        const start = Date.now()
        try {
            const result = await exec()
            const duration = Date.now() - start
            const meta = {
                sql: sql.replace(/\s+/g, ' ').trim(),
                params,
                rows: Array.isArray(result) ? result.length : 1,
                duration: `${duration}ms`
            }
            logger.info(`DB: ${label}`, meta)
            dbLogger.info(`DB: ${label}`, meta)
            return result
        } catch (error) {
            const duration = Date.now() - start
            const meta = {
                sql: sql.replace(/\s+/g, ' ').trim(),
                params,
                duration: `${duration}ms`,
                error: (error as Error).message
            }
            logger.error(`DB ERROR: ${label}`, meta)
            dbLogger.error(`DB ERROR: ${label}`, meta)
            throw error
        }
    }
}
