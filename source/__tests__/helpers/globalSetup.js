const mysql = require('mysql2/promise')
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

// Se ejecuta UNA vez por `npm test`, ANTES de que cualquier worker importe
// api.ts (que abre la conexion de la app al cargar el modulo). Por eso aqui
// si es seguro hacer DROP DATABASE: todavia no hay conexiones abiertas.
// Garantiza que la BD de tests existe con su esquema base (db/schema.sql).
module.exports = async function globalSetup() {
    const name = process.env.DB_NAME_TEST || `${process.env.DB_NAME}_test`
    if (!process.env.DB_NAME || !name.endsWith('_test') || name === process.env.DB_NAME) {
        throw new Error(`DB de tests insegura: "${name}". Debe terminar en _test y ser distinta de DB_NAME.`)
    }

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true,
    })
    try {
        await conn.query(`DROP DATABASE IF EXISTS \`${name}\``)
        await conn.query(
            `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci`
        )
        await conn.query(`USE \`${name}\``)
        const schema = fs.readFileSync(path.resolve(__dirname, '../../db/schema.sql'), 'utf8')
        await conn.query(schema)
        console.log(`[jest] BD de tests "${name}" recreada con esquema base`)
    } finally {
        await conn.end()
    }
}
