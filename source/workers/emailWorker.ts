import { Job } from 'bullmq'
import { emailLimiter, emailWorkerConcurrency, QueueNames } from '../config/bullmq'
import type { EmailJobPayload, EmailQueueName } from '../types/bullmq'
import EmailService from '../services/EmailService'
import { processSendEmailJob } from '../jobs/sendEmailJob'
import { BaseWorker } from './baseWorker'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  F2: worker de email
// ═══════════════════════════════════════════════════════════════
//  Un `Worker` de BullMQ consume UNA cola, asi que este modulo crea
//  tres instancias (critical / transactional / marketing), cada una
//  con el mismo EmailService y su propio limiter.
//
//  El limiter es la unica defensa contra el 429 de Resend; ojo: es
//  por cola, no global (ver "Deuda conocida" en el doc de HU-13).
// ═══════════════════════════════════════════════════════════════

export const emailQueueNames: EmailQueueName[] = [
    QueueNames.EMAIL_CRITICAL,
    QueueNames.EMAIL_TRANSACTIONAL,
    QueueNames.EMAIL_MARKETING,
]

export class EmailWorker extends BaseWorker<EmailQueueName> {
    constructor(
        queueName: EmailQueueName,
        private readonly emailService: EmailService = new EmailService(),
    ) {
        super({
            queueName,
            concurrency: emailWorkerConcurrency,
            limiter: emailLimiter,
        })
    }

    protected async processJob(job: Job<EmailJobPayload>): Promise<void> {
        await processSendEmailJob(job.data, this.emailService)
    }
}

/** Crea las 3 instancias. Recibe el EmailService para poder inyectar un stub en tests. */
export function createEmailWorkers(emailService: EmailService = new EmailService()): EmailWorker[] {
    return emailQueueNames.map((name) => new EmailWorker(name, emailService))
}

if (require.main === module) {
    const started = createEmailWorkers()
    logger.info(`[Workers] email workers started (${started.length} queues): ${emailQueueNames.join(', ')}`)
}
