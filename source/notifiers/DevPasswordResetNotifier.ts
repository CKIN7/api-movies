import logger from "../utils/logger";
import PasswordResetNotifier from "./PasswordResetNotifier";

// ═══════════════════════════════════════════════════════════════
//  Patrón: Strategy (implementación dev)
// ═══════════════════════════════════════════════════════════════
//  Entrega el enlace de restablecimiento de contraseña sin red:
//  solo loguea la URL.
//  Para SMTP real: nueva clase que implemente PasswordResetNotifier
//  y swap en api.ts (sin tocar service/repos/tests — OCP).
// ═══════════════════════════════════════════════════════════════

const APP_URL = process.env.APP_URL ?? 'http://localhost:8089'

class DevPasswordResetNotifier implements PasswordResetNotifier {
    async sendResetEmail(to: string, resetToken: string): Promise<void> {
        logger.info(`[DEV] Restablece tu contraseña ${to}: ${APP_URL}/auth/reset/${resetToken}`)
    }
}

export default DevPasswordResetNotifier