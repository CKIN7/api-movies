import {z} from 'zod';

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val)

export const suggestQuerySchema = z.object({
    q: z.preprocess(
        (val) => (typeof val === 'string' ? val.trim().toLowerCase() : val), z.string().min(3).max(100)
    ),
    field: z.enum(['title', 'director', 'genre']),
    limit: z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(20).optional()).default(8)
})

export type SuggestQueryDTO = z.infer<typeof suggestQuerySchema>