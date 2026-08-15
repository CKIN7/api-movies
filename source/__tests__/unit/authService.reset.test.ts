import AuthService from '../../services/authService'
import bcrypt from 'bcryptjs'

jest.mock('bcryptjs', () => ({
    hash: jest.fn(),
}))

const mockedHash = bcrypt.hash as jest.Mock

function createMockRepos() {
    return {
        userRepository: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
            markEmail: jest.fn(),
            updatePassword: jest.fn(),
        },
        refreshTokenRepository: {
            create: jest.fn(),
            findValid: jest.fn(),
            findByToken: jest.fn(),
            revoke: jest.fn(),
            revokeAllByUserId: jest.fn(),
        },
        emailVerificationRepository: {
            create: jest.fn(),
            findValid: jest.fn(),
            findByToken: jest.fn(),
            markUsed: jest.fn(),
            revokeAllByUserId: jest.fn(),
            hasRecentResetRequest: jest.fn(),
            findActiveTokenByUserId: jest.fn(),
            transaction: jest.fn((fn: () => unknown) => fn()),
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

describe('AuthService - resetPassword', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('token válido actualiza el hash, marca el token usado y revoca las sesiones', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('nuevo-hash')
        repos.emailVerificationRepository.findValid.mockResolvedValue('user-1')
        const service = buildService(repos)

        const result = await service.resetPassword({ token: 'token-valido', newPassword: 'NuevaPass123!' })

        expect(result).toEqual({ message: 'Contraseña actualizada' })
        expect(mockedHash).toHaveBeenCalledWith('NuevaPass123!', 10)
        expect(repos.userRepository.updatePassword).toHaveBeenCalledWith('nuevo-hash', 'user-1')
        expect(repos.emailVerificationRepository.markUsed).toHaveBeenCalledWith('token-valido')
        expect(repos.refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1')
    })

    test('token inexistente lanza 401 y no toca nada', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue(null)
        const service = buildService(repos)

        await expect(service.resetPassword({ token: 'no-existe', newPassword: 'NuevaPass123!' }))
            .rejects.toMatchObject({ statusCode: 401 })
        expect(repos.userRepository.updatePassword).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.markUsed).not.toHaveBeenCalled()
        expect(repos.refreshTokenRepository.revokeAllByUserId).not.toHaveBeenCalled()
    })

    test('token reutilizado lanza 401', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue({ token: 't', usedAt: new Date() })
        const service = buildService(repos)

        await expect(service.resetPassword({ token: 'reutilizado', newPassword: 'NuevaPass123!' }))
            .rejects.toMatchObject({ statusCode: 401 })
        expect(repos.userRepository.updatePassword).not.toHaveBeenCalled()
    })

    test('token expirado lanza 401', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue({ token: 't', usedAt: null })
        const service = buildService(repos)

        await expect(service.resetPassword({ token: 'expirado', newPassword: 'NuevaPass123!' }))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    test('error dentro de la transacción se envuelve en AppError 500', async () => {
        const repos = createMockRepos()
        mockedHash.mockResolvedValue('nuevo-hash')
        repos.emailVerificationRepository.findValid.mockResolvedValue('user-1')
        repos.emailVerificationRepository.transaction.mockImplementation(() => {
            throw new Error('db caida')
        })
        const service = buildService(repos)

        await expect(service.resetPassword({ token: 'x', newPassword: 'NuevaPass123!' }))
            .rejects.toMatchObject({ statusCode: 500 })
    })
})