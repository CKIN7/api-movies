import mysql from 'mysql2'
import dotenv from 'dotenv'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Singleton
// ═══════════════════════════════════════════════════════════════
//  El caché de módulos de Node.js garantiza una única conexión
//  a la base de datos. Donde sea que se importe este módulo,
//  recibe la misma instancia de pool de conexiones MySQL.
// ═══════════════════════════════════════════════════════════════

dotenv.config()

// En tests (jest define NODE_ENV=test) la app SIEMPRE se conecta a la BD de
// tests. Doble seguro junto a __tests__/helpers/setTestDbEnv.js: aunque un
// arranque de jest no cargue los setupFiles, moviesdb jamas se toca.
if (process.env.NODE_ENV === 'test') {
    process.env.DB_NAME = process.env.DB_NAME_TEST || process.env.DB_NAME
}

const connection = mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    port: Number(process.env.DB_PORT) || 3306
}).promise()

export default connection