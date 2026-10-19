import mysql from 'mysql2'
import dotenv from 'dotenv'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Singleton (Pool)
// ═══════════════════════════════════════════════════════════════
//  El caché de módulos de Node.js garantiza un único pool de
//  conexiones a la base de datos. Donde sea que se importe este
//  módulo, recibe la misma instancia de pool.
//
//  Un pool (a diferencia de una conexión única) reemplaza
//  automáticamente las conexiones muertas, evita fugas de estado
//  de sesión entre operaciones y permite concurrencia real.
// ═══════════════════════════════════════════════════════════════

dotenv.config()

// En tests (jest define NODE_ENV=test) la app SIEMPRE se conecta a la BD de
// tests. Doble seguro junto a __tests__/helpers/setTestDbEnv.js: aunque un
// arranque de jest no cargue los setupFiles, moviesdb jamas se toca.
if (process.env.NODE_ENV === 'test') {
    process.env.DB_NAME = process.env.DB_NAME_TEST || process.env.DB_NAME
}

const pool = mysql.createPool({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306,
    waitForConnections: true,
    connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
    queueLimit: 0,
    connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10_000,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10_000,
    idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS) || 60_000,
}).promise()

// Cierra el pool y libera todas sus conexiones. Debe llamarse en el
// apagado del servidor y en el teardown de los tests para no dejar
// conexiones huérfanas.
export async function closeDb(): Promise<void> {
    await pool.end()
}

export default pool
