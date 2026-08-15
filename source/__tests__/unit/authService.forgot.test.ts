import AuthService from '../../services/authService'

const GENERIC_MESSAGE = 'Si el email está registrado y verificado, recibirás un enlace para restablecer tu contraseña'

const verifiedUser = {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'h',
    role: 'user',
    emailVerified: true,
}

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
        },
        emailVerificationNotifier: {
            sendVerificationEmail: jest.fn(),
        },
        passwordResetNotifier: {
            sendResetEmail: jest.fn(),
        },
    }
}

function buildService(repos: ReturnType<typeof createMockRepos>, cooldownMinutes = 0) {
    return new AuthService(
        repos.userRepository as any,
        repos.refreshTokenRepository as any,
        repos.emailVerificationRepository as any,
        repos.emailVerificationNotifier as any,
        repos.passwordResetNotifier as any,
        cooldownMinutes,
    )
}

describe('AuthService - forgotPassword', () => {
    test('email no registrado devuelve mensaje genérico sin efectos secundarios', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(null)
        const service = buildService(repos)

        const result = await service.forgotPassword({ email: 'nadie@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.passwordResetNotifier.sendResetEmail).not.toHaveBeenCalled()
    })

    test('email sin verificar devuelve mensaje genérico sin efectos secundarios', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue({ ...verifiedUser, emailVerified: false })
        const service = buildService(repos)

        const result = await service.forgotPassword({ email: 'pendiente@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.passwordResetNotifier.sendResetEmail).not.toHaveBeenCalled()
    })

    test('Guard B: cooldown activo bloquea sin regenerar ni reenviar', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(verifiedUser)
        repos.emailVerificationRepository.hasRecentResetRequest.mockResolvedValue(true)
        const service = buildService(repos, 2)

        const result = await service.forgotPassword({ email: 'user@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.passwordResetNotifier.sendResetEmail).not.toHaveBeenCalled()
    })

    test('Guard B: cooldown desactivado (0) no consulta hasRecentResetRequest', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(verifiedUser)
        repos.emailVerificationRepository.findActiveTokenByUserId.mockResolvedValue(false)
        const service = buildService(repos, 0)

        await service.forgotPassword({ email: 'user@example.com' })

        expect(repos.emailVerificationRepository.hasRecentResetRequest).not.toHaveBeenCalled()
    })

    test('Guard A: token vigente bloquea sin reemplazar el link', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(verifiedUser)
        repos.emailVerificationRepository.hasRecentResetRequest.mockResolvedValue(false)
        repos.emailVerificationRepository.findActiveTokenByUserId.mockResolvedValue(true)
        const service = buildService(repos)

        const result = await service.forgotPassword({ email: 'user@example.com' })

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.create).not.toHaveBeenCalled()
        expect(repos.passwordResetNotifier.sendResetEmail).not.toHaveBeenCalled()
    })

    test('sin bloqueos genera token con TTL de 5 min, revoca huérfanos y notifica', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockResolvedValue(verifiedUser)
        repos.emailVerificationRepository.hasRecentResetRequest.mockResolvedValue(false)
        repos.emailVerificationRepository.findActiveTokenByUserId.mockResolvedValue(false)
        const service = buildService(repos)

        const before = Date.now()
        const result = await service.forgotPassword({ email: 'user@example.com' })
        const after = Date.now()

        expect(result).toEqual({ message: GENERIC_MESSAGE })
        expect(repos.emailVerificationRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1')
        expect(repos.emailVerificationRepository.create).toHaveBeenCalledTimes(1)

        const created = repos.emailVerificationRepository.create.mock.calls[0][0]
        expect(created.userId).toBe('user-1')
        expect(created.token).toEqual(expect.any(String))
        const expires = created.expiresAt.getTime()
        expect(expires).toBeGreaterThanOrEqual(before + 5 * 60 * 1000)
        expect(expires).toBeLessThanOrEqual(after + 5 * 60 * 1000)

        expect(repos.passwordResetNotifier.sendResetEmail).toHaveBeenCalledWith('user@example.com', created.token)
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        repos.userRepository.findByEmail.mockRejectedValue(new Error('db caida'))
        const service = buildService(repos)

        await expect(service.forgotPassword({ email: 'user@example.com' }))
            .rejects.toMatchObject({ statusCode: 500 })
    })
})