export interface ReviewRow {
    id: number;
    movie_id: number;
    user_id: string;
    rating: number;           // DECIMAL(2,1) → number (ej. 4.5)
    comment: string | null;
    created_at: string;       // DATETIME → ISO string
    updated_at: string;       // DATETIME → ISO string
    email?: string;           // JOIN users.email (para respuesta)
}

export interface ReviewResponse {
    id: number;
    movieId: number;
    email: string;            // email del usuario (actual users.email)
    rating: number;           // 1.0 - 5.0
    comment: string | null;
    createdAt: string;        // ISO string
}

export interface ReviewsSummary {
    average: number | null;   // null si count = 0
    count: number;
}

export interface PaginatedReviewsResponse {
    data: ReviewResponse[];
    meta: {
        total: number;
        page: number;
        limit: number;
        totalPages: number;
    };
    summary: ReviewsSummary;
}

export interface CreateReviewDTO {
    rating: number;           // 1.0 - 5.0, step 0.5
    comment?: string;         // opcional, max 2000, no HTML
}

export interface UpdateReviewDTO {
    rating?: number;          // 1.0 - 5.0, step 0.5
    comment?: string;         // opcional, max 2000, no HTML
}