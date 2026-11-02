// domain/Notification.ts
// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method + DTO
//  fromRow() construye el dominio desde la fila SQL (normalizando
//  el BIGINT a string y el JSON a objeto); toResponse() emite el
//  DTO público.
// ═══════════════════════════════════════════════════════════════

import type { NotificationResponse, NotificationRow, NotificationType } from '../types/notification'

const parsePayload = (payload: NotificationRow['payload']): Record<string, unknown> => {
    if (typeof payload === 'string') {
        try {
            const parsed = JSON.parse(payload)
            return parsed && typeof parsed === 'object' ? parsed : {}
        } catch {
            return {}
        }
    }
    return payload ?? {}
}

export class Notification {
    constructor(
        public readonly id: string,
        public readonly userId: string,
        public readonly type: NotificationType,
        public readonly dedupeKey: string,
        public readonly payload: Record<string, unknown>,
        public readonly readAt: string | null,
        public readonly createdAt: string,
    ) {}

    static fromRow(row: NotificationRow): Notification {
        return new Notification(
            String(row.id),
            row.user_id,
            row.type as NotificationType,
            row.dedupe_key,
            parsePayload(row.payload),
            row.read_at,
            row.created_at,
        )
    }

    toResponse(): NotificationResponse {
        return {
            id: this.id,
            type: this.type,
            payload: this.payload,
            readAt: this.readAt,
            createdAt: this.createdAt,
        }
    }
}
