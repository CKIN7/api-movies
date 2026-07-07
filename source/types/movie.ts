import { z } from 'zod'
import { movieSchema } from '../schemas/movie'

export type MovieInput = z.infer<typeof movieSchema>

export interface Movie {
    id: number | string
    title: string
    year: number
    genre: string[]
    director: string
    rating: number
    duration: number
    plot: string
    poster: string
    available: boolean
}

export interface MovieRecord {
    id: number
    title: string
    year: number
    genre: string
    director: string
    rating: number
    duration: number
    cast: string[]
    plot: string
    poster: string
    available: boolean
}

export interface MoviesData {
    movies: MovieRecord[]
    total: number
    page: number
    totalPages: number
}

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
