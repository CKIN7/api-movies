import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'
import UserRepository from '../../repositories/UserRepository'

let db: Connection

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) })

describe('UserRepository — integración real con DB', () => {

    // test('create inserta un usuario y findByEmail lo recupera', async () => {
    //     const repo = new UserRepository(db)

    //     await repo.create({ email: 'test@example.com', passwordHash: 'hash-test', role: 'user' })

    //     const email = await repo.findByEmail('test@example.com')
    //     expect(email).toBe('test@example.com')
    // })

    test('findByEmail devuelve el email', async () => {
        const repo = new UserRepository(db)

        const email = await repo.findByEmail('admin@example.com')
        expect(email).toBe('admin@example.com')
    })

    // test('findByEmail devuelve null si el email no existe', async () => {
    //     const repo = new UserRepository(db)

    //     const email = await repo.findByEmail('nadie@example.com')
    //     expect(email).toBeNull()
    // })

    // test('findByEmail distingue entre usuarios distintos', async () => {
    //     const repo = new UserRepository(db)

    //     // await repo.create({ email: 'a@example.com', passwordHash: 'hash-a', role: 'user' })
    //     // await repo.create({ email: 'b@example.com', passwordHash: 'hash-b', role: 'user' })

    //     expect(await repo.findByEmail('a@example.com')).toBe('a@example.com')
    //     expect(await repo.findByEmail('b@example.com')).toBe('b@example.com')
    //     expect(await repo.findByEmail('c@example.com')).toBeNull()
    // })

    // test('findById devuelve el email del usuario por su id', async () => {
    //     const repo = new UserRepository(db)

    //     await repo.create({ email: 'porid@example.com', passwordHash: 'hash-id', role: 'user' })

    //     const [rows] = await db.query('SELECT id FROM users WHERE email = ?', ['porid@example.com']) as any
    //     const id = rows[0].id

    //     const email = await repo.findById(id)
    //     expect(email).toBe('porid@example.com')
    // })
})
