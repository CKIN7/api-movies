import RefreshTokenRepository from "../repositories/RefreshTokenRepository";
import UserRepository from "../repositories/UserRepository";
import AppError from "../utils/AppError";
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import logger from "../utils/logger";
import { DEFAULT_ROLE } from "../types/user";
import { RefreshDTO } from "../schemas/auth";

class AuthService {
    constructor(
        private userRepository: UserRepository,
        private refreshTokenRepository: RefreshTokenRepository
    ) {}

    async login(email: string, password: string){
        try {
            const user = await this.userRepository.findByEmail(email);
            //Mismo error, así evitamos user enumeration
            if(!user) throw new AppError('La contraseña o el email es invalido', 401)
            
            const isValidPassword = await bcrypt.compare(password, user.passwordHash);
            if(!isValidPassword) throw new AppError('La contraseña o el email es invalido', 401)
            
            const accessToken = jwt.sign({sub: user.id, type: 'access'}, process.env.JWT_SECRET!, {expiresIn: '15min'})
            const refreshToken = jwt.sign({sub: user.id, type: 'refresh'}, process.env.JWT_REFRESH_SECRET!, {expiresIn: '7d'})

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
            
            return await this.userRepository.create({email, passwordHash, role: DEFAULT_ROLE });
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en register: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }

    async refreshToken(RefreshDTO: RefreshDTO) {
        try {
            
            let payload: { sub?: string; type?: string }
            try {
                payload = jwt.verify(RefreshDTO.refreshToken, process.env.JWT_REFRESH_SECRET!) as { sub?: string; type?: string }
            } catch {
                throw new AppError('Token inválido o expirado', 401)
            }
            
            if(payload.type !== 'refresh') throw new AppError('Token inválido o expirado', 401)
            
            const validToken = await this.refreshTokenRepository.findValid(RefreshDTO.refreshToken)
            if(validToken === null) {
                const token = await this.refreshTokenRepository.findByToken(RefreshDTO.refreshToken)
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
            const refreshToken = jwt.sign({sub: user?.id, type: 'refresh'}, process.env.JWT_REFRESH_SECRET!, {expiresIn: '7d'})
            
            await this.refreshTokenRepository.revoke(validToken.token);
            
            const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
            await this.refreshTokenRepository.create({userId: payload.sub, token: refreshToken, expiresAt})

            return {
                accessToken,
                refreshToken,
                user: {
                    id: user?.id,
                    email: user?.email, 
                    role: user?.role
                }
            }
            
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error en register: ${(error as Error).message}`)
            throw new AppError('Error interno', 500)
        }
    }
}

export default AuthService