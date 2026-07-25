import {z} from 'zod';

const exportParamsSchema = z.object({
    format: z.enum(['csv', 'json'])
})

export type ExportParamsDTO = z.infer<typeof exportParamsSchema>