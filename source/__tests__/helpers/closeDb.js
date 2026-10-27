const { closeDb } = require('../../db/connection')
const { disconnectRedis } = require('../../utils/redisClient')

// Se ejecuta en el worker después de cada archivo de test (setupFilesAfterEnv).
// Cierra el pool de la app, las colas de BullMQ y los clientes Redis para no
// dejar conexiones huérfanas entre suites (Jest no termina si queda un socket abierto).
//
// Solo cierra las colas si el archivo de test las cargó (require.cache), para no
// instanciarlas en suites que no usan BullMQ.
afterAll(async () => {
    if (require.cache[require.resolve('../../queues')]) {
        const { closeAllQueues } = require('../../queues')
        await closeAllQueues().catch(() => {})
    }

    await closeDb()
    await disconnectRedis().catch(() => {})
})
