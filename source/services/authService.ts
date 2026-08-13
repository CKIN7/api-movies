import RefreshTokenRepository from "../repositories/RefreshTokenRepository";
import UserRepository from "../repositories/UserRepository";
import AppError from "../utils/AppError";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from "../utils/logger";
import { randomUUID } from 'crypto';
import { DEFAULT_ROLE } from "../types/user";
import EmailVerificationRepository from "../repositories/EmailVerificationRepository";
import { ForgotDTO, ResendVerificationDTO, ResetDTO, VerifyEmailDTO } from "../schemas/auth";
import EmailVerificationNotifier from "../notifiers/EmailVerificationNotifier";
import PasswordResetNotifier from "../notifiers/PasswordResetNotifier";

class AuthService {
    constructor(
        private userRepository: UserRepository,
        private refreshTokenRepository: RefreshTokenRepository,
        private emailVerificationRepository: EmailVerificationRepository,
        private emailVerificationNotifier: EmailVerificationNotifier,
        private passwordResetNotifier: PasswordResetNotifier,
        private resetCooldownMinutes: number = 2
    ) {}

    async login(email: string, password: string){
        try {
            const user = await this.userRepository.findByEmail(email);
            //Mismo error, así evitamos user enumeration
            if(!user) throw new AppError('La contraseña o el email es invalido', 401)
            
            
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if(!isValidPassword) throw new AppError('La contraseña o el email es invalido', 401)
            
            if(user.emailVerified === false) throw new AppError('Verifica tu email antes de iniciar sesión', 403)
            
            const accessToken = jwt.sign({sub: user.id, type: 'access'}, process.env.JWT_SECRET!, {expiresIn: '15min'})
            const refreshToken = jwt.sign({sub: user.id, type: 'refresh', jti: randomUUID()}, process.env.JWT_REFRESH_SECRET!, {expiresIn: '7d'})

            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

            await this.refreshTokenRepository.create({userId: user.id, token: refreshToken, expiresAt})

            return {
                accessToken,
                refreshToken,
                user: {
                    id: user.id,
                    email: user.email, 
                    role: user.role
                }
            }
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en login: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }

    async register(email: string, password: string){
        try {

            const existingUser = await this.userRepository.findByEmail(email)
            if(existingUser) throw new AppError('El email ya está registrado', 409);

            const passwordHash = await bcrypt.hash(password, 10);
            
            // El valor emailVerified lo define la BD (DEFAULT 0): todo usuario nuevo nace sin verificar.
            const newUser = await this.userRepository.create({email, passwordHash, role: DEFAULT_ROLE });

            const verificationToken = randomUUID();
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)   // 24 horas (TTL verificación)

            await this.emailVerificationRepository.create({
                userId: newUser.id, 
                token: verificationToken, 
                expiresAt
            })

            await this.emailVerificationNotifier.sendVerificationEmail(newUser.email, verificationToken)

            return newUser

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en register: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }

    async refresh(refreshToken: string) {
        try {
            
            let payload: { sub?: string; type?: string }
            try {
                payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub?: string; type?: string }
            } catch {
                throw new AppError('Token inválido o expirado', 401)
            }
            
            if(payload.type !== 'refresh') throw new AppError('Token inválido o expirado', 401)
            
            const validToken = await this.refreshTokenRepository.findValid(refreshToken)
            if(validToken === null) {
                const token = await this.refreshTokenRepository.findByToken(refreshToken)
                if(!token) throw new AppError('Token no existe', 401)
                if(token.revokedAt != null){
                    await this.refreshTokenRepository.revokeAllByUserId(token.userId)
                    throw new AppError('Token reutilizado', 401)
                }

                // caso expirado: fila existe pero revokedAt == null
                // vencimiento natural → solo 401, sin revocar nada
                throw new AppError('Token inválido o expirado', 401)
                
            }

            if(!payload.sub) throw new AppError('Token inválido', 401)
            const user = await this.userRepository.findById(payload.sub)

            const accessToken = jwt.sign({sub: user?.id, type: 'access'}, process.env.JWT_SECRET!, {expiresIn: '15min'})
            const newRefreshToken = jwt.sign({sub: user?.id, type: 'refresh', jti: randomUUID()}, process.env.JWT_REFRESH_SECRET!, {expiresIn: '7d'})
            
            await this.refreshTokenRepository.revoke(validToken.token);
            
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            await this.refreshTokenRepository.create({userId: payload.sub, token: newRefreshToken, expiresAt})

            return {
                accessToken,
                refreshToken: newRefreshToken,
                user: {
                    id: user?.id,
                    email: user?.email, 
                    role: user?.role
                }
            }
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en refresh: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }

    async logout(refreshToken: string) {
        try {
            
            let payload: { sub?: string; type?: string }
            try {
                payload = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub?: string; type?: string }
            } catch (error) {
              throw new AppError('Token inválido o expirado', 401)
            }

            if(payload.type !== 'refresh') throw new AppError('Token inválido o expirado', 401)
            if(!payload.sub) throw new AppError('Token inválido o expirado', 401)
            
            await this.refreshTokenRepository.revokeAllByUserId(payload.sub)
            
            return {
                message: "Sesión Cerrada"
            }
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en logout: ${(error as Error).message}`)
            throw new AppError('Error interno', 500) 
        }
    }

    async verifyEmail(param: VerifyEmailDTO){
        try {
            const userId = await this.emailVerificationRepository.findValid(param.token)
            if(userId === null){

                const verification = await this.emailVerificationRepository.findByToken(param.token)
                if(!verification) throw new AppError('Token no existe', 401)
                
                if(verification.usedAt !== null) throw new AppError('Token reutilizado', 401)
                
                throw new AppError('Token inválido o expirado', 401)
            }

            await this.userRepository.markEmail(userId)

            await this.emailVerificationRepository.markUsed(param.token)

            return {message: 'Email verificado'}

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en verifyEmail: ${(error as Error).message}`)
            throw new AppError('Error interno', 500) 
        }
    }

    async resendVerification(dto: ResendVerificationDTO){
        try {
            const RESEND_GENERIC_MESSAGE = 'Si el email está registrado y no verificado, recibirás un nuevo enlace de verificación'

            const user = await this.userRepository.findByEmail(dto.email)
            if(!user || user.emailVerified === true){
                return {message: RESEND_GENERIC_MESSAGE}
            }

            await this.emailVerificationRepository.revokeAllByUserId(user.id)

            const verificationToken = randomUUID()
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000)

            await this.emailVerificationRepository.create({userId: user.id, token: verificationToken, expiresAt})

            await this.emailVerificationNotifier.sendVerificationEmail(user.email, verificationToken)

            return {message: RESEND_GENERIC_MESSAGE}

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en resendVerification: ${(error as Error).message}`)
            throw new AppError('Error interno', 500) 
        }
    }

    async forgotPassword(dto: ForgotDTO){
        try {
            const FORGOT_GENERIC_MESSAGE = 'Si el email está registrado y verificado, recibirás un enlace para restablecer tu contraseña'

            const user = await this.userRepository.findByEmail(dto.email)
            if(!user || user.emailVerified === false) {
                return {message: FORGOT_GENERIC_MESSAGE}
            }

            if(this.resetCooldownMinutes > 0
            && await this.emailVerificationRepository.hasRecentResetRequest(user.id, this.resetCooldownMinutes))
            {return {message: FORGOT_GENERIC_MESSAGE}}

            if(await this.emailVerificationRepository.findActiveTokenByUserId(user.id)) return {message: FORGOT_GENERIC_MESSAGE}


            await this.emailVerificationRepository.revokeAllByUserId(user.id)

            const passwordResetToken = randomUUID()
            const passwordResetTokenExpiresAt = new Date(Date.now() + 5 * 60 * 1000)
            
            await this.emailVerificationRepository.create({
                userId: user.id,
                token: passwordResetToken,
                expiresAt: passwordResetTokenExpiresAt
            })

            await this.passwordResetNotifier.sendResetEmail(user.email, passwordResetToken)

            return {message: FORGOT_GENERIC_MESSAGE}

        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en forgotPassword: ${(error as Error).message}`)
            throw new AppError('Error interno', 500) 
        }
    }

    async resetPassword(dto: ResetDTO){
        try {
            const userId = await this.emailVerificationRepository.findValid(dto.token)
            if(userId === null){

                const token = await this.emailVerificationRepository.findByToken(dto.token)
                if(!token) throw new AppError('Token no existe', 401)
                if(token.usedAt !== null) throw new AppError('Token reutilizado', 401)
                
                throw new AppError('Token inválido o expirado', 401)
            }

            const passwordHash = await bcrypt.hash(dto.newPassword, 10);
            
            return await this.emailVerificationRepository.transaction(async () => {

                await this.userRepository.updatePassword(passwordHash, userId)

                await this.emailVerificationRepository.markUsed(dto.token)

                await this.refreshTokenRepository.revokeAllByUserId(userId)

                return {message: "Contraseña actualizada"}
            })
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en resetPassword: ${(error as Error).message}`)
            throw new AppError('Error interno', 500) 
        }
    }
}

export default AuthService