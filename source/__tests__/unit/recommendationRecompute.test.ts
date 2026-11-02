import { RecommendationService } from '../../services/recommendationService'
import { invalidatePattern, setCached } from '../../utils/cache'
import { isRedisHealthy } from '../../utils/redisClient'
import type { RecommendationCandidateRow } from '../../types/recommendation'

jest.mock('../../utils/cache', () => ({
    getCached: jest.fn(),
    setCached: jest.fn().mockResolvedValue(undefined),
    invalidatePattern: jest.fn().mockResolvedValue(undefined),
    invalidateUserRecommendations: jest.fn().mockResolvedValue(undefined),
}))

jest.mock('../../utils/redisClient', () => ({
    getRedisClient: jest.fn().mockReturnValue({}),
    isRedisHealthy: jest.fn().mockReturnValue(true),
}))

const candidates: RecommendationCandidateRow[] = [
    { id: 1, title: 'Inception', year: 2010, rating: 8.8, id_director: 10, genreIds: '1,2', genreNames: 'action,sci-fi', actorIds: '100', duration: 148, age_rating: 'PG-13' },
    { id: 2, title: 'Interstellar', year: 2014, rating: 8.6, id_director: 10, genreIds: '1,2', genreNames: 'action,sci-fi', actorIds: '100', duration: 169, age_rating: 'PG-13' },
    { id: 3, title: 'The Matrix', year: 1999, rating: 8.7, id_director: 20, genreIds: '2', genreNames: 'sci-fi', actorIds: '200', duration: 136, age_rating: 'R' },
]

const emptyPrefs = {
    favoriteGenres: [] as number[],
    favoriteDirectors: [] as number[],
    favoriteActors: [] as number[],
    dislikedGenres: [] as number[],
    dislikedDirectors: [] as number[],
    dislikedActors: [] as number[],
    genreAffinity: {},
    contentFilters: {},
}

function makeService(overrides: {
    interactions?: { movieId: number, weight: number }[]
    prefs?: typeof emptyPrefs
} = {}) {
    const recRepo = {
        getUserInteractions: jest.fn().mockResolvedValue(overrides.interactions ?? []),
        getAllInteractions: jest.fn().mockResolvedValue([]),
        getCandidates: jest.fn().mockResolvedValue(candidates),
    }
    const prefsService = {
        getPreferences: jest.fn().mockResolvedValue(overrides.prefs ?? emptyPrefs),
    }
    const movieRepo = {
        findByIds: jest.fn().mockImplementation(async (ids: number[]) =>
            candidates
                .filter(c => ids.includes(c.id))
                .map(c => ({ ...c, director: 'Director ' + c.id_director, genres: c.genreNames })),
        ),
    }
    const feedbackService = {
        getExcludedMovieIds: jest.fn().mockResolvedValue([]),
    }

    const service = new RecommendationService(
        recRepo as any,
        prefsService as any,
        movieRepo as any,
        feedbackService as any,
    )

    return { service, recRepo, prefsService }
}

const mockedSetCached = setCached as jest.Mock
const mockedInvalidatePattern = invalidatePattern as jest.Mock
const mockedIsRedisHealthy = isRedisHealthy as jest.Mock

describe('RecommendationService.recomputeForUser (F4)', () => {
    beforeEach(() => {
        mockedSetCached.mockClear()
        mockedInvalidatePattern.mockClear()
        mockedIsRedisHealthy.mockReturnValue(true)
    })

    test('sin interacciones ni preferencias no computa ni cachea', async () => {
        const { service, recRepo } = makeService()

        const result = await service.recomputeForUser('u1')

        expect(result).toMatchObject({ userId: 'u1', skipped: true, cachedTypes: 0, recommendations: 0 })
        expect(recRepo.getCandidates).not.toHaveBeenCalled()
        expect(mockedSetCached).not.toHaveBeenCalled()
    })

    test('con interacciones invalida y precachea hybrid, content y collab', async () => {
        const { service } = makeService({ interactions: [{ movieId: 1, weight: 5 }] })

        const result = await service.recomputeForUser('u1')

        expect(result.skipped).toBe(false)
        expect(result.cachedTypes).toBe(3)
        expect(result.recommendations).toBeGreaterThan(0)

        expect(mockedInvalidatePattern).toHaveBeenCalledWith({}, 'recs:user:u1:*')

        const keys = mockedSetCached.mock.calls.map((call) => call[1])
        expect(keys).toEqual([
            'recs:user:u1:hybrid',
            'recs:user:u1:content',
            'recs:user:u1:collab',
        ])
    })

    test('cold start con preferencias usa el fallback de popularidad', async () => {
        const { service } = makeService({
            prefs: { ...emptyPrefs, favoriteGenres: [1] },
        })

        const result = await service.recomputeForUser('u1')

        expect(result.skipped).toBe(false)
        expect(result.recommendations).toBeGreaterThan(0)
        expect(mockedSetCached).toHaveBeenCalledTimes(3)
    })

    test('sin Redis no computa (no hay donde cachear)', async () => {
        mockedIsRedisHealthy.mockReturnValue(false)
        const { service, recRepo } = makeService({
            interactions: [{ movieId: 1, weight: 5 }],
        })

        const result = await service.recomputeForUser('u1')

        expect(result).toMatchObject({ skipped: true, cachedTypes: 0 })
        expect(recRepo.getCandidates).not.toHaveBeenCalled()
        expect(mockedSetCached).not.toHaveBeenCalled()
    })
})
