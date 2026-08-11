import logger from "../utils/logger";
import EmailVerificationNotifier from "./EmailVerificationNotifier";

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy (implementación dev)
// ═══════════════════════════════════════════════════════════════
//  Entrega el enlace de verificación sin red: solo loguea la URL.
//  Para SMTP real: nueva clase que implemente EmailVerificationNotifier
//  y swap en api.ts (sin tocar service/repos/tests — OCP).
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.APP_URL ?? 'http://localhost:8089'

class DevEmailVerificationNotifier implements EmailVerificationNotifier {
    async sendVerificationEmail(to: string, verificationToken: string): Promise<void> {
        logger.info(`[DEV] Verifica tu cuenta ${to}: ${APP_URL}/auth/verify/${verificationToken}`)
    }
}

export default DevEmailVerificationNotifier