import { AsyncLocalStorage } from 'async_hooks'
import type { PoolConnection } from 'mysql2/promise'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Ambient Context (AsyncLocalStorage)
// ═══════════════════════════════════════════════════════════════
//  Con un pool, cada query puede tomar una conexión distinta. Para
//  que todas las operaciones dentro de una transacción usen LA MISMA
//  conexión, transaction() guarda esa conexión en un contexto async
//  y los repositorios la resuelven aquí, sin propagarla por parámetro.
//
//  Fuera de una transacción, activeConnection() devuelve el fallback
//  (el pool o la conexión del repositorio).
// ═══════════════════════════════════════════════════════════════

const storage = new AsyncLocalStorage<PoolConnection>()

export function runInTransaction<T>(conn: PoolConnection, fn: () => Promise<T>): Promise<T> {
    return storage.run(conn, fn)
}

export function activeConnection<T>(fallback: T): T | PoolConnection {
    return storage.getStore() ?? fallback
}
