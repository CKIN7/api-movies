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

// ───────────────────────────────────────────────────────────────
//  Preferencias
// ───────────────────────────────────────────────────────────────

export const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const
export type AgeRating = (typeof AGE_RATINGS)[number]

export interface ContentFilters {
    minRating?: number
    maxAgeRating?: AgeRating
    decades?: number[]
    runtimeMin?: number
    runtimeMax?: number
}

// genre_affinity se guarda como objeto indexado; cada entrada pasa a tener
// score + updatedAt para poder aplicar decay. Se tolera el formato legado
// (solo número) en lectura.
export interface GenreAffinityEntry {
    score: number
    updatedAt: string
}

export type GenreAffinity = Record<string, number | GenreAffinityEntry>

export interface UserPreferencesRow {
    user_id: string
    favorite_genres: string | number[] | null
    favorite_directors: string | number[] | null
    favorite_actors: string | number[] | null
    disliked_genres: string | number[] | null
    disliked_directors: string | number[] | null
    disliked_actors: string | number[] | null
    content_filters: string | ContentFilters | null
    genre_affinity: string | GenreAffinity | null
    updated_at: string
}

export interface UserPreferencesResponse {
    favoriteGenres: number[]
    favoriteDirectors: number[]
    favoriteActors: number[]
    dislikedGenres: number[]
    dislikedDirectors: number[]
    dislikedActors: number[]
    contentFilters: ContentFilters
    genreAffinity: GenreAffinity
    updatedAt: Date | null
}

export interface UpdateUserPreferencesDTO {
    favoriteGenres?: number[]
    favoriteDirectors?: number[]
    favoriteActors?: number[]
    dislikedGenres?: number[]
    dislikedDirectors?: number[]
    dislikedActors?: number[]
    contentFilters?: ContentFilters
}

export interface UserStats {
    topGenres: { genreId: number; genreName: string; count: number }[]
    topDirectors: { directorId: number; directorName: string; count: number }[]
    totalReviews: number
    totalWatchlist: number
}

// ───────────────────────────────────────────────────────────────
//  Perfil
// ───────────────────────────────────────────────────────────────

export interface UserProfileRow {
    user_id: string
    display_name: string | null
    bio: string | null
    avatar_url: string | null
    country: string | null
    birth_year: number | null
    is_public: number | boolean
    created_at: string
    updated_at: string
}

export interface UserProfileResponse {
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    country: string | null
    birthYear: number | null
    isPublic: boolean
    createdAt: string
    updatedAt: string
}

export interface PublicProfileResponse {
    displayName: string | null
    bio: string | null
    avatarUrl: string | null
    country: string | null
    isPublic: boolean
    stats?: UserStats
}

export interface UpdateUserProfileDTO {
    displayName?: string | null
    bio?: string | null
    avatarUrl?: string | null
    country?: string | null
    birthYear?: number | null
    isPublic?: boolean
}

// ───────────────────────────────────────────────────────────────
//  Settings
// ───────────────────────────────────────────────────────────────

export const PRIVACY_LEVELS = ['public', 'friends', 'private'] as const
export type PrivacyLevel = (typeof PRIVACY_LEVELS)[number]

export const THEMES = ['light', 'dark', 'system'] as const
export type Theme = (typeof THEMES)[number]

export interface UserSettingsRow {
    user_id: string
    language: string
    theme: string
    region: string | null
    notify_email: number | boolean
    notify_push: number | boolean
    privacy_reviews: string
    privacy_watchlist: string
    privacy_activity: string
    spoiler_free: number | boolean
    updated_at: string
}

export interface UserSettingsResponse {
    language: string
    theme: string
    region: string | null
    notifyEmail: boolean
    notifyPush: boolean
    privacyReviews: PrivacyLevel
    privacyWatchlist: PrivacyLevel
    privacyActivity: PrivacyLevel
    spoilerFree: boolean
    updatedAt: string | null
}

export interface UpdateUserSettingsDTO {
    language?: string
    theme?: Theme
    region?: string | null
    notifyEmail?: boolean
    notifyPush?: boolean
    privacyReviews?: PrivacyLevel
    privacyWatchlist?: PrivacyLevel
    privacyActivity?: PrivacyLevel
    spoilerFree?: boolean
}
