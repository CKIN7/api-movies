import { execSync } from 'node:child_process'
import { GenericContainer, StartedTestContainer } from 'testcontainers'
import { Queue, Worker, QueueEvents, Job } from 'bullmq'

/**
 * Resolucion del Redis de integracion, en orden de preferencia:
 *   1. REDIS_URL_TEST (Redis real local, p. ej. redis://localhost:6379/15)
 *   2. Testcontainers (si Docker esta disponible, p. ej. en CI)
 *   3. Skip de la suite (sin Redis real ni Docker)
 */
const testRedisUrl = process.env.REDIS_URL_TEST

const dockerAvailable = (() => {
    try {
        execSync('docker info', { stdio: 'ignore' })
        return true
    } catch {
        return false
    }
})()

const canRun = Boolean(testRedisUrl) || dockerAvailable
const describeIfRedis = canRun ? describe : describe.skip

let container: StartedTestContainer | undefined
let redisUrl: string

let queue: Queue
let queueEvents: QueueEvents
let worker: Worker | undefined
let queueName: string

const connection = () => ({ url: redisUrl })

const processor = async (job: Job) => {
    if (job.name === 'double') return job.data.value * 2
    if (job.name === 'fail') throw new Error('intentional failure')
    return null
}

const startWorker = async (
    fn: (job: Job) => Promise<unknown> = processor,
    concurrency = 1
): Promise<Worker> => {
    worker = new Worker(queueName, fn, { connection: connection(), concurrency })
    await worker.waitUntilReady()
    return worker
}

beforeAll(async () => {
    if (testRedisUrl) {
        redisUrl = testRedisUrl
        return
    }

    container = await new GenericContainer('redis:7-alpine')
        .withExposedPorts(6379)
        .start()
    redisUrl = `redis://${container.getHost()}:${container.getMappedPort(6379)}`
}, 60000)

afterAll(async () => {
    if (container) await container.stop()
}, 30000)

beforeEach(async () => {
    queueName = `test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    queue = new Queue(queueName, { connection: connection() })
    queueEvents = new QueueEvents(queueName, { connection: connection() })
    await queueEvents.waitUntilReady()
    worker = undefined
})

afterEach(async () => {
    if (worker) await worker.close()
    await queueEvents.close()
    await queue.close()
})

describeIfRedis('BullMQ Integration (Redis real)', () => {
    test('procesa un job y devuelve su valor', async () => {
        await startWorker()

        const job = await queue.add('double', { value: 21 })
        const result = await job.waitUntilFinished(queueEvents)

        expect(result).toBe(42)
    }, 15000)

    test('reintenta un job fallido y termina en estado failed', async () => {
        await startWorker()

        const job = await queue.add('fail', {}, {
            attempts: 3,
            backoff: { type: 'exponential', delay: 100 },
        })

        await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow('intentional failure')

        expect(await job.getState()).toBe('failed')
        const fresh = await queue.getJob(job.id!)
        expect(fresh?.attemptsMade).toBe(3)
    }, 20000)

    test('mueve el job a la lista failed tras agotar los intentos', async () => {
        await startWorker()

        const job = await queue.add('fail', {}, {
            attempts: 2,
            backoff: { type: 'exponential', delay: 50 },
        })

        await expect(job.waitUntilFinished(queueEvents)).rejects.toThrow('intentional failure')

        const failed = await queue.getFailed()
        expect(failed.length).toBeGreaterThanOrEqual(1)
        expect(failed.map((j) => j.id)).toContain(job.id)
    }, 20000)

    test('procesa varios jobs concurrentes', async () => {
        await startWorker(processor, 5)

        const jobs = Array.from({ length: 10 }, (_, i) =>
            queue.add('double', { value: i })
        )
        const created = await Promise.all(jobs)
        const results = await Promise.all(created.map((j) => j.waitUntilFinished(queueEvents)))

        expect(results).toEqual([0, 2, 4, 6, 8, 10, 12, 14, 16, 18])
    }, 20000)

    test('respeta la prioridad de los jobs', async () => {
        // BullMQ: numero menor = mayor prioridad (1 se procesa antes que 10)
        await queue.add('double', { value: 3 }, { priority: 10 })
        await queue.add('double', { value: 1 }, { priority: 1 })
        await queue.add('double', { value: 2 }, { priority: 5 })

        const processed: string[] = []
        const done = new Promise<void>((resolve) => {
            queueEvents.on('completed', ({ jobId }) => {
                processed.push(jobId)
                if (processed.length === 3) resolve()
            })
        })

        await startWorker(processor, 1)
        await done

        const values = await Promise.all(
            processed.map(async (id) => {
                const job = await queue.getJob(id)
                return job?.data.value as number
            })
        )

        expect(values).toEqual([1, 2, 3])
    }, 20000)

    test('completa un job con jobId idempotente sin duplicar', async () => {
        await startWorker()

        const first = await queue.add('double', { value: 5 }, { jobId: 'idem-1' })
        await first.waitUntilFinished(queueEvents)

        const second = await queue.add('double', { value: 5 }, { jobId: 'idem-1' })

        expect(second.id).toBe(first.id)
        expect(await queue.getCompletedCount()).toBe(1)
    }, 20000)
})
