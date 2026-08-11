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
    }
}

function buildService(repos: ReturnType<typeof createMockRepos>) {
    return new AuthService(
        repos.userRepository as any,
        repos.refreshTokenRepository as any,
        repos.emailVerificationRepository as any,
        repos.emailVerificationNotifier as any,
    )
}

describe('AuthService - verifyEmail', () => {
    test('token válido marca el email como verificado y el token como usado', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue('user-1')
        const service = buildService(repos)

        const result = await service.verifyEmail({ token: 'token-valido' })

        expect(result).toEqual({ message: 'Email verificado' })
        expect(repos.userRepository.markEmail).toHaveBeenCalledWith('user-1')
        expect(repos.emailVerificationRepository.markUsed).toHaveBeenCalledWith('token-valido')
    })

    test('token inexistente lanza 401 y no marca nada', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue(null)
        const service = buildService(repos)

        await expect(service.verifyEmail({ token: 'no-existe' }))
            .rejects.toMatchObject({ statusCode: 401 })
        expect(repos.userRepository.markEmail).not.toHaveBeenCalled()
        expect(repos.emailVerificationRepository.markUsed).not.toHaveBeenCalled()
    })

    test('token ya reutilizado lanza 401', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue({ token: 't', used_at: new Date() })
        const service = buildService(repos)

        await expect(service.verifyEmail({ token: 'reutilizado' }))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    test('token expirado (sin usar pero fuera de TTL) lanza 401', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockResolvedValue(null)
        repos.emailVerificationRepository.findByToken.mockResolvedValue({ token: 't', used_at: null })
        const service = buildService(repos)

        await expect(service.verifyEmail({ token: 'expirado' }))
            .rejects.toMatchObject({ statusCode: 401 })
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        repos.emailVerificationRepository.findValid.mockRejectedValue(new Error('db caida'))
        const service = buildService(repos)

        await expect(service.verifyEmail({ token: 'x' }))
            .rejects.toMatchObject({ statusCode: 500 })
    })
})