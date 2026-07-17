import { z } from 'zod'

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val)

export const movieQuerySchema = z.object({
    genre: z.preprocess(emptyToUndefined, z.string().optional()),
    year: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1895).max(2026).optional()),
    title: z.preprocess(emptyToUndefined, z.string().optional()),
    director: z.preprocess(emptyToUndefined, z.string().optional()),
    sort: z.preprocess(emptyToUndefined, z.enum(['year', 'rating', 'title']).transform(s => `m.${s}`).optional()),
    order: z.preprocess(val => {
        const v = emptyToUndefined(val)
        return typeof v === 'string' ? v.toLowerCase() : v
    }, z.enum(['asc', 'desc']).optional()),
    page: z.preprocess(emptyToUndefined, z.coerce.number().int().positive().optional()).default(1),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(100).optional()).default(10),
    q: z.preprocess(emptyToUndefined, z.string().optional())
})

export type MovieQueryDTO = z.infer<typeof movieQuerySchema>
