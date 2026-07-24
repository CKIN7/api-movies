import { z } from 'zod'

export const randomMovieQuerySchema = z.object({
    genre: z.preprocess(
        (val) => {
            if (val === undefined || val === '') return undefined
            const arr = Array.isArray(val) ? val : [val]
            const cleaned = [...new Set(
                arr
                    .filter(s => typeof s === 'string' && s.trim().length > 0)
                    .map(s => s.trim().toLowerCase())
            )]
            return cleaned.length > 0 ? cleaned : undefined
        },
        z.array(z.string()).min(1).max(10).optional()
    ),
    minYear: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.coerce.number().int().min(1895).max(2026).optional()
    ),
    maxYear: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.coerce.number().int().min(1895).max(2026).optional()
    ),
    minRating: z.preprocess(
        (val) => (val === '' ? undefined : val),
        z.coerce.number().min(0).max(10).optional()
    ),
}).refine(
    d => d.minYear === undefined || d.maxYear === undefined || d.minYear <= d.maxYear,
    { message: "minYear no puede ser mayor que maxYear", path: ["minYear"] }
)

export type RandomMovieQueryDTO = z.infer<typeof randomMovieQuerySchema>
