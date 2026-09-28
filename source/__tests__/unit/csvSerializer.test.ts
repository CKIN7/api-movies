import { CsvSerializer } from '../../serializers/CsvSerializer'
import type { MovieResponse } from '../../domain/Movie'

describe('CsvSerializer', () => {
    const serializer = new CsvSerializer()

    test('debe devolver el content type correcto', () => {
        expect(serializer.getContentType()).toBe('text/csv; charset=utf-8')
    })

    test('debe devolver la extensión correcta', () => {
        expect(serializer.getFileExtension()).toBe('csv')
    })

    test('debe incluir BOM y header', () => {
        const result = serializer.serialize([])
        expect(result).toContain('\uFEFF')
        expect(result).toContain('Título,Año,Rating,Géneros,Duración,Director,Reparto')
    })

    test('debe serializar una película correctamente', () => {
        const movies: MovieResponse[] = [
            {
                id: 1,
                title: 'Inception',
                year: 2010,
                rating: 8.8,
                genres: ['Action', 'Sci-Fi'],
                duration: 148,
                director: 'Christopher Nolan',
                plot: '...',
                poster: '...',
                cast: [{ actor: 'Leonardo DiCaprio', character: 'Dom Cobb' }],
                ageRating: 'PG-13',
                averageRating: 4.5,
                reviewsCount: 10,
            },
        ]

        const result = serializer.serialize(movies)
        const lines = result.split('\r\n')

        expect(lines[0]).toBe('\uFEFFTítulo,Año,Rating,Géneros,Duración,Director,Reparto')
        expect(lines[1]).toContain('Inception')
        expect(lines[1]).toContain('2010')
        expect(lines[1]).toContain('8.8')
        expect(lines[1]).toContain('"Action, Sci-Fi"')
        expect(lines[1]).toContain('148')
        expect(lines[1]).toContain('"Christopher Nolan"')
        expect(lines[1]).toContain('"Leonardo DiCaprio (Dom Cobb)"')
    })

    test('debe escapar comillas en los valores', () => {
        const movies: MovieResponse[] = [
            {
                id: 2,
                title: 'Movie "X"',
                year: 2000,
                rating: 5.0,
                genres: ['Drama'],
                duration: 100,
                director: 'O\'Brien',
                plot: '...',
                poster: '...',
                cast: [{ actor: 'John "The Man" Doe', character: 'Hero' }],
                ageRating: 'PG',
                averageRating: 4.0,
                reviewsCount: 5,
            },
        ]

        const result = serializer.serialize(movies)
        expect(result).toContain('"Movie ""X"""')
        expect(result).toContain('"O\'Brien"')
        expect(result).toContain('"John ""The Man"" Doe (Hero)"')
    })

    test('debe manejar películas sin reparto', () => {
        const movies: MovieResponse[] = [
            {
                id: 3,
                title: 'No Cast',
                year: 2020,
                rating: 7.0,
                genres: ['Comedy'],
                duration: 90,
                director: 'Director',
                plot: '...',
                poster: '...',
                cast: [],
                ageRating: 'G',
                averageRating: null,
                reviewsCount: 0,
            },
        ]

        const result = serializer.serialize(movies)
        expect(result).toContain('"No Cast"')
    })
})
