import { z } from 'zod'

const idList = z.array(z.number().int().positive({ message: 'Los ids deben ser enteros positivos' }))

const unique = (ids: number[]) => new Set(ids).size === ids.length

export const onboardingSchema = z.object({
    favoriteGenres: idList
        .min(1, { message: 'Selecciona al menos un género' })
        .max(10, { message: 'Máximo 10 géneros' })
        .refine(unique, { message: 'No se permiten géneros duplicados' }),
    favoriteDirectors: idList
        .max(10, { message: 'Máximo 10 directores' })
        .refine(unique, { message: 'No se permiten directores duplicados' })
        .optional(),
})

export type OnboardingSchemaDTO = z.infer<typeof onboardingSchema>
