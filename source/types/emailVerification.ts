export interface EmailVerificationRow {
    id: string
    userId: string
    token: string
    expiresAt: string
    usedAt: string | null
    createdAt: string
}

export interface InsertEmailVerificationParams {
    userId: string
    token: string
    expiresAt: Date | string
}

export interface EmailVerificationTokenLookup {
    token: string
    usedAt: string | null
}