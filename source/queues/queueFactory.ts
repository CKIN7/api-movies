import { Queue, QueueOptions } from 'bullmq'
import { bullmqConnection, defaultJobOptions, QueueNames, QueueName, queueOptions } from '../config/bullmq'
import type { TypedQueue } from '../types/bullmq'

export function createQueue<T extends QueueName>(
    name: T,
    customOptions?: Partial<QueueOptions>
): TypedQueue<T> {
    const baseOptions = queueOptions[name] || { defaultJobOptions }
    const mergedOptions: QueueOptions = {
        connection: bullmqConnection,
        ...baseOptions,
        ...customOptions,
        defaultJobOptions: {
            ...defaultJobOptions,
            ...baseOptions.defaultJobOptions,
            ...customOptions?.defaultJobOptions,
        },
    }

    return new Queue(name, mergedOptions) as TypedQueue<T>
}

export const emailCriticalQueue = createQueue(QueueNames.EMAIL_CRITICAL)
export const emailTransactionalQueue = createQueue(QueueNames.EMAIL_TRANSACTIONAL)
export const emailMarketingQueue = createQueue(QueueNames.EMAIL_MARKETING)
export const notificationFanoutQueue = createQueue(QueueNames.NOTIFICATION_FANOUT)
export const notificationInAppQueue = createQueue(QueueNames.NOTIFICATION_INAPP)
export const recsRecomputeUserQueue = createQueue(QueueNames.RECS_RECOMPUTE_USER)
export const recsRecomputeAllQueue = createQueue(QueueNames.RECS_RECOMPUTE_ALL)

export const allQueues = [
    emailCriticalQueue,
    emailTransactionalQueue,
    emailMarketingQueue,
    notificationFanoutQueue,
    notificationInAppQueue,
    recsRecomputeUserQueue,
    recsRecomputeAllQueue,
]

export async function closeAllQueues(): Promise<void> {
    await Promise.allSettled(allQueues.map((q) => q.close()))
}

export { QueueNames } from '../config/bullmq'
export type { QueueName } from '../types/bullmq'
