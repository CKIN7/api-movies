import { z } from 'zod'

const noHtml = (s: string) => !/<[^>]*>/i.test(s)
const currentYear = new Date().getFullYear()

function isHttpUrl(value: string): boolean {
    try {
        const url = new URL(value)
        return url.protocol === 'http:' || url.protocol === 'https:'
    } catch {
        return false
    }
}

export const updateUserProfileSchema = z.object({
    displayName: z.string()
        .trim()
        .min(2, 'El nombre debe tener al menos 2 caracteres')
        .max(50, 'El nombre no puede superar 50 caracteres')
        .refine(noHtml, 'No se permiten etiquetas HTML')
        .nullable()
        .optional(),
    bio: z.string()
        .trim()
        .max(300, 'La bio no puede superar 300 caracteres')
        .refine(noHtml, 'No se permiten etiquetas HTML')
        .nullable()
        .optional(),
    avatarUrl: z.string()
        .trim()
        .max(500, 'La URL no puede superar 500 caracteres')
        .refine(isHttpUrl, 'La URL debe ser http o https')
        .nullable()
        .optional(),
    country: z.string()
        .trim()
        .regex(/^[A-Za-z]{2}$/, 'El país debe ser un código ISO-3166 de 2 letras')
        .transform((s) => s.toUpperCase())
        .nullable()
        .optional(),
    birthYear: z.number()
        .int()
        .min(1900, 'Año inválido')
        .max(currentYear - 13, 'Debes tener al menos 13 años')
        .nullable()
        .optional(),
    isPublic: z.boolean().optional(),
}).refine(
    (data) => Object.keys(data).length > 0,
    { message: 'At least one field must be provided' }
)

export const profileIdParamSchema = z.object({
    id: z.uuid(),
})

export type UpdateUserProfileDTO = z.infer<typeof updateUserProfileSchema>
