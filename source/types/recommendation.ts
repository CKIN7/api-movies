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

export const FEEDBACK_ACTIONS = ['view', 'hide', 'like', 'not_interested'] as const
export type FeedbackAction = (typeof FEEDBACK_ACTIONS)[number]

export interface RecommendationFeedbackDTO {
    movieId: number
    action: FeedbackAction
}

export interface RecommendationFeedbackResult extends RecommendationFeedbackDTO {
    applied: boolean
}

export interface RecommendationQueryDTO {
    type: RecommendationType
    limit: number
}

// Resultado de un recompute offline (F4). `cachedTypes` cuenta las listas
// que quedaron en Redis; `recommendations` es el tamano de la lista hybrid,
// que decide si corresponde emitir `recs.ready`.
export interface RecomputeUserResult {
    userId: string
    cachedTypes: number
    recommendations: number
    skipped: boolean
    durationMs: number
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
