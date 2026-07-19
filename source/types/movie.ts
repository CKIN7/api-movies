import { z } from 'zod'
import { movieSchema } from '../schemas/movie'
import type { MovieQueryDTO } from '../schemas/movieQuery'

export type MovieInput = z.infer<typeof movieSchema>
export type CreateMovieDTO = MovieInput
export type UpdateMovieDTO = Partial<MovieInput>
export type { MovieQueryDTO }

export const AGE_RATINGS = ['G', 'PG', 'PG-13', 'R', 'NC-17'] as const
export type AgeRating = typeof AGE_RATINGS[number]

export interface MovieRow {
    id: number
    title: string
    year: number
    director: string
    rating: number
    duration: number
    plot: string
    poster: string
    genres: string
    cast: string
    age_rating: string
}

export interface GetMoviesQuery {
    genre?: string[]
    genreMode?: 'and' | 'or'
    minYear?: number
    maxYear?: number
    minRating?: number
    maxRating?: number
    minDuration?: number
    maxDuration?: number
    title?: string
    director?: string
    sort?: string
    order?: string
    limit: number
    offset: number
    q?: string
    ageRating?: AgeRating[]
}

export interface SimilarMovieRow {
    id: number
    title: string
    year: number
    director: string
    rating: number
    genres: string
    similarityScore: number
}

export interface SimilarMovieResponse {
    id: number
    title: string
    year: number
    rating: number
    genres: string[]
    director: string
    similarityScore: number
}

export interface PaginatedResponse<T> {
  data: T
  meta: { total: number; page: number; limit: number; totalPages: number }
}