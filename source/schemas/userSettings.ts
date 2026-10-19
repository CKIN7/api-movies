import { z } from 'zod'
import { PRIVACY_LEVELS, THEMES } from '../types/user'

export const updateUserSettingsSchema = z.object({
    language: z.string()
        .trim()
        .regex(/^[a-z]{2}(-[A-Z]{2})?$/, 'Idioma inválido (ej: es, en-US)')
        .optional(),
    theme: z.enum(THEMES).optional(),
    region: z.string()
        .trim()
        .regex(/^[A-Za-z]{2}$/, 'La región debe ser un código ISO-3166 de 2 letras')
        .transform((s) => s.toUpperCase())
        .nullable()
        .optional(),
    notifyEmail: z.boolean().optional(),
    notifyPush: z.boolean().optional(),
    privacyReviews: z.enum(PRIVACY_LEVELS).optional(),
    privacyWatchlist: z.enum(PRIVACY_LEVELS).optional(),
    privacyActivity: z.enum(PRIVACY_LEVELS).optional(),
    spoilerFree: z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
)

export type UpdateUserSettingsDTO = z.infer<typeof updateUserSettingsSchema>
