import { z } from 'zod'
import { movieSchema } from '../schemas/movie'

export type MovieInput = z.infer<typeof movieSchema>

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

export interface GetMoviesParams {
    genre?: string
    year?: string
    title?: string
    sort?: string
    order?: string
    page?: string
    limit?: string
}

export interface GetMoviesQuery {
    genre?: string
    year?: string
    title?: string
    sort?: string
    order?: string
    limit: number
    offset: number
}