import { z } from 'zod'
import type { NotificationListQueryDTO } from '../types/notification'

// `unread_only` llega como string en el query; z.coerce.boolean() haría
// Boolean('false') === true, así que se mapea explícitamente.
const unreadOnly = z.preprocess(
    (value) => (value === 'true' ? true : value === 'false' ? false : value),
    z.boolean().default(false)
)

export const notificationListQuerySchema = z
    .object({
        page: z.coerce.number().int().positive().default(1),
        limit: z.coerce.number().int().positive().max(100).default(20),
        unread_only: unreadOnly,
    })
    .transform((data): NotificationListQueryDTO => ({
        page: data.page,
        limit: data.limit,
        unreadOnly: data.unread_only,
    }))

export const notificationIdParamSchema = z.object({
    id: z.string().regex(/^[1-9]\d*$/, 'Identificador de notificación inválido'),
})
