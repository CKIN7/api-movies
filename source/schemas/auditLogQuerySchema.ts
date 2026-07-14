import { z } from 'zod'
import { ALLOWED_AUDIT_FIELDS } from '../types/auditLog'

export const auditLogQuerySchema = z.object({
    id: z.coerce.number().int().positive(),
    field: z.enum(ALLOWED_AUDIT_FIELDS).optional(),
    page: z.coerce.number().int().positive().optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(10)
})