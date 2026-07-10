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
        //ARRANGE
        const model = new MovieModel(db)
        const app = createApp(model)

        // 1. Hacer GET a /movies?sort=year&order=desc
        // 2. Assert: status 200
        // 3. Assert: los años deben estar en orden descendente
        //    Ej: res.body[i].year >= res.body[i+1].year para cada i

        //ACT
        const res = await request(app).get('/movies?sort=year&order=desc')
        
         // Assert: Validar orden descendente de los datos recibidos
        const movies = res.body
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
        }
    })

    test('debe ordenar por rating ascendente: GET /movies?sort=rating&order=asc', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?sort=rating&order=asc')

        expect(res.status).toBe(200)

        const movies = res.body
        for (let i = 0; i < movies.length - 1; i++) {
            expect(Number(movies[i].rating)).toBeLessThanOrEqual(Number(movies[i + 1].rating))
        }
    })

    test('debe ordenar por título ascendente por defecto: GET /movies?sort=title', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?sort=title')

        expect(res.status).toBe(200)

        const movies = res.body
        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].title.localeCompare(movies[i + 1].title)).toBeLessThanOrEqual(0)
        }
    })

    test('debe devolver 400 si sort es inválido: GET /movies?sort=invalido', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?sort=invalido')

        expect(res.status).toBe(400)
        expect(res.body).toHaveProperty('error')
    })

    test('debe funcionar sin sort (comportamiento actual): GET /movies', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies')

        expect(res.status).toBe(200)
        expect(res.body).toHaveLength(8)
    })

    test('debe combinar sort con filtros existentes: GET /movies?sort=year&order=desc&genre=action', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?sort=year&order=desc&genre=action')

        expect(res.status).toBe(200)

        const movies = res.body
        expect(movies.length).toBeGreaterThan(0)
        movies.forEach((m: any) => expect(m.genres.toLowerCase()).toMatch(/action/))

        for (let i = 0; i < movies.length - 1; i++) {
            expect(movies[i].year).toBeGreaterThanOrEqual(movies[i + 1].year)
        }
    })

})
