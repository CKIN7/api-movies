import logger from './logger'

export class DbLogger {
    static async query<T>(label: string, sql: string, params: any[], exec: () => Promise<T>): Promise<T> {
        const start = Date.now()
        try {
            const result = await exec()
            const duration = Date.now() - start
            logger.info(`DB: ${label}`, {
                sql: sql.replace(/\s+/g, ' ').trim(),
                params,
                rows: Array.isArray(result) ? result.length : 1,
                duration: `${duration}ms`
            })
            return result
        } catch (error) {
            const duration = Date.now() - start
            logger.error(`DB ERROR: ${label}`, {
                sql: sql.replace(/\s+/g, ' ').trim(),
                params,
                duration: `${duration}ms`,
                error: (error as Error).message
            })
            throw error
        }
    }
}
