import { requireAuth } from '../../middleware/requireAuth'
import AppError from '../../utils/AppError'
import { authHeader, expiredAuthHeader, TEST_USER_ID } from '../helpers/auth'
import jwt from 'jsonwebtoken'
import type { Request, Response } from 'express'

function mockReq(header?: string): Request {
    return { headers: header ? { authorization: header } : {} } as Request
}

function expect401(fn: () => void): void {
    try {
        fn()
        throw new Error('no lanzó ningún error')
    } catch (e) {
        expect(e).toBeInstanceOf(AppError)
        expect((e as AppError).statusCode).toBe(401)
    }
}

describe('requireAuth', () => {
    test('con token válido adjunta req.user y llama next()', () => {
        const req = mockReq(authHeader().Authorization)
        const res = {} as Response
        const next = jest.fn()

        requireAuth(req, res, next)

        expect(req.user).toEqual({ id: TEST_USER_ID, role: 'admin' })
        expect(next).toHaveBeenCalledTimes(1)
    })

    test('adjunta el rol del claim a req.user', () => {
        const req = mockReq(authHeader(TEST_USER_ID, 'access', 'user').Authorization)

        requireAuth(req, {} as Response, jest.fn())

        expect(req.user).toEqual({ id: TEST_USER_ID, role: 'user' })
    })

    test('token sin claim role lanza 401', () => {
        const token = jwt.sign({ sub: TEST_USER_ID, type: 'access' }, process.env.JWT_SECRET!, { expiresIn: '15min' })
        expect401(() => requireAuth(mockReq(`Bearer ${token}`), {} as Response, jest.fn()))
    })

    test('token con rol desconocido lanza 401', () => {
        const token = jwt.sign({ sub: TEST_USER_ID, type: 'access', role: 'superadmin' }, process.env.JWT_SECRET!, { expiresIn: '15min' })
        expect401(() => requireAuth(mockReq(`Bearer ${token}`), {} as Response, jest.fn()))
    })

    test('sin header Authorization lanza 401', () => {
        expect401(() => requireAuth(mockReq(), {} as Response, jest.fn()))
    })

    test('header sin prefijo "Bearer " lanza 401', () => {
        expect401(() => requireAuth(mockReq('Token-suelto'), {} as Response, jest.fn()))
    })

    test('token vacío ("Bearer ") lanza 401', () => {
        expect401(() => requireAuth(mockReq('Bearer '), {} as Response, jest.fn()))
    })

    test('token malformado lanza 401', () => {
        expect401(() => requireAuth(mockReq('Bearer no-es-un-jwt'), {} as Response, jest.fn()))
    })

    test('token expirado lanza 401', () => {
        expect401(() => requireAuth(mockReq(expiredAuthHeader().Authorization), {} as Response, jest.fn()))
    })

    test('token de tipo refresh lanza 401', () => {
        expect401(() => requireAuth(mockReq(authHeader(TEST_USER_ID, 'refresh').Authorization), {} as Response, jest.fn()))
    })

    test('token de tipo inesperado lanza 401', () => {
        expect401(() => requireAuth(mockReq(authHeader(TEST_USER_ID, 'foo').Authorization), {} as Response, jest.fn()))
    })

    test('token sin sub lanza 401', () => {
        const token = jwt.sign({ type: 'access' }, process.env.JWT_SECRET!, { expiresIn: '15min' })
        expect401(() => requireAuth(mockReq(`Bearer ${token}`), {} as Response, jest.fn()))
    })

    test('en caso de error no llama a next()', () => {
        const next = jest.fn()
        expect401(() => requireAuth(mockReq('Bearer '), {} as Response, next))
        expect(next).not.toHaveBeenCalled()
    })
})