export interface UserRow {
    id: string
    email: string
    passwordHash: string
    role: string
    createdAt: string
}

export interface InsertUserParams {
    email: string
    passwordHash: string
    role: string
}

export const DEFAULT_ROLE = 'user' as const