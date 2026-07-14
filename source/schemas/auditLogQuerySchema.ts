import { z } from 'zod'
import { ALLOWED_AUDIT_FIELDS } from '../types/auditLog'

const emptyToUndefined = (val: unknown) => (val === '' ? undefined : val)

export const auditLogQuerySchema = z.object({
    id: z.coerce.number({
        message: "El id debe ser un número"
    }).int("El id debe ser un número entero").positive("El id debe ser un número positivo"),
    field: z.enum(ALLOWED_AUDIT_FIELDS, {
        message: `El campo debe ser uno de: ${ALLOWED_AUDIT_FIELDS.join(', ')}`
    }).optional(),
    page: z.preprocess(emptyToUndefined, z.coerce.number({
        message: "La página debe ser un número"
    }).int("La página debe ser un número entero").positive("La página debe ser un número positivo").optional()).default(1),
    limit: z.preprocess(emptyToUndefined, z.coerce.number({
        message: "El límite debe ser un número"
    }).int("El límite debe ser un número entero").min(1, "El límite mínimo es 1").max(100, "El límite máximo es 100").optional()).default(10)
})