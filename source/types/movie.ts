import { z } from 'zod'
import { movieSchema } from '../schemas/movie'
import type { MovieQueryDTO } from '../schemas/movieQuery'

export type MovieInput = z.infer<typeof movieSchema>
export type CreateMovieDTO = MovieInput
export type UpdateMovieDTO = Partial<MovieInput>
export type { MovieQueryDTO }

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
}

export interface GetMoviesQuery {
    genre?: string
    year?: number
    title?: string
    director?: string
    sort?: string
    order?: string
    limit: number
    offset: number
    q?: string
}

export interface PaginatedResponse<T> {
  data: T
  meta: { total: number; page: number; limit: number; totalPages: number }
}