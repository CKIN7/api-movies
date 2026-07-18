import { z } from 'zod'

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val)

export const movieQuerySchema = z.object({
    genre: z.preprocess(emptyToUndefined, z.string().optional()),
    title: z.preprocess(emptyToUndefined, z.string().optional()),
    director: z.preprocess(emptyToUndefined, z.string().optional()),
    sort: z.preprocess(emptyToUndefined, z.enum(['year', 'rating', 'title']).transform(s => `m.${s}`).optional()),
    order: z.preprocess(val => {
        const v = emptyToUndefined(val)
        return typeof v === 'string' ? v.toLowerCase() : v
    }, z.enum(['asc', 'desc']).optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()).default(1),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()).default(10),
    q: z.preprocess(emptyToUndefined, z.string().optional()),
    minYear: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1895).max(2026).optional()),
    maxYear: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1895).max(2026).optional()),
    minRating: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10).optional()),
    maxRating: z.preprocess(emptyToUndefined, z.coerce.number().min(0).max(10).optional()),
    minDuration: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
    maxDuration: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()),
}).refine(
    d => d.minYear === undefined || d.maxYear === undefined || d.minYear <= d.maxYear,
    { message: "minYear no puede ser mayor que maxYear", path: ["minYear"] }
).refine(
    d => d.minRating === undefined || d.maxRating === undefined || d.minRating <= d.maxRating,
    { message: "minRating no puede ser mayor que maxRating", path: ["minRating"] }
).refine(
    d => d.minDuration === undefined || d.maxDuration === undefined || d.minDuration <= d.maxDuration,
    { message: "minDuration no puede ser mayor que maxDuration", path: ["minDuration"] }
)

export type MovieQueryDTO = z.infer<typeof movieQuerySchema>
