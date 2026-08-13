import AuthService from '../../services/authService'

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

const GENERIC_MESSAGE = 'Si el email está registrado y no verificado, recibirás un nuevo enlace de verificación'

describe('AuthService - resendVerification', () => {
    test('email inexistente devuelve el mensaje genérico sin reenviar ni crear token', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(null)
        const service = buildService(repos)

        const result = await service.resendVerification({ email: 'nadie@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.emailVerificationNotifier.sendVerificationEmail).not.toHaveBeenCalled()
    })

    test('email ya verificado devuelve el mensaje genérico sin reenviar', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue({
            id: 'user-1',
            email: 'verificado@example.com',
            passwordHash: 'h',
            role: 'user',
            emailVerified: true,
        })
        const service = buildService(repos)

        const result = await service.resendVerification({ email: 'verificado@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.emailVerificationNotifier.sendVerificationEmail).not.toHaveBeenCalled()
    })

    test('email sin verificar revoca los tokens viejos, crea uno nuevo y notifica', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue({
            id: 'user-1',
            email: 'pendiente@example.com',
            passwordHash: 'h',
            role: 'user',
            emailVerified: false,
        })
        const service = buildService(repos)

        const result = await service.resendVerification({ email: 'pendiente@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1')
        expect(repos.emailVerificationRepository.create).toHaveBeenCalledWith({
            userId: 'user-1',
            token: expect.any(String),
            expiresAt: expect.any(Date),
        })

        const createdToken = repos.emailVerificationRepository.create.mock.calls[0][0].token
        expect(repos.emailVerificationNotifier.sendVerificationEmail).toHaveBeenCalledWith(
            'pendiente@example.com',
            createdToken,
        )
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue({
            id: 'user-1',
            email: 'pendiente@example.com',
            passwordHash: 'h',
            role: 'user',
            emailVerified: false,
        })
        repos.emailVerificationRepository.create.mockRejectedValue(new Error('db caida'))
        const service = buildService(repos)

        await expect(service.resendVerification({ email: 'pendiente@example.com' }))
            .rejects.toMatchObject({ statusCode: 500 })
    })
})