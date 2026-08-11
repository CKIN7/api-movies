import AuthService from '../../services/authService'
import AppError from '../../utils/AppError'
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
})
