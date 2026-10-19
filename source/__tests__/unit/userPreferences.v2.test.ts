import { contentFiltersSchema, updateUserPreferencesSchema } from '../../schemas/userPreferences'

describe('UserPreferences v2 — validación de schema', () => {
    describe('límites y dedupe de listas', () => {
        test('deduplica arrays de favoritos', () => {
            const parsed = updateUserPreferencesSchema.parse({ favoriteGenres: [1, 1, 3, 3, 3] })
            expect(parsed.favoriteGenres).toEqual([1, 3])
        })

        test('acepta justo 50 elementos', () => {
            const ids = Array.from({ length: 50 }, (_, i) => i + 1)
            expect(() => updateUserPreferencesSchema.parse({ favoriteGenres: ids })).not.toThrow()
        })

        test('rechaza 51 elementos', () => {
            const ids = Array.from({ length: 51 }, (_, i) => i + 1)
            expect(() => updateUserPreferencesSchema.parse({ favoriteGenres: ids })).toThrow()
        })

        test('rechaza ids no positivos', () => {
            expect(() => updateUserPreferencesSchema.parse({ favoriteGenres: [0] })).toThrow()
        })
    })

    describe('content filters', () => {
        test('acepta filtros válidos', () => {
            const parsed = contentFiltersSchema.parse({
                minRating: 8,
                maxAgeRating: 'R',
                decades: [1990, 1990, 2000],
                runtimeMin: 90,
                runtimeMax: 180,
            })
            expect(parsed.decades).toEqual([1990, 2000])
        })

        test('rechaza runtimeMin > runtimeMax', () => {
            expect(() => contentFiltersSchema.parse({ runtimeMin: 200, runtimeMax: 100 })).toThrow()
        })

        test('rechaza minRating fuera de rango', () => {
            expect(() => contentFiltersSchema.parse({ minRating: 11 })).toThrow()
        })

        test('rechaza maxAgeRating desconocido', () => {
            expect(() => contentFiltersSchema.parse({ maxAgeRating: 'X' })).toThrow()
        })
    })

    test('exige al menos un campo', () => {
        expect(() => updateUserPreferencesSchema.parse({})).toThrow()
    })
})
