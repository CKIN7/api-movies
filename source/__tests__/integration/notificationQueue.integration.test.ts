import { QueueEvents } from 'bullmq'
import { bullmqConnection, QueueNames } from '../../config/bullmq'
import {
    enqueueNotificationFanout,
    enqueueNotificationInApp,
    notificationFanoutQueue,
} from '../../queues/notificationQueue'
import {
    createNotificationWorkers,
    notificationQueueNames,
    type NotificationWorkers,
} from '../../workers/notificationWorker'
import type { NotificationFanoutDependencies } from '../../jobs/notificationFanoutJob'
import type { NotificationFanoutPayload } from '../../types/bullmq'
import type NotificationService from '../../services/NotificationService'

/**
 * Redis real. El factory lee `REDIS_URL`, que `setTestDbEnv.js` apunta a
 * `REDIS_URL_TEST` (DB 15). Sin `REDIS_URL_TEST` la suite se saltea.
 */
const testRedisUrl = process.env.REDIS_URL_TEST
const describeIfRedis = testRedisUrl ? describe : describe.skip

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describeIfRedis('NotificationQueue + NotificationWorker (Redis real)', () => {
    const events: Partial<Record<string, QueueEvents>> = {}

    let workers: NotificationWorkers
    let deps: NotificationFanoutDependencies
    let create: jest.Mock
    let createCalled: Promise<any>
    let resolveCreate: (dto: any) => void

    beforeAll(async () => {
        for (const name of notificationQueueNames) {
            const queueEvents = new QueueEvents(name, { connection: bullmqConnection })
            await queueEvents.waitUntilReady()
            events[name] = queueEvents
        }
    })

    afterAll(async () => {
        await Promise.all(Object.values(events).map((queueEvents) => queueEvents?.close()))
    })

    beforeEach(() => {
        createCalled = new Promise<any>((resolve) => {
            resolveCreate = resolve
        })
        create = jest.fn(async (dto) => {
            resolveCreate(dto)
            return true
        })

        deps = {
            isEmailEnabled: jest.fn().mockResolvedValue(true),
            getUserEmail: jest.fn().mockResolvedValue('author@example.com'),
            enqueueInApp: (payload) => enqueueNotificationInApp(payload),
            enqueueEmail: jest.fn().mockResolvedValue('email-1'),
        }

        workers = createNotificationWorkers(
            deps,
            { create } as unknown as NotificationService,
        )
    })

    afterEach(async () => {
        await workers.fanout.close()
        await workers.inApp.close()
    })

    async function runFanout(payload: NotificationFanoutPayload): Promise<void> {
        const jobId = await enqueueNotificationFanout(payload, { jobId: `fanout-${uniqueId()}` })
        const job = await notificationFanoutQueue.getJob(jobId)
        await job!.waitUntilFinished(events[QueueNames.NOTIFICATION_FANOUT]!)
    }

    test('review.published encola in-app y email', async () => {
        await runFanout({
            event: 'review.published',
            userId: 'user-1',
            payload: { movieId: 27205, movieTitle: 'Inception', reviewId: `r-${uniqueId()}` },
        })

        const dto = await createCalled
        expect(dto).toMatchObject({ userId: 'user-1', type: 'review.published' })
        expect(dto.dedupeKey).toMatch(/^r-/)
        expect(deps.enqueueEmail).toHaveBeenCalledWith(
            expect.objectContaining({
                template: 'review-published',
                to: 'author@example.com',
            }),
            expect.objectContaining({ jobId: expect.stringMatching(/^review-published-r-/) }),
        )
    }, 20000)

    test('notify_email=false solo encola in-app', async () => {
        ;(deps.isEmailEnabled as jest.Mock).mockResolvedValue(false)

        await runFanout({
            event: 'review.published',
            userId: 'user-2',
            payload: { movieId: 1, movieTitle: 'Alien', reviewId: `r-${uniqueId()}` },
        })

        const dto = await createCalled
        expect(dto.userId).toBe('user-2')
        expect(deps.enqueueEmail).not.toHaveBeenCalled()
    }, 20000)

    test('el mismo jobId de fan-out no encola dos veces', async () => {
        const jobId = `fanout-${uniqueId()}`
        const payload: NotificationFanoutPayload = {
            event: 'review.published',
            userId: 'user-3',
            payload: { movieId: 2, movieTitle: 'Heat', reviewId: `r-${uniqueId()}` },
        }

        const first = await enqueueNotificationFanout(payload, { jobId })
        const second = await enqueueNotificationFanout(payload, { jobId })

        expect(second).toBe(first)

        const job = await notificationFanoutQueue.getJob(first)
        await job!.waitUntilFinished(events[QueueNames.NOTIFICATION_FANOUT]!)

        const dto = await createCalled
        expect(dto.userId).toBe('user-3')
        expect(create).toHaveBeenCalledTimes(1)
    }, 20000)
})