const { closeDb } = require('../../db/connection')
const { disconnectRedis } = require('../../utils/redisClient')

// Se ejecuta en el worker después de cada archivo de test (setupFilesAfterEnv).
// Cierra el pool de la app y el cliente Redis para no dejar conexiones
// huérfanas entre suites (Jest no termina si queda un socket abierto).
afterAll(async () => {
    await closeDb()
    await disconnectRedis().catch(() => {})
})
