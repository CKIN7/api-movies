import AuthService from '../../services/authService'
import jwt from 'jsonwebtoken'

jest.mock('jsonwebtoken', () => ({
    sign: jest.fn(),
    verify: jest.fn(),
}))

const mockedSign = jwt.sign as jest.Mock
const mockedVerify = jwt.verify as jest.Mock

function createMockRepos() {
    return {
        userRepository: {
            findByEmail: jest.fn(),
            findById: jest.fn(),
            create: jest.fn(),
        },
        refreshTokenRepository: {
            create: jest.fn(),
            findValid: jest.fn(),
            findByToken: jest.fn(),
            revoke: jest.fn(),
            revokeAllByUserId: jest.fn(),
        },
    }
}

function revokedRow(revokedAt: string | null) {
    return {
        id: 'rt-1',
        userId: 'user-1',
        token: 'refresh-old',
        expiresAt: '2026-08-13 00:00:00',
        revokedAt,
        createdAt: '2026-08-06 00:00:00',
    }
}

describe('AuthService - refresh', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    test('refresca exitosamente, rota el token y devuelve user sin passwordHash', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        repos.refreshTokenRepository.findValid.mockResolvedValue(revokedRow(null))
        repos.userRepository.findById.mockResolvedValue({
            id: 'user-1',
            email: 'user@example.com',
            passwordHash: 'hash',
            role: 'user',
            createdAt: '2026-01-01 00:00:00',
        })
        mockedSign.mockReturnValueOnce('access-nuevo').mockReturnValueOnce('refresh-nuevo')
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        const result = await service.refresh('refresh-old')

        expect(result).toEqual({
            accessToken: 'access-nuevo',
            refreshToken: 'refresh-nuevo',
            user: { id: 'user-1', email: 'user@example.com', role: 'user' },
        })
        expect(result.user).not.toHaveProperty('passwordHash')
        expect(mockedVerify).toHaveBeenCalledWith('refresh-old', process.env.JWT_REFRESH_SECRET)
        expect(repos.refreshTokenRepository.findValid).toHaveBeenCalledWith('refresh-old')
        expect(repos.userRepository.findById).toHaveBeenCalledWith('user-1')
        expect(mockedSign).toHaveBeenCalledWith(
            { sub: 'user-1', type: 'access' }, expect.anything(), expect.any(Object))
        expect(mockedSign).toHaveBeenCalledWith(
            { sub: 'user-1', type: 'refresh' }, expect.anything(), expect.any(Object))
        expect(repos.refreshTokenRepository.revoke).toHaveBeenCalledWith('refresh-old')
        expect(repos.refreshTokenRepository.create).toHaveBeenCalledWith({
            userId: 'user-1',
            token: 'refresh-nuevo',
            expiresAt: expect.any(Date),
        })
    })

    test('token inválido o expirado lanza 401 y no consulta la DB', async () => {
        const repos = createMockRepos()
        mockedVerify.mockImplementation(() => { throw new Error('jwt expired') })
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('token-malo')).rejects.toMatchObject({ statusCode: 401 })
        expect(repos.refreshTokenRepository.findValid).not.toHaveBeenCalled()
        expect(repos.refreshTokenRepository.revoke).not.toHaveBeenCalled()
    })

    test('token de tipo access lanza 401 y no rota', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'access' })
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('access-token')).rejects.toMatchObject({ statusCode: 401 })
        expect(repos.refreshTokenRepository.findValid).not.toHaveBeenCalled()
        expect(repos.refreshTokenRepository.revoke).not.toHaveBeenCalled()
    })

    test('token sin sub lanza 401', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ type: 'refresh' })
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('sin-sub')).rejects.toMatchObject({ statusCode: 401 })
    })

    test('token revocado (reuso) lanza 401 y revoca TODAS las sesiones del user', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        repos.refreshTokenRepository.findValid.mockResolvedValue(null)
        repos.refreshTokenRepository.findByToken.mockResolvedValue(
            revokedRow('2026-08-07 00:00:00'))
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('refresh-old')).rejects.toMatchObject({ statusCode: 401 })
        expect(repos.refreshTokenRepository.findByToken).toHaveBeenCalledWith('refresh-old')
        expect(repos.refreshTokenRepository.revokeAllByUserId).toHaveBeenCalledWith('user-1')
    })

    test('token inexistente lanza 401 sin revocar sesiones', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        repos.refreshTokenRepository.findValid.mockResolvedValue(null)
        repos.refreshTokenRepository.findByToken.mockResolvedValue(null)
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('no-existe')).rejects.toMatchObject({ statusCode: 401 })
        expect(repos.refreshTokenRepository.revokeAllByUserId).not.toHaveBeenCalled()
    })

    test('envuelve errores inesperados del repositorio en AppError 500', async () => {
        const repos = createMockRepos()
        mockedVerify.mockReturnValue({ sub: 'user-1', type: 'refresh' })
        repos.refreshTokenRepository.findValid.mockRejectedValue(new Error('db caida'))
        const service = new AuthService(repos.userRepository as any, repos.refreshTokenRepository as any)

        await expect(service.refresh('refresh-old')).rejects.toMatchObject({ statusCode: 500 })
    })
})
