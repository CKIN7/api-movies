import type { UserPreferencesRow, UserPreferencesResponse } from '../types/user'

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
            row.favorite_genres ? JSON.parse(row.favorite_genres) : [],
            row.favorite_directors ? JSON.parse(row.favorite_directors) : [],
            row.favorite_actors ? JSON.parse(row.favorite_actors) : [],
            row.genre_affinity ? JSON.parse(row.genre_affinity) : {},
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
