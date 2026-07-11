import request from 'supertest'
import { createApp } from '../../api'
import MovieModel from '../../models/Movie-mysql'

describe('GET /movies?sort=&order= (controlador)', () => {
    function createMockModel() {
        return {
            getMovies: jest.fn().mockName('getMovies'),
            getMovieById: jest.fn().mockName('getMovieById'),
            createMovie: jest.fn().mockName('createMovie'),
            updateMovie: jest.fn().mockName('updateMovie'),
            deleteMovie: jest.fn().mockName('deleteMovie')
        }
    }

    afterEach(() => {
        jest.restoreAllMocks()
    })

    test('debe pasar sort y order al modelo', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue([])

        const app = createApp(model as any)
        await request(app).get('/movies?sort=year&order=desc')

        expect(model.getMovies).toHaveBeenCalledWith({ sort: 'year', order: 'desc' })
    })

    test('debe pasar sort con order por defecto ascendente', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue([])

        const app = createApp(model as any)
        await request(app).get('/movies?sort=title')

        expect(model.getMovies).toHaveBeenCalledWith({ sort: 'title' })
    })

    test('debe pasar sort y order junto con filtros existentes', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue([])

        const app = createApp(model as any)
        await request(app).get('/movies?sort=rating&genre=action&title=dark')

        expect(model.getMovies).toHaveBeenCalledWith({ sort: 'rating', genre: 'action', title: 'dark' })
    })

    test('no debe pasar sort si no está en query', async () => {
        const model = createMockModel()
        model.getMovies.mockResolvedValue([])

        const app = createApp(model as any)
        await request(app).get('/movies')

        expect(model.getMovies).toHaveBeenCalledWith({})
    })
})

describe('MovieModel - getMovies con sort (modelo)', () => {
    function createMockConnection() {
        const query = jest.fn()
        const beginTransaction = jest.fn()
        const commit = jest.fn()
        const rollback = jest.fn()
        return { query, beginTransaction, commit, rollback } as any
    }

    test('debe incluir ORDER BY year DESC', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        await model.getMovies({ sort: 'year', order: 'desc' })

        const queryStr = conn.query.mock.calls[0][0] as string
        expect(queryStr).toContain('ORDER BY m.year DESC')
    })

    test('debe incluir ORDER BY rating ASC por defecto', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        await model.getMovies({ sort: 'rating' })

        const queryStr = conn.query.mock.calls[0][0] as string
        expect(queryStr).toContain('ORDER BY m.rating ASC')
    })

    test('debe incluir ORDER BY title ASC', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        await model.getMovies({ sort: 'title', order: 'asc' })

        const queryStr = conn.query.mock.calls[0][0] as string
        expect(queryStr).toContain('ORDER BY m.title ASC')
    })

    test('debe combinar ORDER BY con filtros WHERE', async () => {
        const conn = createMockConnection()
        const model = new MovieModel(conn)
        conn.query.mockResolvedValue([[]])

        await model.getMovies({ title: 'dark', sort: 'year', order: 'desc' })

        const queryStr = conn.query.mock.calls[0][0] as string
        expect(queryStr).toContain('WHERE')
        expect(queryStr).toContain('ORDER BY m.year DESC')
        expect(queryStr.indexOf('ORDER BY')).toBeGreaterThan(queryStr.indexOf('WHERE'))
    })
})