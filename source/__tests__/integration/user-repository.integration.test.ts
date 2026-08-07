import { setupTestDb, teardownTestDb, clearTestData, seedTestData } from '../helpers/db'
import type { Connection } from 'mysql2/promise'
import UserRepository from '../../repositories/UserRepository'

let db: Connection

beforeAll(async () => { db = await setupTestDb() })
afterAll(async () => { await teardownTestDb(db) })
beforeEach(async () => { await clearTestData(db); await seedTestData(db) })

describe('UserRepository — integración real con DB', () => {

    test('create inserta un usuario y findByEmail lo recupera', async () => {
        const repo = new UserRepository(db)

        await repo.create({ email: 'test@example.com', passwordHash: 'hash-test', role: 'user' })

        const row = await repo.findByEmail('test@example.com')
        expect(row).not.toBeNull()
        expect(row!.email).toBe('test@example.com')
        expect(row!.passwordHash).toBe('hash-test')
        expect(row!.role).toBe('user')
        expect(row!.id).toBeDefined()
    })

    test('findByEmail devuelve la fila completa', async () => {
        const repo = new UserRepository(db)

        const row = await repo.findByEmail('admin@example.com')
        expect(row).not.toBeNull()
        expect(row!.email).toBe('admin@example.com')
        expect(row!.role).toBeDefined()
        expect(row!.passwordHash).toBeDefined()
    })

    test('findByEmail devuelve null si el email no existe', async () => {
        const repo = new UserRepository(db)

        const row = await repo.findByEmail('nadie@example.com')
        expect(row).toBeNull()
    })

    test('findByEmail distingue entre usuarios distintos', async () => {
        const repo = new UserRepository(db)

        await repo.create({ email: 'a@example.com', passwordHash: 'hash-a', role: 'user' })
        await repo.create({ email: 'b@example.com', passwordHash: 'hash-b', role: 'user' })

        const a = await repo.findByEmail('a@example.com')
        const b = await repo.findByEmail('b@example.com')
        expect(a).not.toBeNull()
        expect(b).not.toBeNull()
        expect(a!.email).toBe('a@example.com')
        expect(b!.email).toBe('b@example.com')
        expect(await repo.findByEmail('c@example.com')).toBeNull()
    })

    test('findById devuelve la fila completa del usuario por su id', async () => {
        const repo = new UserRepository(db)

        await repo.create({ email: 'porid@example.com', passwordHash: 'hash-id', role: 'user' })

        const [rows] = await db.query('SELECT id FROM users WHERE email = ?', ['porid@example.com']) as any
        const id = rows[0].id

        const row = await repo.findById(id)
        expect(row).not.toBeNull()
        expect(row!.email).toBe('porid@example.com')
        expect(row!.role).toBe('user')
    })
})
