import type { MovieRow } from '../types/movie'
import type { CastMember } from '../types/cast'

export interface MovieResponse {
    id: number
    title: string
    year: number
    director: string
    rating: number
    duration: number
    plot: string
    poster: string
    genres: string[]
    cast: CastMember[]
    ageRating: string
}

export class Movie {
    constructor(
        public readonly id: number,
        public title: string,
        public year: number,
        public rating: number,
        public director: string,
        public genres: string[],
        public duration: number,
        public plot: string,
        public poster: string,
        public cast: CastMember[],
        public ageRating: string,
    ) {}

    static fromRow(row: MovieRow): Movie {
        const parsedCast: CastMember[] = row.cast
            ? row.cast.split('|||').filter(Boolean).map(piece => {
                const [actor, character] = piece.split('||')
                return { actor: actor.trim(), character: (character || '').trim() }
              })
            : []

        return new Movie(
            row.id,
            row.title,
            row.year,
            Number(row.rating),
            row.director,
            row.genres.split(',').map(g => g.trim()).filter(Boolean),
            row.duration,
            row.plot,
            row.poster,
            parsedCast,
            row.age_rating,
        )
    }

    toResponse(): MovieResponse {
        return {
            id: this.id,
            title: this.title,
            year: this.year,
            director: this.director,
            rating: this.rating,
            duration: this.duration,
            plot: this.plot,
            poster: this.poster,
            genres: this.genres,
            cast: this.cast,
            ageRating: this.ageRating,
        }
    }
}
