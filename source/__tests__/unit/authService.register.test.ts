import AuthService from '../../services/authService'
import AppError from '../../utils/AppError'
import logger from '../../utils/logger'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
    compare: jest.fn(),
}))

const mockedHash = bcrypt.hash as jest.Mock

function createMockRepos() {
    return {
        userRepository: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            markEmail: jest.fn(),
        },
        refreshTokenRepository: {
            create: jest.fn(),
            findValid: jest.fn(),
            revoke: jest.fn(),
            revokeAllByUserId: jest.fn(),
        },
        emailVerificationRepository: {
            create: jest.fn(),
            findValid: jest.fn(),
            findByToken: jest.fn(),
            markUsed: jest.fn(),
            revokeAllByUserId: jest.fn(),
            transaction: jest.fn(async (fn: () => Promise<unknown>) => fn()),
        },
        emailVerificationNotifier: {
            sendVerificationEmail: jest.fn(),
        },
        passwordResetNotifier: {
            sendResetEmail: jest.fn(),
        },
    }
}

function buildService(repos: ReturnType<typeof createMockRepos>) {
    return new AuthService(
        repos.userRepository as any,
        repos.refreshTokenRepository as any,
        repos.emailVerificationRepository as any,
        repos.emailVerificationNotifier as any,
        repos.passwordResetNotifier as any,
    )
}

describe('AuthService - register', () => {
    test('registra exitosamente, crea la verificación y notifica sin passwordHash', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('hashed-password')
        repos.userRepository.findByEmail.mockResolvedValue(null)
        repos.userRepository.create.mockResolvedValue({ id: 'uuid-123', email: 'nuevo@example.com', role: 'user' })
        const service = buildService(repos)

        const result = await service.register('nuevo@example.com', 'Password123!')

        expect(result).toEqual({ id: 'uuid-123', email: 'nuevo@example.com', role: 'user' })
        expect(result).not.toHaveProperty('passwordHash')
        expect(mockedHash).toHaveBeenCalledWith('Password123!', 10)
        expect(repos.emailVerificationRepository.transaction).toHaveBeenCalledTimes(1)
        expect(repos.userRepository.create).toHaveBeenCalledWith({
            email: 'nuevo@example.com',
            passwordHash: 'hashed-password',
            role: 'user',
        })
        expect(repos.emailVerificationRepository.create).toHaveBeenCalledWith({
            userId: 'uuid-123',
            token: expect.any(String),
            expiresAt: expect.any(Date),
        })
        expect(repos.emailVerificationNotifier.sendVerificationEmail).toHaveBeenCalledWith(
            'nuevo@example.com',
            expect.any(String),
        )
    })

    test('lanza AppError 409 si el email ya existe y no crea el usuario', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue({ id: 'x', email: 'nuevo@example.com', passwordHash: 'h', role: 'user', createdAt: '' })
        const service = buildService(repos)

        await expect(service.register('nuevo@example.com', 'Password123!'))
            .rejects.toMatchObject({ statusCode: 409 })
        expect(repos.userRepository.create).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(null)
        repos.userRepository.create.mockRejectedValue(new Error('db caida'))
        const service = buildService(repos)

        await expect(service.register('nuevo@example.com', 'Password123!'))
            .rejects.toMatchObject({ statusCode: 500 })
    })

    test('si falla el INSERT de verificación, la transacción aborta y no notifica', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('hashed-password')
        repos.userRepository.findByEmail.mockResolvedValue(null)
        repos.userRepository.create.mockResolvedValue({ id: 'uuid-123', email: 'nuevo@example.com', role: 'user' })
        repos.emailVerificationRepository.transaction.mockRejectedValue(new Error('rollback'))
        const service = buildService(repos)

        await expect(service.register('nuevo@example.com', 'Password123!'))
            .rejects.toMatchObject({ statusCode: 500 })
        expect(repos.emailVerificationNotifier.sendVerificationEmail).not.toHaveBeenCalled()
    })

    test('un fallo del notificador no rompe el registro (best-effort)', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('hashed-password')
        repos.userRepository.findByEmail.mockResolvedValue(null)
        repos.userRepository.create.mockResolvedValue({ id: 'uuid-123', email: 'nuevo@example.com', role: 'user' })
        repos.emailVerificationNotifier.sendVerificationEmail.mockRejectedValue(new Error('redis caido'))
        const errorSpy = jest.spyOn(logger, 'error').mockImplementation(() => logger)
        const service = buildService(repos)

        const result = await service.register('nuevo@example.com', 'Password123!')

        expect(result).toEqual({ id: 'uuid-123', email: 'nuevo@example.com', role: 'user' })
        expect(errorSpy).toHaveBeenCalledWith(
            expect.stringContaining('No se pudo enviar verificación a uuid-123'),
        )
        errorSpy.mockRestore()
    })

    test('mapea ER_DUP_ENTRY a 409 (carrera de emails)', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('hashed-password')
        repos.userRepository.findByEmail.mockResolvedValue(null)
        repos.emailVerificationRepository.transaction.mockRejectedValue(
            Object.assign(new Error('dup'), { code: 'ER_DUP_ENTRY' }),
        )
        const service = buildService(repos)

        await expect(service.register('nuevo@example.com', 'Password123!'))
            .rejects.toMatchObject({ statusCode: 409 })
    })
})
