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

describe('GET /movies?title= (búsqueda por título)', () => {
    test('debe filtrar por título parcial (case-insensitive)', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=incept')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title.toLowerCase()).toMatch(/incept/)
    })

    test('debe devolver array vacío si no hay coincidencias', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=xyzxyz')

        expect(res.status).toBe(200)
        expect(res.body.data).toEqual([])
    })

    test('debe devolver múltiples resultados para término compartido', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=dark')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(3)
        res.body.data.forEach((m: any) => expect(m.title.toLowerCase()).toMatch(/dark/))
    })

    test('debe combinar title con year reduciendo resultados', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=dark&year=1994')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('Dark Shadows')
        expect(res.body.data[0].year).toBe(1994)
    })

    test('debe combinar title con genre', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=dark&genre=action')

        expect(res.status).toBe(200)
        expect(res.body.data.length).toBeGreaterThanOrEqual(2)
        res.body.data.forEach((m: any) => {
            expect(m.title.toLowerCase()).toMatch(/dark/)
            expect(m.genres.toLowerCase()).toMatch(/action/)
        })
    })

    test('debe combinar title, genre y year simultáneamente', async () => {
        const model = new MovieModel(db)
        const app = createApp(model)

        const res = await request(app).get('/movies?title=knight&genre=action&year=2008')

        expect(res.status).toBe(200)
        expect(res.body.data).toHaveLength(1)
        expect(res.body.data[0].title).toBe('The Dark Knight')
        expect(res.body.data[0].year).toBe(2008)
        expect(res.body.data[0].genres.toLowerCase()).toMatch(/action/)
    })
})