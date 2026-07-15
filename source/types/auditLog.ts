import { z } from 'zod'
import { auditLogQuerySchema } from '../schemas/auditLogQuerySchema'

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>

export interface AuditLogEntry {
    id: number
    movieId: number
    fieldName: string
    oldValue: string | null
    newValue: string
    changedBy: string
    changedAt: string
}
        
export interface AuditLogParams {
    movieId: number
    field?: string
    limit: number
    offset: number
}
        
export const ALLOWED_AUDIT_FIELDS = [
    'rating', 'title', 'director', 'year',
    'duration', 'plot',
] as const