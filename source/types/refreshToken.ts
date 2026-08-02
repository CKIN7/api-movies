export interface RefreshTokenRow {
    id: string 
    userId: string 
    token: string 
    expiresAt: string 
    revokedAt: string | null 
    createdAt: string
}

export interface InsertRefreshTokenParams {
    userId: string
    token: string
    expiresAt: Date | string
}