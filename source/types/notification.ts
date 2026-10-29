// types/notification.ts
// ═══════════════════════════════════════════════════════════════
//  Tipos de la feature de notificaciones in-app (HU-13 F3).
//  El contrato cerrado vive en docs/features/hu-13-f3-notifications.md
// ═══════════════════════════════════════════════════════════════

// Solo 'review.published' tiene emisor en F3. 'watchlist.added' y
// 'recs.ready' quedan reservados (sin emisor ni payload definido).
export const NOTIFICATION_TYPES = ['review.published'] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

// Fila cruda de la tabla `notifications`.
export interface NotificationRow {
    id: number | string;
    user_id: string;
    type: string;
    dedupe_key: string;
    payload: Record<string, unknown> | string;  // mysql2 parsea JSON; string por robustez
    read_at: string | null;
    created_at: string;
}

// Payload del evento review.published.
export interface ReviewPublishedPayload {
    movieId: number;
    movieTitle: string;
    reviewId: string;
}

// DTO público de una notificación. `id` viaja como string para no
// perder precisión al serializar un BIGINT.
export interface NotificationResponse {
    id: string;
    type: NotificationType;
    payload: Record<string, unknown>;
    readAt: string | null;
    createdAt: string;
}

// Respuesta de GET /users/me/notifications
export interface PaginatedNotificationsResponse {
    notifications: NotificationResponse[];
    total: number;
    page: number;
    limit: number;
}

// Entrada para crear una notificación (la usa el worker in-app).
export interface CreateNotificationDTO {
    userId: string;
    type: NotificationType;
    dedupeKey: string;
    payload: Record<string, unknown>;
}

// Query validada de GET /users/me/notifications
export interface NotificationListQueryDTO {
    page: number;
    limit: number;
    unreadOnly: boolean;
}
