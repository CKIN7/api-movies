import { z } from 'zod'
import { auditLogQuerySchema } from '../schemas/auditLogQuerySchema'

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>

export interface AuditLogEntry {
    id: number
    movieId: number
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    changes: string[]
    oldSnapshot: object | null
    newSnapshot: object | null
    changedBy: string
    changedAt: string
}

export interface InsertAuditLogParams {
    movieId: number
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    oldSnapshot: object | null
    newSnapshot: object | null
}
        
export interface AuditLogParams {
    movieId: number
    limit: number
    offset: number
}
        