import { RecommendationService } from '../../services/recommendationService'
import { RecommendationRepository } from '../../repositories/RecommendationRepository'
import { UserPreferencesService } from '../../services/userPreferencesService'
import { RecommendationFeedbackService } from '../../services/recommendationFeedbackService'
import MovieRepository from '../../repositories/MovieRepository'
import type { RecommendationCandidateRow } from '../../types/recommendation'

const candidates: RecommendationCandidateRow[] = [
    // vista por el usuario
    { id: 1, title: 'Inception', year: 2010, rating: 8.8, id_director: 10, genreIds: '1,2', genreNames: 'action,sci-fi', actorIds: '100', duration: 148, age_rating: 'PG-13' },
    // candidata: comparte ambos géneros con Inception
    { id: 2, title: 'Interstellar', year: 2014, rating: 8.6, id_director: 10, genreIds: '1,2', genreNames: 'action,sci-fi', actorIds: '100', duration: 169, age_rating: 'PG-13' },
    // candidata: solo comparte género 2
    { id: 3, title: 'The Matrix', year: 1999, rating: 8.7, id_director: 20, genreIds: '2', genreNames: 'sci-fi', actorIds: '200', duration: 136, age_rating: 'R' },
    // candidata sin relación
    { id: 4, title: 'Titanic', year: 1997, rating: 7.9, id_director: 30, genreIds: '3', genreNames: 'drama', actorIds: '300', duration: 194, age_rating: 'PG-13' },
]

function makeService(overrides: {
    interactions?: { movieId: number, weight: number }[]
    allInteractions?: { userId: string, movieId: number, weight: number }[]
    prefs?: any
    movieRows?: any[]
    excludedMovieIds?: number[]
} = {}) {
    const recRepo = {
        getUserInteractions: jest.fn().mockResolvedValue(overrides.interactions ?? []),
        getAllInteractions: jest.fn().mockResolvedValue(overrides.allInteractions ?? []),
        getCandidates: jest.fn().mockResolvedValue(candidates),
    }
    const prefsService = {
        getPreferences: jest.fn().mockResolvedValue(overrides.prefs ?? {
            favoriteGenres: [], favoriteDirectors: [], favoriteActors: [], genreAffinity: {},
        }),
    }
    const movieRepo = {
        findByIds: jest.fn().mockImplementation(async (ids: number[]) =>
            (overrides.movieRows ?? candidates)
                .filter(c => ids.includes(c.id))
                .map(c => ({ ...c, director: 'Director ' + c.id_director, genres: c.genreNames }))
        ),
    }

    const feedbackService = {
        getExcludedMovieIds: jest.fn().mockResolvedValue(overrides.excludedMovieIds ?? []),
    }

    const service = new RecommendationService(
        recRepo as unknown as RecommendationRepository,
        prefsService as unknown as UserPreferencesService,
        movieRepo as unknown as MovieRepository,
        feedbackService as unknown as RecommendationFeedbackService,
    )
    return { service, recRepo, prefsService, movieRepo, feedbackService }
}

describe('RecommendationService (unit)', () => {
    test('content: excluye lo visto y ordena por similitud de géneros', async () => {
        const { service } = makeService({ interactions: [{ movieId: 1, weight: 5 }] })

        const items = await service.getRecommendations('user-1', { type: 'content', limit: 10 })

        expect(items.length).toBeGreaterThan(0)
        expect(items[0].movie.id).toBe(2) // Interstellar comparte 2 géneros + director
        expect(items.find(i => i.movie.id === 1)).toBeUndefined()
        expect(items[0].reason).toBe('Similar a "Inception"')
        expect(items[0].score).toBeGreaterThan(0)
    })

    test('content: excluye películas sin relación', async () => {
        const { service } = makeService({ interactions: [{ movieId: 1, weight: 5 }] })

        const items = await service.getRecommendations('user-1', { type: 'content', limit: 10 })

        expect(items.find(i => i.movie.id === 4)).toBeUndefined()
    })

    test('collab: sin interacciones de otros usuarios retorna vacío', async () => {
        const { service } = makeService({ interactions: [{ movieId: 1, weight: 5 }] })

        const items = await service.getRecommendations('user-1', { type: 'collab', limit: 10 })

        expect(items).toEqual([])
    })

    test('collab: con matrix usuario×película retorna scores', async () => {
        const { service } = makeService({
            interactions: [{ movieId: 1, weight: 5 }],
            allInteractions: [
                { userId: 'user-1', movieId: 1, weight: 5 },
                { userId: 'user-2', movieId: 1, weight: 4 },
                { userId: 'user-2', movieId: 3, weight: 5 },
            ],
        })

        const items = await service.getRecommendations('user-1', { type: 'collab', limit: 10 })

        expect(items.length).toBeGreaterThan(0)
        expect(items[0].movie.id).toBe(3) // user-2 vio 1 y 3 → la 3 es parecida a la 1
        expect(items[0].reason).toBe('Usuarios como tú también la vieron')
    })

    test('hybrid: combina señales y excluye lo visto', async () => {
        const { service } = makeService({
            interactions: [{ movieId: 1, weight: 5 }],
            allInteractions: [
                { userId: 'user-1', movieId: 1, weight: 5 },
                { userId: 'user-2', movieId: 1, weight: 4 },
                { userId: 'user-2', movieId: 3, weight: 5 },
            ],
            prefs: {
                favoriteGenres: [1, 2], favoriteDirectors: [10], favoriteActors: [100],
                genreAffinity: { '1': 5, '2': 3 },
            },
        })

        const items = await service.getRecommendations('user-1', { type: 'hybrid', limit: 10 })

        expect(items.length).toBeGreaterThan(0)
        expect(items.find(i => i.movie.id === 1)).toBeUndefined()
        expect(items[0].score).toBeGreaterThan(0)
        expect(items[0].reason).toBeTruthy()
    })

    test('cold start: sin historial ni preferencias retorna vacío', async () => {
        const { service } = makeService()

        const items = await service.getRecommendations('user-new', { type: 'hybrid', limit: 10 })

        expect(items).toEqual([])
    })

    test('respeta el límite', async () => {
        const { service } = makeService({ interactions: [{ movieId: 1, weight: 5 }] })

        const items = await service.getRecommendations('user-1', { type: 'content', limit: 1 })

        expect(items).toHaveLength(1)
    })

    test('preference boost: director favorito mejora el score en hybrid', async () => {
        const interactions = [{ movieId: 1, weight: 5 }]

        const { service: withFav } = makeService({
            interactions,
            prefs: {
                favoriteGenres: [], favoriteDirectors: [20], favoriteActors: [],
                genreAffinity: {},
            },
        })
        const { service: withoutFav } = makeService({ interactions })

        const withItems = await withFav.getRecommendations('user-1', { type: 'hybrid', limit: 10 })
        const withoutItems = await withoutFav.getRecommendations('user-1', { type: 'hybrid', limit: 10 })

        const withMatrix = withItems.find(i => i.movie.id === 3)
        const withoutMatrix = withoutItems.find(i => i.movie.id === 3)

        expect(withMatrix).toBeDefined()
        expect(withoutMatrix).toBeDefined()
        expect(withMatrix!.score).toBeGreaterThan(withoutMatrix!.score)
    })

    test('excluye películas marcadas como not_interested en todos los tipos', async () => {
        const { service } = makeService({
            interactions: [{ movieId: 1, weight: 5 }],
            allInteractions: [
                { userId: 'user-1', movieId: 1, weight: 5 },
                { userId: 'user-2', movieId: 1, weight: 4 },
                { userId: 'user-2', movieId: 3, weight: 5 },
            ],
            excludedMovieIds: [3],
        })

        const contentItems = await service.getRecommendations('user-1', { type: 'content', limit: 10 })
        const collabItems = await service.getRecommendations('user-1', { type: 'collab', limit: 10 })

        expect(contentItems.find(i => i.movie.id === 3)).toBeUndefined()
        expect(collabItems.find(i => i.movie.id === 3)).toBeUndefined()
    })
})
