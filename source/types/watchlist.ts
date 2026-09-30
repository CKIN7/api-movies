import type { MovieResponse } from '../domain/Movie'

export interface WatchlistRow {
    id: number
    user_id: string
    movie_id: number
    notes: string | null
    priority: number
    added_at: string
}

export interface WatchlistEntryResponse {
    id: number
    userId: string
    movieId: number
    notes: string | null
    priority: number
    addedAt: string
    movie: MovieResponse
}

export interface PaginatedWatchlistResponse {
    data: WatchlistEntryResponse[]
    meta: { total: number; page: number; limit: number; totalPages: number }
}

export interface AddToWatchlistDTO {
    movieId: number
    notes?: string | null
    priority?: number
}

export interface WatchlistQueryDTO {
    page: number
    limit: number
    genre?: string
    sortBy: 'addedAt' | 'title' | 'year' | 'rating' | 'priority'
    sortOrder: 'asc' | 'desc'
}