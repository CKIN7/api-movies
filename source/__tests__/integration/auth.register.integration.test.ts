import request from 'supertest'
import { createApp } from '../../api'
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

describe('POST /auth/register (integración real con DB)', () => {
    test('registro exitoso devuelve 201 con el user sin passwordHash y sin tokens', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'nuevo@example.com', password: 'Password123!' })

        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({
            id: expect.any(String),
            email: 'nuevo@example.com',
            role: 'user',
        })
        expect(res.body.passwordHash).toBeUndefined()
        expect(res.body.accessToken).toBeUndefined()
        expect(res.body.refreshToken).toBeUndefined()
    })

    test('registro con email ya existente devuelve 409', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'admin@example.com', password: 'Password123!' })

        expect(res.status).toBe(409)
        expect(res.body.error).toBeDefined()
    })

    test('registro con email inválido devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'no-es-un-email', password: 'Password123!' })

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })

    test('registro con password débil devuelve 400', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'debiles@example.com', password: 'password' })

        expect(res.status).toBe(400)
        expect(res.body.error).toBeDefined()
    })

    test('registro ignora el role enviado en el body y siempre crea role user', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'privilegios@example.com', password: 'Password123!', role: 'admin' })

        expect(res.status).toBe(201)
        expect(res.body.role).toBe('user')
    })

    test('registro normaliza el email (trim + lowercase) y lo devuelve limpio', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: '  Nuevo@Example.COM  ', password: 'Password123!' })

        expect(res.status).toBe(201)
        expect(res.body.email).toBe('nuevo@example.com')
    })

    test('registro con el mismo email pero distinto casing devuelve 409', async () => {
        const app = createApp()

        const res = await request(app)
            .post('/auth/register')
            .send({ email: 'Admin@Example.COM', password: 'Password123!' })

        expect(res.status).toBe(409)
        expect(res.body.error).toBeDefined()
    })

    test('el usuario registrado puede loguear después (register → login)', async () => {
        const app = createApp()

        const registerRes = await request(app)
            .post('/auth/register')
            .send({ email: 'endtoend@example.com', password: 'Password123!' })
        expect(registerRes.status).toBe(201)

        const loginRes = await request(app)
            .post('/auth/login')
            .send({ email: 'endtoend@example.com', password: 'Password123!' })

        expect(loginRes.status).toBe(200)
        expect(loginRes.body.accessToken).toBeDefined()
        expect(loginRes.body.refreshToken).toBeDefined()
    })
})
