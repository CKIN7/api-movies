import type { SimilarMovieRow, SimilarMovieResponse } from '../types/movie'

export class SimilarMovie {
    constructor(
        public readonly id: number,
        public title: string,
        public year: number,
        public rating: number,
        public director: string,
        public genres: string[],
        public similarityScore: number,
    ) {}

    static fromRow(row: SimilarMovieRow): SimilarMovie {
        return new SimilarMovie(
            row.id,
            row.title,
            row.year,
            Number(row.rating),
            row.director,
            row.genres.split(',').map(g => g.trim()).filter(Boolean),
            Number(row.similarityScore),
        )
    }

    toResponse(): SimilarMovieResponse {
        return {
            id: this.id,
            title: this.title,
            year: this.year,
            rating: this.rating,
            director: this.director,
            genres: this.genres,
            similarityScore: this.similarityScore,
        }
    }
}
