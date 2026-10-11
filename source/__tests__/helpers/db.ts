import mysql from 'mysql2/promise'
import type { Connection } from 'mysql2/promise'
import dotenv from 'dotenv'
import path from 'path'
import { clearAll, seedDatabase, connectToServer, applySchema, recreateDatabase, databaseExists } from '../../db/seed'
import { getRedisClient } from '../../utils/redisClient'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// El penalty box es por IP (127.0.0.1 en local) y dura 15 min: si una suite
// deja activa la penalizacion, TODAS las suites siguientes reciben 403 y la
// entera queda rota. Se resetea el estado de rate limit antes de cada suite.
async function resetRateLimitState(): Promise<void> {
    try {
        const client = getRedisClient() as any
        if (client.status === 'wait' && typeof client.connect === 'function') {
            await client.connect()
        }
        const keys: string[] = await client.keys('ratelimit:*')
        if (keys.length > 0) await client.del(...keys)
    } catch {
        // Redis no disponible: el rate limiter hace fail-open, no es bloqueante
    }
}

// ═══════════════════════════════════════════════════════════════
//  Los tests NUNCA tocan la BD de la app (moviesdb).
//  - jest globalSetup (helpers/globalSetup.js) crea DB_NAME_TEST con
//    db/schema.sql antes de arrancar los workers.
//  - jest setupFiles (helpers/setTestDbEnv.js) hace que db/connection.ts
//    de la app apunte a esa BD de tests dentro del worker.
//  - setupTestDb() (beforeAll) vuelve a aplicar db/schema.sql: cada suite
//    empieza con tablas vacias y no hereda datos ni transacciones de la
//    suite anterior. NO se hace DROP DATABASE porque la conexion de la app
//    (abierta al importar api.ts, antes de este hook) quedaria sin BD.
//  Nota: maxWorkers: 1 en jest.config.js; si se paraleliza habra que
//  dar una BD de tests por worker.
// ═══════════════════════════════════════════════════════════════

export async function setupTestDb(): Promise<Connection> {
    const name = process.env.DB_NAME_TEST ?? process.env.DB_NAME
    if (!name) throw new Error('Falta DB_NAME_TEST (o DB_NAME) en .env')

    await resetRateLimitState()

    const bootstrap = await connectToServer()
    try {
        if (await databaseExists(bootstrap, name)) {
            await bootstrap.query(`USE \`${name}\``)
            await applySchema(bootstrap)
        } else {
            await recreateDatabase(bootstrap, name)
        }
    } finally {
        await bootstrap.end()
    }

    return mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER || process.env.DB_user,
        password: process.env.DB_PASSWORD,
        database: name,
        port: Number(process.env.DB_PORT) || 3306
    })
}

export async function teardownTestDb(conn: Connection): Promise<void> {
    await conn.end()
}

export async function clearTestData(conn: Connection): Promise<void> {
    await clearAll(conn)
}

export async function seedTestData(conn: Connection): Promise<void> {
    await seedDatabase(conn)
}
