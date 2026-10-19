import type {
    ContentFilters,
    GenreAffinity,
    UserPreferencesResponse,
    UserPreferencesRow,
} from '../types/user'

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
        public dislikedGenres: number[],
        public dislikedDirectors: number[],
        public dislikedActors: number[],
        public contentFilters: ContentFilters,
        public genreAffinity: GenreAffinity,
        public updatedAt: Date,
    ) {}

    static fromRow(row: UserPreferencesRow): UserPreferences {
        return new UserPreferences(
            row.user_id,
            parseJsonColumn(row.favorite_genres, [] as number[]),
            parseJsonColumn(row.favorite_directors, [] as number[]),
            parseJsonColumn(row.favorite_actors, [] as number[]),
            parseJsonColumn(row.disliked_genres, [] as number[]),
            parseJsonColumn(row.disliked_directors, [] as number[]),
            parseJsonColumn(row.disliked_actors, [] as number[]),
            parseJsonColumn(row.content_filters, {} as ContentFilters),
            parseJsonColumn(row.genre_affinity, {} as GenreAffinity),
            new Date(row.updated_at),
        )
    }

    toResponse(): UserPreferencesResponse {
        return {
            favoriteGenres: this.favoriteGenres,
            favoriteDirectors: this.favoriteDirectors,
            favoriteActors: this.favoriteActors,
            dislikedGenres: this.dislikedGenres,
            dislikedDirectors: this.dislikedDirectors,
            dislikedActors: this.dislikedActors,
            contentFilters: this.contentFilters,
            genreAffinity: this.genreAffinity,
            updatedAt: this.updatedAt,
        }
    }
}
