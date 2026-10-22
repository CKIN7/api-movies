import { z } from 'zod'
import { AGE_RATINGS } from '../types/user'

// Zod: `max` valida el array de entrada; `transform` deduplica después.
const uniqueIdList = z.array(z.number().int().positive())
    .max(50, 'Máximo 50 elementos por lista')
    .transform((arr) => [...new Set(arr)])

const uniqueDecades = z.array(z.number().int().min(1900).max(2100))
    .max(20, 'Máximo 20 décadas')
    .transform((arr) => [...new Set(arr)])

export const contentFiltersSchema = z.object({
    minRating: z.number().min(0).max(10).optional(),
    maxAgeRating: z.enum(AGE_RATINGS).optional(),
    decades: uniqueDecades.optional(),
    runtimeMin: z.number().int().positive().max(1000).optional(),
    runtimeMax: z.number().int().positive().max(1000).optional(),
}).refine(
    (data) => data.runtimeMin === undefined || data.runtimeMax === undefined || data.runtimeMin <= data.runtimeMax,
    { message: 'runtimeMin no puede ser mayor que runtimeMax' }
)

export const updateUserPreferencesSchema = z.object({
    favoriteGenres: uniqueIdList.optional(),
    favoriteDirectors: uniqueIdList.optional(),
    favoriteActors: uniqueIdList.optional(),
    dislikedGenres: uniqueIdList.optional(),
    dislikedDirectors: uniqueIdList.optional(),
    dislikedActors: uniqueIdList.optional(),
    contentFilters: contentFiltersSchema.optional(),
}).refine(
    (data) => data.favoriteGenres !== undefined || data.favoriteDirectors !== undefined || data.favoriteActors !== undefined
        || data.dislikedGenres !== undefined || data.dislikedDirectors !== undefined || data.dislikedActors !== undefined
        || data.contentFilters !== undefined,
    { message: 'At least one field must be provided' }
)

export const recommendationsQuerySchema = z.object({
    type: z.enum(['content', 'collab', 'hybrid']).default('hybrid'),
    limit: z.coerce.number().int().positive().max(50).default(20),
})

export type UpdateUserPreferencesDTO = z.infer<typeof updateUserPreferencesSchema>
export type RecommendationsQueryDTO = z.infer<typeof recommendationsQuerySchema>
