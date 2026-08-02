import { test, fc } from '@fast-check/jest'
import { movieQuerySchema } from '../../schemas/movieQuery'
import { suggestQuerySchema } from '../../schemas/suggestQuerySchema'
import { randomMovieQuerySchema } from '../../schemas/randomMovieQuery'

// ═══════════════════════════════════════════════════════════════
//  Property-based tests sobre los zod schemas de query.
//  Verifican invariantes de NORMALIZACIÓN (no de validación):
//  los refines tipo minYear <= maxYear ya son garantizados por zod,
//  lo que vale la pena probar es cómo se limpian inputs "sucios".
// ═══════════════════════════════════════════════════════════════

const whitespaceOnly = fc.constantFrom('', ' ', '  ', '\t', '\n', ' \t', '\r')

// Propiedad A: un parámetro solo-espacios debe tratarse igual que uno vacío.
function testEmptyVsWhitespace(schema: { safeParse: (x: unknown) => { success: boolean } }, fields: readonly string[]) {
    test.prop([whitespaceOnly, fc.constantFrom(...fields)])(
        'trata whitespace igual que vacío',
        (spaces, field) => {
            const empty = schema.safeParse({ [field]: '' }).success
            const spaced = schema.safeParse({ [field]: spaces }).success
            return empty === spaced
        },
    )
}

describe('movieQuerySchema - parámetros numéricos', () => {
    testEmptyVsWhitespace(movieQuerySchema, [
        'minYear', 'maxYear', 'minRating', 'maxRating',
        'minDuration', 'maxDuration', 'page', 'limit',
    ])
})

describe('suggestQuerySchema - limit', () => {
    testEmptyVsWhitespace(suggestQuerySchema, ['limit'])
})

describe('randomMovieQuerySchema - parámetros numéricos', () => {
    testEmptyVsWhitespace(randomMovieQuerySchema, ['minYear', 'maxYear', 'minRating', 'count'])
})

// Generadores "hostiles": valores que un humano no escribe a mano.
const messyGenre = fc.constantFrom('Action', 'action', ' action ', 'Sci-Fi', 'sci-fi', 'Drama', '', '  ', 'ACTION', 'a', 'b')
const ageRatingValue = fc.constantFrom('G', 'g', 'PG', 'pg', 'PG-13', 'pg-13', 'R', 'r', 'NC-17', 'nc-17', ' PG ', '', '  ')

// Propiedad B: los arrays normalizados del DTO no contienen duplicados.
test.prop([fc.array(messyGenre, { minLength: 0, maxLength: 30 })])(
    'genre normalizado sin duplicados',
    (vals) => {
        const r = movieQuerySchema.safeParse({ genre: vals })
        if (!r.success || !r.data.genre) return true
        return new Set(r.data.genre).size === r.data.genre.length
    },
)

test.prop([fc.array(ageRatingValue, { minLength: 0, maxLength: 30 })])(
    'ageRating normalizado sin duplicados',
    (vals) => {
        const r = movieQuerySchema.safeParse({ ageRating: vals })
        if (!r.success || !r.data.ageRating) return true
        return new Set(r.data.ageRating).size === r.data.ageRating.length
    },
)

// Propiedad D: la normalización es case-insensitive y estable.
test.prop([fc.array(ageRatingValue, { minLength: 0, maxLength: 5 })])(
    'ageRating es case-insensitive y normaliza a la forma canónica',
    (vals) => {
        const lower = movieQuerySchema.safeParse({ ageRating: vals.map((v) => v.toLowerCase()) })
        const upper = movieQuerySchema.safeParse({ ageRating: vals.map((v) => v.toUpperCase()) })
        if (!lower.success || !upper.success) return lower.success === upper.success
        return JSON.stringify(lower.data.ageRating) === JSON.stringify(upper.data.ageRating)
    },
)

test.prop([fc.array(messyGenre, { minLength: 0, maxLength: 10 })])(
    'genre es case-insensitive y normaliza a minúsculas',
    (vals) => {
        const lower = movieQuerySchema.safeParse({ genre: vals.map((v) => v.toLowerCase()) })
        const upper = movieQuerySchema.safeParse({ genre: vals.map((v) => v.toUpperCase()) })
        if (!lower.success || !upper.success) return lower.success === upper.success
        return JSON.stringify(lower.data.genre) === JSON.stringify(upper.data.genre)
    },
)

// Propiedad C: round-trip estable parse -> query params -> parse.
// El DTO parseado, vuelto a query params, debe re-parsearse al mismo DTO.
// Nota: `sort` se acopla al formato SQL interno (m.year); se revierte a su
// forma de wire (year). Es un smell conocido: el DTO filtra detalles de SQL.
function toQueryParams(dto: Record<string, unknown>): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {}
    for (const [key, value] of Object.entries(dto)) {
        if (value === undefined || value === null) continue
        const normalized = key === 'sort' && typeof value === 'string' && value.startsWith('m.')
            ? value.slice(2)
            : value
        if (Array.isArray(value)) {
            out[key] = value.map(String)
        } else {
            out[key] = String(normalized)
        }
    }
    return out
}

const rawQuery = fc.record({
    genre: fc.array(messyGenre, { minLength: 0, maxLength: 10 }),
    genreMode: fc.constantFrom('and', 'or'),
    title: fc.string({ maxLength: 30 }),
    director: fc.string({ maxLength: 30 }),
    sort: fc.constantFrom('year', 'rating', 'title'),
    order: fc.constantFrom('asc', 'desc', 'ASC', 'Desc'),
    page: fc.oneof(fc.integer({ min: 1, max: 100 }), fc.constant(''), fc.constant('   ')),
    limit: fc.oneof(fc.integer({ min: 1, max: 100 }), fc.constant(''), fc.constant('  ')),
    q: fc.string({ maxLength: 30 }),
    ageRating: fc.array(fc.constantFrom('G', 'PG', 'PG-13', 'R', 'NC-17'), { minLength: 0, maxLength: 5 }),
    minYear: fc.oneof(fc.integer({ min: 1895, max: 2026 }), fc.constant(''), fc.constant(' ')),
    maxYear: fc.oneof(fc.integer({ min: 1895, max: 2026 }), fc.constant(''), fc.constant('  ')),
    minRating: fc.oneof(fc.double({ min: 0, max: 10 }), fc.constant('')),
    maxRating: fc.oneof(fc.double({ min: 0, max: 10 }), fc.constant('')),
    minDuration: fc.oneof(fc.integer({ min: 1, max: 300 }), fc.constant('')),
    maxDuration: fc.oneof(fc.integer({ min: 1, max: 300 }), fc.constant('')),
}, { requiredKeys: [] })

test.prop([rawQuery])(
    'round-trip estable: parse -> query params -> parse',
    (raw) => {
        const parsed = movieQuerySchema.safeParse(raw)
        if (!parsed.success) return true
        const reparsed = movieQuerySchema.safeParse(toQueryParams(parsed.data))
        if (!reparsed.success) return false
        return JSON.stringify(parsed.data) === JSON.stringify(reparsed.data)
    },
)

// suggest: si el parse tiene éxito, q queda exactamente trim + lowercase.
test.prop([fc.string({ maxLength: 50 }), fc.constantFrom('title', 'director', 'genre'), fc.oneof(fc.integer({ min: 1, max: 20 }), fc.constant(''), fc.constant('  '))])(
    'suggest normaliza q a trimmed + lowercase',
    (q, field, limit) => {
        const r = suggestQuerySchema.safeParse({ q, field, limit })
        if (!r.success) return true
        return r.data.q === q.trim().toLowerCase()
    },
)
