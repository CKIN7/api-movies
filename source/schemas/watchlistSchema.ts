import { z } from 'zod'

export const addToWatchlistSchema = z.object({
    body: z.object({
        movieId: z.number().int().positive(),
        notes: z.string().max(2000).optional().nullable(),
        priority: z.number().int().min(1).max(5).default(3)
    })
})

export const watchlistQuerySchema = z.object({
    query: z.object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(50).default(10),
        genre: z.string().optional(),
        sortBy: z.enum(['addedAt', 'title', 'year', 'rating', 'priority']).default('addedAt'),
        sortOrder: z.enum(['asc', 'desc']).default('desc')
    })
})

export const movieIdParamSchema = z.object({
    params: z.object({ movieId: z.coerce.number().int().positive() })
})

export type WatchlistQueryDTO = z.infer<typeof watchlistQuerySchema.shape.query>