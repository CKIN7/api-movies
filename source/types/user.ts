export interface UserRow {
    id: string
    email: string
    passwordHash: string
    role: string
    createdAt: string
    emailVerified: boolean
    emailVerifiedAt: string | null
}

export interface InsertUserParams {
    email: string
    passwordHash: string
    role: string
}

export const DEFAULT_ROLE = 'user' as const

export const ROLES = ['admin', 'premium', 'user'] as const

export type Role = (typeof ROLES)[number]

export const ROLE_RANK: Record<Role, number> = {
    user: 0,
    premium: 1,
    admin: 2
}

export function isRole(value: unknown): value is Role {
    return typeof value === 'string' && (ROLES as readonly string[]).includes(value)
}