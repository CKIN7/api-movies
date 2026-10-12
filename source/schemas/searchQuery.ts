import { z } from 'zod'

const emptyToUndefined = (val: unknown) => (typeof val === 'string' && val.trim() === '' ? undefined : val)

export const searchQuerySchema = z.object({
    q: z.preprocess(
        emptyToUndefined,
        z.string().trim().min(3, 'q debe tener al menos 3 caracteres').max(200, 'q no puede exceder 200 caracteres')
    ),
    page: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().positive().optional()
    ).default(1),
    limit: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1).max(100).optional()
    ).default(10),
    genre: z.preprocess(
        emptyToUndefined,
        z.string().optional()
    ),
    field: z.preprocess(
        emptyToUndefined,
        z.enum(['title', 'director', 'genres', 'plot']).optional()
    ),
    exact: z.preprocess(
        emptyToUndefined,
        z.coerce.boolean().optional()
    ).default(false),
    minYear: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1895).max(2026).optional()
    ),
    maxYear: z.preprocess(
        emptyToUndefined,
        z.coerce.number().int().min(1895).max(2026).optional()
    ),
    minRating: z.preprocess(
        emptyToUndefined,
        z.coerce.number().min(0).max(10).optional()
    ),
    maxRating: z.preprocess(
        emptyToUndefined,
        z.coerce.number().min(0).max(10).optional()
    ),
}).refine(
    d => d.minYear === undefined || d.maxYear === undefined || d.minYear <= d.maxYear,
    { message: 'minYear no puede ser mayor que maxYear', path: ['minYear'] }
).refine(
    d => d.minRating === undefined || d.maxRating === undefined || d.minRating <= d.maxRating,
    { message: 'minRating no puede ser mayor que maxRating', path: ['minRating'] }
)

export type SearchQueryDTO = z.infer<typeof searchQuerySchema>
