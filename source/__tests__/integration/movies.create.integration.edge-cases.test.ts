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

/* ────────────────────────────
   DIRECTOR + GÉNERO
   ──────────────────────────── */
describe('POST /movies — director y género en DB', () => {

    test('crear con director existente NO duplica fila en directors', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Otra de Nolan',
            year: 2023,
            rating: 7.0,
            duration: 130,
            plot: '...',
            poster: 'https://example.com/nolan.jpg',
            director: 'Christopher Nolan',  // ya existe en seed (id 1)
            genre: ['drama'],
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? consultar DB: SELECT COUNT(*) FROM directors WHERE director_name = 'Christopher Nolan'
        //   debe ser 1 (no 2)
        // ? movie creada con id_director = 1
    })

    test('crear con mezcla de género existente + nuevo', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Género Mixto',
            year: 2024,
            rating: 6.5,
            duration: 110,
            plot: 'Mezcla de géneros',
            poster: 'https://example.com/mixto.jpg',
            director: 'Director Mezcla',
            genre: ['drama', 'thriller'],  // drama existe (id 3), thriller es nuevo
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? genres contiene 'drama' y 'thriller'
        // ? SELECT COUNT(*) FROM genres — drama sigue siendo 1, thriller se agregó
    })

    test('crear con director nuevo + género nuevo', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Todo Nuevo',
            year: 2025,
            rating: 8.0,
            duration: 95,
            plot: 'Todo nuevo',
            poster: 'https://example.com/nuevo.jpg',
            director: 'Directora Nova',
            genre: ['musical', 'biography'],
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? director en respuesta = 'Directora Nova'
        // ? genres contiene 'musical' y 'biography'
    })
})

/* ────────────────────────────
   DUPLICADOS
   ──────────────────────────── */
describe('POST /movies — duplicados', () => {

    test('crear dos películas con el mismo título debe permitirse (sin unique)', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Título Repetido',
            year: 2020,
            rating: 5.0,
            duration: 100,
            plot: 'Primera',
            poster: 'https://example.com/a.jpg',
            director: 'Director A',
            genre: ['drama'],
            available: true
        }

        // Act
        const res1 = await request(app).post('/movies').send(payload)
        const res2 = await request(app).post('/movies').send({ ...payload, plot: 'Segunda' })

        // Assert
        // ? res1.status = 201, res2.status = 201
        // ? ambos ids distintos
    })

    test('mismo género con distinto casing se normaliza a lowercase — no duplica', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Casing Genres',
            year: 2022,
            rating: 5.0,
            duration: 100,
            plot: '...',
            poster: 'https://example.com/casing.jpg',
            director: 'Dir Casing',
            genre: ['DRAMA', 'Drama', 'drama'],  // mismo género 3 veces
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? en DB: movie_genres tiene SOLO 1 fila para esta movie (no 3)
        // ? genres en respuesta menciona 'drama' una sola vez (o separado por coma)
    })
})

/* ────────────────────────────
   CARACTERES ESPECIALES
   ──────────────────────────── */
describe('POST /movies — caracteres especiales', () => {

    test('título con acentos y unicode debe persistir correctamente', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Película Época Ñoña 🎬',
            year: 2024,
            rating: 7.0,
            duration: 120,
            plot: 'Aventura épica ñoña con emoji',
            poster: 'https://example.com/epica.jpg',
            director: 'José Martínez',
            genre: ['drama'],
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? title en respuesta = 'Película Época Ñoña 🎬'
        // ? director = 'José Martínez'
    })

    test('inyección SQL en director no debe romper la DB', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'SQL Injection Test',
            year: 2024,
            rating: 5.0,
            duration: 100,
            plot: 'Safe plot',
            poster: 'https://example.com/sql.jpg',
            director: "Robert'; DROP TABLE movies; --",
            genre: ['drama'],
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201 (la inyección se escapa, la tabla movies sigue existiendo)
        // ? después del test: verificar que tabla movies sigue intacta
    })
})

/* ────────────────────────────
   AÑO LÍMITE EN DB
   ──────────────────────────── */
describe('POST /movies — year límite en DB', () => {

    test('year = 2026 (máximo) debe persistir correctamente', async () => {
        // Arrange
        const model = new MovieModel(db)
        const app = createApp(model)
        const payload = {
            title: 'Futuro Cercano',
            year: 2026,
            rating: 6.0,
            duration: 90,
            plot: '...',
            poster: 'https://example.com/2026.jpg',
            director: 'Director Futuro',
            genre: ['sci-fi'],
            available: true
        }

        // Act
        const res = await request(app).post('/movies').send(payload)

        // Assert
        // ? status 201
        // ? res.body.data.year = 2026
    })
})
