import AuthService from '../../services/authService'
import jwt from 'jsonwebtoken'

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn(),
}))

const mockedVerify = jwt.verify as jest.Mock

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

describe('AuthService - logout', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('cierra sesión revocando TODAS las sesiones del user', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        const service = buildService(repos)

        await service.logout('refresh-token')

        expect(mockedVerify).toHaveBeenCalledWith('refresh-token', process.env.JWT_REFRESH_SECRET)
        expect(repos.refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1')
    })

    test('token inválido lanza 401 y no revoca nada', async () => {
        const repos = createMockRepos()
        mockedVerify.mockImplementation(() => { throw new Error('invalid signature') })
        const service = buildService(repos)

        await expect(service.logout('token-malo')).rejects.toMatchObject({ statusCode: 401 })
        expect(repos.refreshTokenRepository.revokeAllByUserId).not.toHaveBeenCalled()
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        repos.refreshTokenRepository.revokeAllByUserId.mockRejectedValue(new Error('db caida'))
        const service = buildService(repos)

        await expect(service.logout('refresh-token')).rejects.toMatchObject({ statusCode: 500 })
    })
})
