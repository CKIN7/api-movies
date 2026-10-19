import connection, { closeDb } from '../db/connection'

// ═══════════════════════════════════════════════════════════════
//  One-shot: convierte genre_affinity del formato legado
//    { "1": 8 }
//  al formato con timestamps (necesario para el decay):
//    { "1": { "score": 8, "updatedAt": "..." } }
//  Idempotente: las entradas que ya son objeto se dejan igual.
// ═══════════════════════════════════════════════════════════════

type LegacyAffinity = Record<string, number | { score: number; updatedAt: string }>

async function main(): Promise<void> {
    const conn: any = connection
    const [rows] = await conn.query('SELECT user_id, genre_affinity, updated_at FROM user_preferences')

    let converted = 0

    for (const row of rows as any[]) {
        let affinity: LegacyAffinity = {}
        try {
            affinity = row.genre_affinity ? JSON.parse(row.genre_affinity) : {}
        } catch {
            affinity = {}
        }

        const next: LegacyAffinity = {}
        let changed = false

        for (const [key, value] of Object.entries(affinity)) {
            if (typeof value === 'number') {
                next[key] = { score: value, updatedAt: new Date(row.updated_at).toISOString() }
                changed = true
            } else {
                next[key] = value
            }
        }

        if (changed) {
            await conn.query(
                'UPDATE user_preferences SET genre_affinity = ? WHERE user_id = ?',
                [JSON.stringify(next), row.user_id]
            )
            converted++
        }
    }

    console.log(`[migrate-affinity] ${converted} fila(s) convertidas`)
}

main()
    .then(async () => {
        await closeDb()
    })
    .catch(async (error) => {
        console.error(`[migrate-affinity] ERROR: ${(error as Error).message}`)
        await closeDb()
        process.exitCode = 1
    })
