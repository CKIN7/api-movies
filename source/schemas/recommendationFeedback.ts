import { z } from 'zod'
import { FEEDBACK_ACTIONS } from '../types/recommendation'

export const recommendationFeedbackSchema = z.object({
    movieId: z.number().int().positive({ message: 'movieId debe ser un entero positivo' }),
    action: z.enum(FEEDBACK_ACTIONS),
})

export type RecommendationFeedbackSchemaDTO = z.infer<typeof recommendationFeedbackSchema>
