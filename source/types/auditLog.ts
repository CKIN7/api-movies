import { z } from 'zod'
import { auditLogQuerySchema } from '../schemas/auditLogQuerySchema'
import { MovieResponse } from '../domain/Movie'

export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>

export interface AuditLogEntry {
    id: number
    movieId: number
    action: 'CREATE' | 'UPDATE' | 'DELETE'
    changes: string[]
    oldSnapshot: MovieResponse | null
    newSnapshot: MovieResponse | null
    changedBy: string
    changedAt: string
}
        
export interface AuditLogParams {
    movieId: number
    limit: number
    offset: number
}
        