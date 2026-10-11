const dotenv = require('dotenv')
const path = require('path')

// Corre en cada worker ANTES de importar los ficheros de test (y por tanto
// antes de que db/connection.ts lea process.env.DB_NAME).
// Redirige la app a la BD de tests: los tests nunca tocan moviesdb.
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
process.env.DB_NAME = process.env.DB_NAME_TEST || process.env.DB_NAME
