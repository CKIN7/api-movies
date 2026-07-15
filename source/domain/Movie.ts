import type { MovieRow } from '../types/movie'

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
    ) {}

    static fromRow(row: MovieRow): Movie {
        return new Movie(
            row.id,
            row.title,
            row.year,
            row.rating,
            row.director,
            row.genres.split(',').map(g => g.trim()).filter(Boolean),
            row.duration,
            row.plot,
            row.poster,
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
        }
    }
}
