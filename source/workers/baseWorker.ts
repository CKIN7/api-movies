import { Worker, WorkerOptions, Job } from 'bullmq'
import { bullmqConnection } from '../config/bullmq'
import logger from '../utils/logger'

export interface BaseWorkerOptions<T extends string = string> extends Omit<WorkerOptions, 'connection'> {
    queueName: T
    concurrency?: number
}

// ═══════════════════════════════════════════════════════════════
//  Graceful shutdown compartido
// ═══════════════════════════════════════════════════════════════
//  Un solo par de listeners SIGTERM/SIGINT para todos los workers
//  del proceso. Registrar handlers por instancia dispara
//  MaxListenersExceededWarning y cierra varias veces.
// ═══════════════════════════════════════════════════════════════

const activeWorkers = new Set<BaseWorker<string>>()
let hooksInstalled = false

function installShutdownHooks(): void {
    if (hooksInstalled) return
    hooksInstalled = true

    const shutdownAll = async (signal: string) => {
        logger.info(`[Workers] ${signal} received, draining ${activeWorkers.size} worker(s)...`)
        await Promise.allSettled([...activeWorkers].map((w) => w.shutdown(signal)))
    }

    process.once('SIGTERM', () => void shutdownAll('SIGTERM'))
    process.once('SIGINT', () => void shutdownAll('SIGINT'))
}

export abstract class BaseWorker<T extends string = string> {
    protected worker: Worker
    protected readonly queueName: T
    protected readonly concurrency: number
    private isShuttingDown = false

    constructor(options: BaseWorkerOptions<T>) {
        this.queueName = options.queueName
        this.concurrency = options.concurrency ?? 1

        const { queueName, concurrency, ...workerOptions } = options
        void queueName
        void concurrency

        this.worker = new Worker(
            this.queueName,
            this.processJob.bind(this),
            {
                connection: bullmqConnection,
                concurrency: this.concurrency,
                ...workerOptions,
            }
        )

        this.setupEventHandlers()
        activeWorkers.add(this as unknown as BaseWorker<string>)
        installShutdownHooks()
    }

    protected abstract processJob(job: Job): Promise<void>

    private setupEventHandlers(): void {
        this.worker.on('completed', this.onCompleted.bind(this))
        this.worker.on('failed', this.onFailed.bind(this))
        this.worker.on('error', this.onError.bind(this))
        this.worker.on('stalled', this.onStalled.bind(this))
    }

    private onCompleted(job: Job): void {
        logger.info(`[${this.queueName}] Job ${job.id} completed`, {
            queue: this.queueName,
            jobId: job.id,
            duration: Date.now() - job.timestamp,
        })
    }

    private onFailed(job: Job | undefined, err: Error): void {
        const attempt = job?.attemptsMade ?? 0
        const maxAttempts = job?.opts?.attempts ?? 3
        logger.error(`[${this.queueName}] Job ${job?.id} failed (attempt ${attempt}/${maxAttempts})`, {
            queue: this.queueName,
            jobId: job?.id,
            error: err.message,
            stack: err.stack,
            attempt,
            maxAttempts,
        })
    }

    private onError(err: Error): void {
        logger.error(`[${this.queueName}] Worker error`, {
            queue: this.queueName,
            error: err.message,
            stack: err.stack,
        })
    }

    private onStalled(jobId: string): void {
        logger.warn(`[${this.queueName}] Job ${jobId} stalled`, {
            queue: this.queueName,
            jobId,
        })
    }

    /**
     * Drena el job en curso y cierra el worker. Idempotente.
     * `close(true)` espera a que termine el job activo antes de salir.
     */
    async shutdown(signal = 'manual'): Promise<void> {
        if (this.isShuttingDown) return
        this.isShuttingDown = true

        logger.info(`[${this.queueName}] ${signal}: draining worker...`)
        this.worker.off('completed', this.onCompleted)
        this.worker.off('failed', this.onFailed)
        this.worker.off('error', this.onError)
        this.worker.off('stalled', this.onStalled)

        try {
            await this.worker.close(true)
            logger.info(`[${this.queueName}] Worker closed gracefully`)
        } catch (err) {
            logger.error(`[${this.queueName}] Error closing worker`, {
                error: err instanceof Error ? err.message : String(err),
            })
        } finally {
            activeWorkers.delete(this as unknown as BaseWorker<string>)
        }
    }

    async close(): Promise<void> {
        await this.shutdown('close')
    }

    getWorker(): Worker {
        return this.worker
    }
}
