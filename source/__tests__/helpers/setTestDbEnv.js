const dotenv = require('dotenv')
const path = require('path')

// Corre en cada worker ANTES de importar los ficheros de test (y por tanto
// antes de que db/connection.ts lea process.env.DB_NAME).
// Redirige la app a la BD de tests: los tests nunca tocan moviesdb.
dotenv.config({ path: path.resolve(__dirname, '../../.env') })
process.env.DB_NAME = process.env.DB_NAME_TEST || process.env.DB_NAME

// Redis de tests en una DB logica dedicada (15) para no contaminar la DB 0
// de desarrollo con claves del rate limiter ni penalizaciones.
process.env.REDIS_URL =
    process.env.REDIS_URL_TEST ||
    (process.env.REDIS_URL || 'redis://localhost:6379').replace(/\/\d+$/, '') + '/15'

// El limiter se desactiva por defecto en tests. Las suites que lo validan
// lo reactivan explicitamente (RATE_LIMIT_ENABLED=true) sobre la DB 15.
process.env.RATE_LIMIT_ENABLED = 'false'
