// domain/Review.ts
import type { ReviewRow } from '../types/review'

export interface ReviewResponse {
    id: number
    movieId: number
    userId: string
    rating: number
    comment: string | null
    createdAt: string
}

// ═══════════════════════════════════════════════════════════════
//  Patrón: Factory Method + DTO
// ═══════════════════════════════════════════════════════════════
//  Factory Method: fromRow() construye un Review desde una fila
//  SQL (ReviewRow). toResponse() convierte el dominio a DTO
//  (ReviewResponse) para la capa de presentación.
// ═══════════════════════════════════════════════════════════════

export class Review {
    constructor(
        public readonly id: number,
        public readonly movieId: number,
        public readonly userId: string,
        public readonly rating: number,
        public readonly comment: string | null,
        public readonly createdAt: string,
        public readonly updatedAt: string,
    ) {}

    static fromRow(row: ReviewRow): Review {
        return new Review(
            row.id,
            row.movie_id,
            row.user_id,
            Number(row.rating),
            row.comment,
            row.created_at,
            row.updated_at,
        )
    }

    toResponse(): ReviewResponse {
        return {
            id: this.id,
            movieId: this.movieId,
            userId: this.userId,
            rating: this.rating,
            comment: this.comment,
            createdAt: this.createdAt,
        }
    }
}