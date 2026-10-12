import AppError from "../utils/AppError";
import UserRepository from "../repositories/UserRepository";
import RefreshTokenRepository from "../repositories/RefreshTokenRepository";
import { Role, ROLE_RANK } from "../types/user";
import logger from "../utils/logger";

class UserService {
    constructor(
        private userRepository: UserRepository,
        private refreshTokenRepository: RefreshTokenRepository
    ) {}

    async updateRole(targetId: string, newRole: Role, actorId: string) {
        try {
            // Anti-lockout: un admin no puede cambiar su propio rol
            if (targetId === actorId) throw new AppError('No puedes cambiar tu propio rol', 400)

            const target = await this.userRepository.findById(targetId)
            if (!target) throw new AppError('Usuario no encontrado', 404)

            // Idempotente: si el rol ya es el solicitado, no toca nada
            if (target.role !== newRole) {
                await this.userRepository.updateRole(targetId, newRole)

                // Degradación: revoca las sesiones para no esperar al access token de 15 min
                if (ROLE_RANK[newRole] < ROLE_RANK[target.role as Role]) {
                    await this.refreshTokenRepository.revokeAllByUserId(targetId)
                }

                logger.info(`Rol cambiado: ${target.email} de '${target.role}' a '${newRole}' (actor: ${actorId})`)
            }

            return { id: target.id, email: target.email, role: newRole }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error cambiando rol: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }
}

export default UserService
