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

export interface UserPreferencesRow {
    user_id: string
    favorite_genres: string | number[] | null
    favorite_directors: string | number[] | null
    favorite_actors: string | number[] | null
    genre_affinity: string | Record<string, number> | null
    updated_at: string
}

export interface UserPreferencesResponse {
    favoriteGenres: number[]
    favoriteDirectors: number[]
    favoriteActors: number[]
    genreAffinity: Record<string, number>
    updatedAt: Date
}

export interface UpdateUserPreferencesDTO {
    favoriteGenres?: number[]
    favoriteDirectors?: number[]
    favoriteActors?: number[]
}