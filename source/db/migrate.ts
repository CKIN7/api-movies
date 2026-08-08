import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'
import mysql from 'mysql2/promise'

dotenv.config({ path: path.resolve(__dirname, '../.env') })

const MIGRATIONS_DIR = path.join(__dirname, 'migrations')

function listMigrationFiles(): string[] {
    if (!fs.existsSync(MIGRATIONS_DIR)) return []
    return fs.readdirSync(MIGRATIONS_DIR)
        .filter((f) => f.endsWith('.sql'))
        .sort()
}

async function main() {
    const command = process.argv[2] ?? 'up'

    const conn = await mysql.createConnection({
        host: process.env.DB_HOST,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
        database: process.env.DB_NAME,
        port: Number(process.env.DB_PORT) || 3306,
        multipleStatements: true,
    })

    try {
        await conn.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(255) NOT NULL UNIQUE,
            applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )`)

        const [rows] = (await conn.query(`SELECT name FROM schema_migrations`)) as any
        const applied = new Set(rows.map((r: any) => r.name))
        const files = listMigrationFiles()

        if (command === 'status') {
            for (const file of files) {
                const state = applied.has(file) ? 'APPLIED' : 'PENDING'
                console.log(`[${state}] ${file}`)
            }
            return
        }

        for (const file of files) {
            if (applied.has(file)) continue
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8')
            try {
                await conn.query(sql)
                await conn.query(`INSERT INTO schema_migrations (name) VALUES (?)`, [file])
                console.log(`[migrate] aplicado: ${file}`)
            } catch (error) {
                console.error(`[migrate] ERROR en ${file}: ${(error as Error).message}`)
                process.exitCode = 1
                return
            }
        }

        if (files.length === 0) console.log('[migrate] no hay migraciones en db/migrations')
        else console.log('[migrate] sin migraciones pendientes')
    } finally {
        await conn.end()
    }
}

main()
