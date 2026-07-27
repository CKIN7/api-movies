import { JsonSerializer } from '../../serializers/JsonSerializer'
import type { MovieResponse } from '../../domain/Movie'

describe('JsonSerializer', () => {
    const serializer = new JsonSerializer()

    test('debe devolver el content type correcto', () => {
        expect(serializer.getContentType()).toBe('application/json')
    })

    test('debe devolver la extensión correcta', () => {
        expect(serializer.getFileExtension()).toBe('json')
    })

    test('debe serializar películas como JSON pretty-printed', () => {
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
            },
        ]

        const result = serializer.serialize(movies)
        const parsed = JSON.parse(result)

        expect(Array.isArray(parsed)).toBe(true)
        expect(parsed).toHaveLength(1)
        expect(parsed[0].title).toBe('Inception')
        expect(parsed[0].genres).toEqual(['Action', 'Sci-Fi'])
        expect(parsed[0].cast[0].actor).toBe('Leonardo DiCaprio')
    })

    test('debe devolver array vacío con JSON.stringify si no hay películas', () => {
        const result = serializer.serialize([])
        expect(result).toBe('[]')
    })

    test('debe indentar con 2 espacios', () => {
        const movies: MovieResponse[] = [
            {
                id: 1,
                title: 'Test',
                year: 2020,
                rating: 5.0,
                genres: ['Drama'],
                duration: 100,
                director: 'Dir',
                plot: '...',
                poster: '...',
                cast: [],
                ageRating: 'PG',
            },
        ]

        const result = serializer.serialize(movies)
        expect(result).toContain('\n  {')
    })
})
