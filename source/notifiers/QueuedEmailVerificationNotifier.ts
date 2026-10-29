import EmailVerificationNotifier from './EmailVerificationNotifier'
import { enqueueEmail } from '../queues/emailQueue'

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy (implementación productora, F2)
// ═══════════════════════════════════════════════════════════════
//  Sustituye a DevEmailVerificationNotifier en api.ts. No entrega el
//  correo: lo encola en `email-critical` con el template de
//  verificacion. La entrega real corre en el worker-email.
//
//  No atrapa errores a proposito: quien decide que el fallo es no
//  fatal es el service (register/resend), que loguea y responde 201.
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.APP_URL ?? 'http://localhost:8089'

class QueuedEmailVerificationNotifier implements EmailVerificationNotifier {
    async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
        await enqueueEmail(
            'critical',
            {
                template: 'verification',
                to,
                data: { url: `${APP_URL}/auth/verify/${verificationToken}` },
            },
            // BullMQ rechaza ":" en jobId salvo el formato legado de 3 partes
            // (`Custom Id cannot contain :`), por eso separamos con "-".
            { jobId: `verification-${verificationToken}` },
        )
    }
}

export default QueuedEmailVerificationNotifier
