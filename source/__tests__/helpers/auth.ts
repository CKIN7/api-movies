import jwt from 'jsonwebtoken'
import dotenv from 'dotenv'
import path from 'path'

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

export const TEST_USER_ID = 'cfd74902-7d20-4653-bdf6-759bb4947956'

export function authHeader(sub: string = TEST_USER_ID, type: string = 'access'): { Authorization: string } {
    const token = jwt.sign({ sub, type }, process.env.JWT_SECRET!, { expiresIn: '15min' })
    return { Authorization: `Bearer ${token}` }
}

export function expiredAuthHeader(): { Authorization: string } {
    const token = jwt.sign({ sub: TEST_USER_ID, type: 'access' }, process.env.JWT_SECRET!, { expiresIn: '-10s' })
    return { Authorization: `Bearer ${token}` }
}
