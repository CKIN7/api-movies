import { z } from 'zod'

export const updateUserPreferencesSchema = z.object({
    favoriteGenres: z.array(z.number().int().positive()).optional(),
    favoriteDirectors: z.array(z.number().int().positive()).optional(),
    favoriteActors: z.array(z.number().int().positive()).optional(),
}).refine(
    (data) => data.favoriteGenres !== undefined || data.favoriteDirectors !== undefined || data.favoriteActors !== undefined,
    { message: 'At least one field must be provided' }
)

export const recommendationsQuerySchema = z.object({
    type: z.enum(['content', 'collab', 'hybrid']).default('hybrid'),
    limit: z.coerce.number().int().positive().max(50).default(20),
})

export type UpdateUserPreferencesDTO = z.infer<typeof updateUserPreferencesSchema>
export type RecommendationsQueryDTO = z.infer<typeof recommendationsQuerySchema>
