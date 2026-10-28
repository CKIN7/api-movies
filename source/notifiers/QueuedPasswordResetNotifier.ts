import PasswordResetNotifier from './PasswordResetNotifier'
import { enqueueEmail } from '../queues/emailQueue'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy (implementación productora, F2)
// ═══════════════════════════════════════════════════════════════
//  Sustituye a DevPasswordResetNotifier en api.ts. Encola el reset en
//  `email-critical`; la entrega real corre en el worker-email.
//
//  Igual que el notificador de verificación, no atrapa errores: el
//  service es el dueño de la semántica best-effort.
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.APP_URL ?? 'http://localhost:8089'

class QueuedPasswordResetNotifier implements PasswordResetNotifier {
    async sendResetEmail(to: string, resetToken: string): Promise<void> {
        await enqueueEmail(
            'critical',
            {
                template: 'password-reset',
                to,
                data: { url: `${APP_URL}/auth/reset/${resetToken}`, expiresInMinutes: 5 },
            },
            { jobId: `password-reset:${resetToken}` },
        )
    }
}

export default QueuedPasswordResetNotifier
