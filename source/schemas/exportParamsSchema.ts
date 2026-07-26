import {z} from 'zod';

export const exportParamsSchema = z.object({
    format: z.enum(['csv', 'json'])
})

export type ExportParamsDTO = z.infer<typeof exportParamsSchema>