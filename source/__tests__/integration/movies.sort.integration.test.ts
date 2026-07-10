import request from 'supertest'
import { createApp } from '../../api'
import MovieModel from '../../models/Movie-mysql'
import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'

let db: Connection

beforeAll(async () => {
    db = await setupTestDb()
})

afterAll(async () => {
    await teardownTestDb(db)
})

beforeEach(async () => {
    await clearTestData(db)
    await seedTestData(db)
})

describe('GET /movies?sort=&order= (integración)', () => {

    test('debe ordenar por año descendente: GET /movies?sort=year&order=desc', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=year&order=desc
        // 2. Assert: status 200
        // 3. Assert: los años deben estar en orden descendente
        //    Ej: res.body[i].year >= res.body[i+1].year para cada i
    })

    test('debe ordenar por rating ascendente: GET /movies?sort=rating&order=asc', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=rating&order=asc
        // 2. Assert: status 200
        // 3. Assert: los ratings deben estar en orden ascendente
        //    Ej: res.body[i].rating <= res.body[i+1].rating para cada i
    })

    test('debe ordenar por título ascendente por defecto: GET /movies?sort=title', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=title (sin order)
        // 2. Assert: status 200
        // 3. Assert: los títulos deben estar en orden alfabético ascendente (A→Z)
        //    Pista: localeCompare o comparar directamente strings
    })

    test('debe devolver 400 si sort es inválido: GET /movies?sort=invalido', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=invalido
        // 2. Assert: status 400
        // 3. Assert: body tiene una propiedad "error" con algún mensaje
    })

    test('debe funcionar sin sort (comportamiento actual): GET /movies', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies (sin query params)
        // 2. Assert: status 200
        // 3. Assert: devuelve todas las películas seed (8)
        //    (no importa el orden, solo que no se rompe)
    })

    test('debe combinar sort con filtros existentes: GET /movies?sort=year&order=desc&genre=action', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=year&order=desc&genre=action
        // 2. Assert: status 200
        // 3. Assert: todas las películas tienen "action" en genres
        // 4. Assert: los años están en orden descendente
    })

})
