export interface RecommendationMovie {
    id: number
    title: string
    year: number
    rating: number
    director: string
    genres: string[]
}

export interface RecommendationItem {
    movie: RecommendationMovie
    score: number
    reason: string
}

export type RecommendationType = 'content' | 'collab' | 'hybrid'

export interface RecommendationQueryDTO {
    type: RecommendationType
    limit: number
}

export interface UserInteraction {
    movieId: number
    weight: number
}

export interface RecommendationCandidateRow {
    id: number
    title: string
    year: number
    rating: number
    duration: number
    age_rating: string
    id_director: number
    genreIds: string
    genreNames: string
    actorIds: string
}
