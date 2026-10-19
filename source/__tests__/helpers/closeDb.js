const { closeDb } = require('../../db/connection')

// Se ejecuta en el worker después de cada archivo de test (setupFilesAfterEnv).
// Cierra el pool de la app para no dejar conexiones huérfanas entre suites.
afterAll(async () => {
    await closeDb()
})
