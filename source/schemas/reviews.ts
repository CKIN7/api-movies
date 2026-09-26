import { z } from 'zod';

const noHtml = (s: string) => !/<[^>]*>/i.test(s);
const noHtmlMsg = 'No se permiten etiquetas HTML';

export const reviewSchema = z.object({
    rating: z.number()
        .min(1, 'El rating mínimo es 1')
        .max(5, 'El rating máximo es 5')
        .multipleOf(0.5, 'El rating debe ser múltiplo de 0.5'),
    comment: z.string()
        .trim()
        .max(2000, 'El comentario no puede tener más de 2000 caracteres')
        .refine(noHtml, noHtmlMsg)
        .optional()
        .nullable()
});

export const reviewParamsSchema = z.object({
    id: z.coerce.number().int().positive({ message: 'El id debe ser un número entero positivo' })
});

export type ReviewParamsDTO = z.infer<typeof reviewParamsSchema>;

export type CreateReviewDTO = z.infer<typeof reviewSchema>;
export type UpdateReviewDTO = z.infer<typeof reviewSchema.partial>