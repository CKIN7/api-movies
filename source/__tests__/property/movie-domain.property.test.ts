import { test, fc } from '@fast-check/jest'
import { Movie } from '../../domain/Movie'
import { movieSchema } from '../../schemas/movie'
import type { MovieRow } from '../../types/movie'

// ═══════════════════════════════════════════════════════════════
//  Property-based tests sobre el round-trip MovieRow -> Movie -> MovieResponse.
//  Nombres "seguros": evitan los separadores de serialización (| y ,)
//  para probar el contrato positivo. La limitación de los separadores
//  queda documentada al final del archivo.
// ═══════════════════════════════════════════════════════════════

const safeName = fc.array(
    fc.constantFrom('a', 'b', 'c', 'A', 'Z', 'x', '1', 'é', 'ñ', '中', ' '),
    { minLength: 1, maxLength: 12 },
).map((chars) => chars.join(''))

const ratingStr = fc.oneof(
    fc.double({ min: 0, max: 10 }).map((n) => String(n)),
    fc.constant('8.8'),
    fc.constant('0'),
)

describe('Movie.fromRow -> toResponse', () => {
    test.prop([
        fc.integer({ min: 1, max: 1000000 }),
        safeName,                               // title
        fc.integer({ min: 1895, max: 2026 }),   // year
        safeName,                               // director
        ratingStr,                              // rating (string, como viene de MySQL)
        fc.integer({ min: 1, max: 300 }),       // duration
        fc.string({ maxLength: 100 }),          // plot
        fc.webUrl(),                            // poster
        fc.constantFrom('G', 'PG', 'PG-13', 'R', 'NC-17'),
        fc.array(safeName, { minLength: 0, maxLength: 6 }),
        fc.array(fc.record({ actor: safeName, character: safeName }), { minLength: 0, maxLength: 6 }),
    ])(
        'preserva escalares y normaliza genres/cast',
        (id, title, year, director, rating, duration, plot, poster, ageRating, genreNames, cast) => {
            const row: MovieRow = {
                id, title, year, director, rating: rating as unknown as number, duration, plot, poster,
                genres: genreNames.join(', '),
                cast: cast.map((m) => `${m.actor}||${m.character}`).join('|||'),
                age_rating: ageRating,
            }

            const response = Movie.fromRow(row).toResponse()

            if (response.id !== id) return false
            if (response.title !== title) return false
            if (response.year !== year) return false
            if (response.rating !== Number(rating)) return false
            if (response.director !== director) return false
            if (response.duration !== duration) return false
            if (response.plot !== plot) return false
            if (response.poster !== poster) return false
            if (response.ageRating !== ageRating) return false

            const expectedGenres = genreNames.map((g) => g.trim()).filter(Boolean)
            if (JSON.stringify(response.genres) !== JSON.stringify(expectedGenres)) return false

            if (response.cast.length !== cast.length) return false
            for (let i = 0; i < cast.length; i++) {
                if (response.cast[i].actor !== cast[i].actor.trim()) return false
                if (response.cast[i].character !== cast[i].character.trim()) return false
            }
            return true
        },
    )

    test.prop([
        fc.integer({ min: 1, max: 1000000 }),
        safeName,                               // title
        fc.integer({ min: 1895, max: 2026 }),   // year
        safeName,                               // director
        ratingStr,                              // rating
        fc.integer({ min: 1, max: 300 }),       // duration
        fc.string({ maxLength: 100 }),          // plot
        fc.webUrl(),                            // poster
        fc.constantFrom('G', 'PG', 'PG-13', 'R', 'NC-17'),
        fc.array(safeName, { minLength: 0, maxLength: 6 }),
        fc.array(fc.record({ actor: safeName, character: safeName }), { minLength: 0, maxLength: 6 }),
    ])(
        'response es JSON-serializable',
        (id, title, year, director, rating, duration, plot, poster, ageRating, genreNames, cast) => {
            const row: MovieRow = {
                id, title, year, director, rating: rating as unknown as number, duration, plot, poster,
                genres: genreNames.join(', '),
                cast: cast.map((m) => `${m.actor}||${m.character}`).join('|||'),
                age_rating: ageRating,
            }

            const json = JSON.stringify(Movie.fromRow(row).toResponse())
            if (json === undefined) return false
            try {
                return JSON.stringify(JSON.parse(json)) === json
            } catch {
                return false
            }
        },
    )
})

// Limitación documentada: el formato delimitado por || / ||| / , no puede
// representar nombres que contengan esos separadores. Si el schema los
// permite al crear, el round-trip se corrompe silenciosamente.
test('limitación conocida: los separadores || en nombres rompen el round-trip', () => {
    const row: MovieRow = {
        id: 1, title: 'X', year: 2000, director: 'D', rating: 5, duration: 90,
        plot: 'P', poster: 'https://example.com/x.jpg',
        genres: 'Drama',
        cast: 'Cobb||A||B',
        age_rating: 'PG-13',
    }
    const response = Movie.fromRow(row).toResponse()
    expect(response.cast[0]).toEqual({ actor: 'Cobb', character: 'A' })
})

test('movieSchema no protege contra separadores || en cast', () => {
    const result = movieSchema.safeParse({
        title: 'Inception',
        year: 2010,
        genre: ['Action'],
        director: 'Nolan',
        duration: 148,
        plot: 'Un ladrón que roba secretos.',
        poster: 'https://example.com/inception.jpg',
        cast: [{ actor: 'Cobb', character: 'x||y' }],
    })
    expect(result.success).toBe(true)
})
