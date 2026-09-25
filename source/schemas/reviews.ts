import { z } from 'zod';

export const reviewParamsSchema = z.object({
    id: z.coerce.number().int().positive({ message: 'El id debe ser un número entero positivo' })
});

export type ReviewParamsDTO = z.infer<typeof reviewParamsSchema>;