import type { UserPreferencesRow, UserPreferencesResponse } from '../types/user'

function parseJsonColumn<T>(value: string | T | null | undefined, fallback: T): T {
    if (value === null || value === undefined) return fallback
    if (typeof value !== 'string') return value
    try {
        return JSON.parse(value) as T
    } catch {
        return fallback
    }
}

export class UserPreferences {
    constructor(
        public readonly userId: string,
        public favoriteGenres: number[],
        public favoriteDirectors: number[],
        public favoriteActors: number[],
        public genreAffinity: Record<string, number>,
        public updatedAt: Date,
    ) {}

    static fromRow(row: UserPreferencesRow): UserPreferences {
        return new UserPreferences(
            row.user_id,
            parseJsonColumn(row.favorite_genres, [] as number[]),
            parseJsonColumn(row.favorite_directors, [] as number[]),
            parseJsonColumn(row.favorite_actors, [] as number[]),
            parseJsonColumn(row.genre_affinity, {} as Record<string, number>),
            new Date(row.updated_at),
        )
    }

    toResponse(): UserPreferencesResponse {
        return {
            favoriteGenres: this.favoriteGenres,
            favoriteDirectors: this.favoriteDirectors,
            favoriteActors: this.favoriteActors,
            genreAffinity: this.genreAffinity,
            updatedAt: this.updatedAt,
        }
    }
}
