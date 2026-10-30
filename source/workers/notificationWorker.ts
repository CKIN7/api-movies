import { Job } from 'bullmq'
import { notificationWorkerConcurrency, QueueNames } from '../config/bullmq'
import { BaseWorker } from './baseWorker'
import connection from '../db/connection'
import NotificationRepository from '../repositories/NotificationRepository'
import UserRepository from '../repositories/UserRepository'
import UserSettingsRepository from '../repositories/UserSettingsRepository'
import NotificationService from '../services/NotificationService'
import { enqueueEmail } from '../queues/emailQueue'
import { enqueueNotificationInApp } from '../queues/notificationQueue'
import {
    processNotificationFanoutJob,
    type NotificationFanoutDependencies,
} from '../jobs/notificationFanoutJob'
import { processNotificationInAppJob } from '../jobs/notificationInAppJob'
import type {
    NotificationFanoutPayload,
    NotificationInAppPayload,
    NotificationQueueName,
} from '../types/bullmq'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  F3: worker de notificaciones
// ═══════════════════════════════════════════════════════════════
//  Un `Worker` de BullMQ consume UNA cola, así que este módulo crea
//  dos instancias:
//  - fanout: lee preferencias y encola canales.
//  - inapp: persiste la notificación (INSERT IGNORE).
//
//  Sin limiter (no hay proveedor externo). El email que dispara el
//  fan-out entra en `email-transactional`, que ya tiene el suyo.
// ═══════════════════════════════════════════════════════════════

export const notificationQueueNames: NotificationQueueName[] = [
    QueueNames.NOTIFICATION_FANOUT,
    QueueNames.NOTIFICATION_INAPP,
]

export function buildNotificationFanoutDependencies(): NotificationFanoutDependencies {
    const settingsRepo = new UserSettingsRepository(connection)
    const userRepo = new UserRepository(connection)

    return {
        async isEmailEnabled(userId: string): Promise<boolean> {
            const row = await settingsRepo.findByUserId(userId)
            // Sin fila, el default de la app es notify_email = true (CA-4).
            if (!row) return true
            return row.notify_email === 1 || row.notify_email === true
        },
        async getUserEmail(userId: string): Promise<string | null> {
            const user = await userRepo.findById(userId)
            return user?.email ?? null
        },
        enqueueInApp: (payload) => enqueueNotificationInApp(payload),
        enqueueEmail: (message, options) => enqueueEmail('transactional', message, options),
    }
}

export class NotificationFanoutWorker extends BaseWorker<NotificationQueueName> {
    constructor(private readonly deps: NotificationFanoutDependencies) {
        super({
            queueName: QueueNames.NOTIFICATION_FANOUT,
            concurrency: notificationWorkerConcurrency,
        })
    }

    protected async processJob(job: Job<NotificationFanoutPayload>): Promise<void> {
        await processNotificationFanoutJob(job.data, this.deps)
    }
}

export class NotificationInAppWorker extends BaseWorker<NotificationQueueName> {
    constructor(private readonly service: NotificationService) {
        super({
            queueName: QueueNames.NOTIFICATION_INAPP,
            concurrency: notificationWorkerConcurrency,
        })
    }

    protected async processJob(job: Job<NotificationInAppPayload>): Promise<void> {
        await processNotificationInAppJob(job.data, this.service)
    }
}

export interface NotificationWorkers {
    fanout: NotificationFanoutWorker
    inApp: NotificationInAppWorker
}

/** Crea las dos instancias. Los overrides permiten inyectar stubs en tests. */
export function createNotificationWorkers(
    deps: NotificationFanoutDependencies = buildNotificationFanoutDependencies(),
    service: NotificationService = new NotificationService(new NotificationRepository(connection)),
): NotificationWorkers {
    return {
        fanout: new NotificationFanoutWorker(deps),
        inApp: new NotificationInAppWorker(service),
    }
}

if (require.main === module) {
    createNotificationWorkers()
    logger.info(
        `[Workers] notification workers started (${notificationQueueNames.join(', ')})`,
    )
}