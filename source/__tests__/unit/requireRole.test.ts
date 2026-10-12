import { requireRole } from '../../middleware/requireRole'
import AppError from '../../utils/AppError'
import type { Role } from '../../types/user'
import type { Request, Response } from 'express'

function mockReq(role?: Role): Request {
    return (role ? { user: { id: 'user-1', role } } : { user: undefined }) as Request
}

function expectStatus(fn: () => void, status: number): void {
    try {
        fn()
        throw new Error('no lanzó ningún error')
    } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).statusCode).toBe(status)
    }
}

describe('requireRole', () => {
    test('admin pasa requireRole("admin")', () => {
        const next = jest.fn()
        requireRole('admin')(mockReq('admin'), {} as Response, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    test('premium no pasa requireRole("admin") → 403', () => {
        expectStatus(() => requireRole('admin')(mockReq('premium'), {} as Response, jest.fn()), 403)
    })

    test('user no pasa requireRole("admin") → 403', () => {
        expectStatus(() => requireRole('admin')(mockReq('user'), {} as Response, jest.fn()), 403)
    })

    test('premium pasa requireRole("premium")', () => {
        const next = jest.fn()
        requireRole('premium')(mockReq('premium'), {} as Response, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    test('admin pasa requireRole("premium") por jerarquía', () => {
        const next = jest.fn()
        requireRole('premium')(mockReq('admin'), {} as Response, next)
        expect(next).toHaveBeenCalledTimes(1)
    })

    test('user no pasa requireRole("premium") → 403', () => {
        expectStatus(() => requireRole('premium')(mockReq('user'), {} as Response, jest.fn()), 403)
    })

    test('cualquier rol pasa requireRole("user")', () => {
        for (const role of ['user', 'premium', 'admin'] as const) {
            const next = jest.fn()
            requireRole('user')(mockReq(role), {} as Response, next)
            expect(next).toHaveBeenCalledTimes(1)
        }
    })

    test('sin req.user → 401', () => {
        expectStatus(() => requireRole('admin')(mockReq(), {} as Response, jest.fn()), 401)
    })

    test('en caso de error no llama a next()', () => {
        const next = jest.fn()
        expectStatus(() => requireRole('admin')(mockReq('user'), {} as Response, next), 403)
        expect(next).not.toHaveBeenCalled()
    })
})
