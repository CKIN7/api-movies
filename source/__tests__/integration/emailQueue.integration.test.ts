import { QueueEvents } from 'bullmq'
import { bullmqConnection, QueueNames } from '../../config/bullmq'
import { enqueueEmail, getEmailQueue } from '../../queues/emailQueue'
import { createEmailWorkers, emailQueueNames } from '../../workers/emailWorker'
import QueuedEmailVerificationNotifier from '../../notifiers/QueuedEmailVerificationNotifier'
import type EmailService from '../../services/EmailService'
import type { EmailMessage } from '../../services/EmailService'

/**
 * Redis real. El factory de la app lee `REDIS_URL`, que
 * `__tests__/helpers/setTestDbEnv.js` setea a `REDIS_URL_TEST` (DB 15)
 * cuando esta definido. Sin `REDIS_URL_TEST` la suite se saltea: no se
 * puede redirigir el factory a un Testcontainer despues de importarlo.
 */
const testRedisUrl = process.env.REDIS_URL_TEST
const describeIfRedis = testRedisUrl ? describe : describe.skip

const uniqueId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

describeIfRedis('EmailQueue + EmailWorker (Redis real)', () => {
    const send = jest.fn(async (_message: EmailMessage) => undefined)
    const stubService = { send } as unknown as EmailService

    let workers: ReturnType<typeof createEmailWorkers> = []
    const events: Partial<Record<string, QueueEvents>> = {}

    beforeAll(async () => {
        for (const name of emailQueueNames) {
            const queueEvents = new QueueEvents(name, { connection: bullmqConnection })
            await queueEvents.waitUntilReady()
            events[name] = queueEvents
        }

        workers = createEmailWorkers(stubService)
        await Promise.all(workers.map((worker) => worker.getWorker().waitUntilReady()))
    })

    afterAll(async () => {
        await Promise.all(workers.map((worker) => worker.close()))
        await Promise.all(
            Object.values(events).map((queueEvents) => queueEvents?.close()),
        )
    })

    beforeEach(async () => {
        send.mockClear()
    })

    test('enqueueEmail + EmailWorker entrega el job con su payload', async () => {
        const jobId = await enqueueEmail(
            'critical',
            {
                template: 'verification',
                to: 'nuevo@example.com',
                data: { url: 'http://localhost:8089/auth/verify/tok-1' },
            },
            { jobId: `it-${uniqueId()}` },
        )

        const job = await getEmailQueue('critical').getJob(jobId)
        expect(job).toBeDefined()
        await job!.waitUntilFinished(events[QueueNames.EMAIL_CRITICAL]!)

        expect(send).toHaveBeenCalledWith(
            expect.objectContaining({ template: 'verification', to: 'nuevo@example.com' }),
        )
    }, 20000)

    test('el mismo jobId no encola dos veces (idempotencia)', async () => {
        const jobId = `idem-${uniqueId()}`
        const message: EmailMessage = {
            template: 'password-reset',
            to: 'idem@example.com',
            data: { url: 'http://localhost:8089/auth/reset/tok-2' },
        }

        const [firstId, secondId] = await Promise.all([
            enqueueEmail('critical', message, { jobId }),
            enqueueEmail('critical', message, { jobId }),
        ])

        expect(secondId).toBe(firstId)

        const job = await getEmailQueue('critical').getJob(firstId)
        await job!.waitUntilFinished(events[QueueNames.EMAIL_CRITICAL]!)

        const forRecipient = send.mock.calls.filter(
            ([sentMessage]) => sentMessage.to === 'idem@example.com',
        )
        expect(forRecipient).toHaveLength(1)
    }, 20000)

    // Regresión: el notificador real genera el jobId. Antes usaba
    // `<template>:<token>` y BullMQ lo rechazaba con `Custom Id cannot
    // contain :`, dejando el registro sin email (fallo silencioso).
    test('el notificador de verificación encola un jobId que BullMQ acepta', async () => {
        const completed = new Promise<string>((resolve) => {
            const queueEvents = events[QueueNames.EMAIL_CRITICAL]!
            const handler = (payload: { jobId: string }) => {
                if (payload.jobId.startsWith('verification-')) {
                    queueEvents.off('completed', handler)
                    resolve(payload.jobId)
                }
            }
            queueEvents.on('completed', handler)
        })

        await new QueuedEmailVerificationNotifier().sendVerificationEmail(
            'notifier@example.com',
            `tok-${uniqueId()}`,
        )

        const jobId = await completed
        expect(jobId).not.toContain(':')

        const job = await getEmailQueue('critical').getJob(jobId)
        expect(job?.data).toEqual(
            expect.objectContaining({ template: 'verification', to: 'notifier@example.com' }),
        )
    }, 20000)

    test('reintenta un email que falla y termina fallido tras agotar los intentos', async () => {
        send.mockRejectedValueOnce(new Error('proveedor caido'))
        send.mockRejectedValueOnce(new Error('proveedor caido'))
        send.mockRejectedValueOnce(new Error('proveedor caido'))

        const jobId = `fail-${uniqueId()}`
        const id = await enqueueEmail(
            'marketing',
            { template: 'welcome', to: 'fail@example.com', data: {} },
            { jobId },
        )

        const queue = getEmailQueue('marketing')
        const job = await queue.getJob(id)
        await expect(
            job!.waitUntilFinished(events[QueueNames.EMAIL_MARKETING]!),
        ).rejects.toThrow('proveedor caido')

        const fresh = await queue.getJob(id)
        expect(fresh?.attemptsMade).toBeGreaterThanOrEqual(3)
    }, 40000)
})
