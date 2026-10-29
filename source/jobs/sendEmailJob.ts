import type EmailService from '../services/EmailService'
import type { EmailMessage } from '../services/EmailService'

// ═══════════════════════════════════════════════════════════════
//  F2: handler del job de email
// ═══════════════════════════════════════════════════════════════
//  El worker no sabe de Resend ni de templates: recibe el payload
//  `{ template, to, data }` y delega en EmailService. Los reintentos
//  (attempts 3 + backoff exponencial) los aplica `defaultJobOptions`.
// ═══════════════════════════════════════════════════════════════

export type SendEmailJobPayload = EmailMessage

export async function processSendEmailJob(
    payload: SendEmailJobPayload,
    emailService: EmailService,
): Promise<void> {
    await emailService.send(payload)
}
