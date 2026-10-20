import { RecommendationRepository } from '../repositories/RecommendationRepository'
import { UserPreferencesService } from './userPreferencesService'
import { RecommendationFeedbackService } from './recommendationFeedbackService'
import MovieRepository from '../repositories/MovieRepository'
import { getCached, setCached, invalidatePattern } from '../utils/cache'
import { getRedisClient, isRedisHealthy } from '../utils/redisClient'
import logger from '../utils/logger'
import AppError from '../utils/AppError'
import type {
    RecommendationCandidateRow,
    RecommendationItem,
    RecommendationQueryDTO,
    UserInteraction,
} from '../types/recommendation'
import type { ContentFilters, GenreAffinity, GenreAffinityEntry } from '../types/user'

const CACHE_TTL_SECONDS = 24 * 60 * 60
const COLLAB_TOP_N = 50
const DECAY_HALF_LIFE_DAYS = 90

const WEIGHTS = { content: 0.4, collab: 0.4, pref: 0.2 } as const

const AGE_RANK: Record<string, number> = { 'G': 0, 'PG': 1, 'PG-13': 2, 'R': 3, 'NC-17': 4 }

interface PreferenceInput {
    favoriteGenres: number[]
    favoriteDirectors: number[]
    favoriteActors: number[]
    dislikedGenres: number[]
    dislikedDirectors: number[]
    dislikedActors: number[]
    genreAffinity: GenreAffinity
    contentFilters: ContentFilters
}

function parseIdList(raw: string): number[] {
    if (!raw) return []
    return raw.split(',').map(Number).filter(n => !Number.isNaN(n))
}

function normalizeScores(scores: Map<number, number>): Map<number, number> {
    let max = 0
    for (const v of scores.values()) if (v > max) max = v
    const normalized = new Map<number, number>()
    if (max === 0) return normalized
    for (const [id, v] of scores) normalized.set(id, Math.round((v / max) * 1000) / 10)
    return normalized
}

function round1(n: number): number {
    return Math.round(n * 10) / 10
}

// Decay exponencial: la afinidad pierde la mitad de su peso cada 90 días.
// Tolerante al formato legado (solo número, sin updatedAt).
function effectiveAffinity(value: number | GenreAffinityEntry | undefined): number {
    if (value === undefined) return 0
    if (typeof value === 'number') return value
    const ageDays = (Date.now() - new Date(value.updatedAt).getTime()) / 86_400_000
    if (!Number.isFinite(ageDays) || ageDays < 0) return value.score
    return value.score * Math.pow(0.5, ageDays / DECAY_HALF_LIFE_DAYS)
}

function passesFilters(c: RecommendationCandidateRow, filters: ContentFilters): boolean {
    if (filters.minRating !== undefined && Number(c.rating) < filters.minRating) return false
    if (filters.maxAgeRating !== undefined) {
        const rank = AGE_RANK[c.age_rating] ?? 0
        const maxRank = AGE_RANK[filters.maxAgeRating] ?? 99
        if (rank > maxRank) return false
    }
    if (filters.decades && filters.decades.length > 0) {
        const decade = Math.floor(Number(c.year) / 10) * 10
        if (!filters.decades.includes(decade)) return false
    }
    if (filters.runtimeMin !== undefined && Number(c.duration) < filters.runtimeMin) return false
    if (filters.runtimeMax !== undefined && Number(c.duration) > filters.runtimeMax) return false
    return true
}

// ═══════════════════════════════════════════════════════════════
//  Content-based: similitud del candidato con el historial visto
// ═══════════════════════════════════════════════════════════════
function contentScores(
    candidates: RecommendationCandidateRow[],
    interactions: UserInteraction[],
    watchedIds: Set<number>,
): { scores: Map<number, number>, seeds: Map<number, { title: string, shared: number }> } {
    const genreCount = new Map<number, number>()
    const watchedDirectors = new Map<number, string>()
    const watchedMeta = new Map<number, { title: string, genres: Set<number> }>()

    for (const c of candidates) {
        if (!watchedIds.has(c.id)) continue
        const genres = parseIdList(c.genreIds)
        watchedMeta.set(c.id, { title: c.title, genres: new Set(genres) })
        watchedDirectors.set(c.id_director, c.title)
        for (const g of genres) genreCount.set(g, (genreCount.get(g) ?? 0) + 1)
    }

    const raw = new Map<number, number>()
    const seeds = new Map<number, { title: string, shared: number }>()

    for (const c of candidates) {
        if (watchedIds.has(c.id)) continue
        let score = 0
        let bestSeed: { title: string, shared: number } | null = null

        for (const g of parseIdList(c.genreIds)) {
            const count = genreCount.get(g) ?? 0
            score += count
        }

        for (const wId of watchedMeta.keys()) {
            const w = watchedMeta.get(wId)!
            let shared = 0
            for (const g of c.genreIds.split(',')) {
                if (g !== '' && w.genres.has(Number(g))) shared++
            }
            if (shared > 0 && (!bestSeed || shared > bestSeed.shared)) {
                bestSeed = { title: w.title, shared }
            }
        }

        if (watchedDirectors.has(c.id_director)) {
            score += 3
            if (!bestSeed) bestSeed = { title: watchedDirectors.get(c.id_director)!, shared: 0 }
        }

        if (score > 0) raw.set(c.id, score)
        if (bestSeed) seeds.set(c.id, bestSeed)
    }

    return { scores: normalizeScores(raw), seeds }
}

// ═══════════════════════════════════════════════════════════════
//  Preference boost: favoritos (+) y dislikes (−) + affinity con decay
// ═══════════════════════════════════════════════════════════════
function preferenceScores(
    candidates: RecommendationCandidateRow[],
    prefs: PreferenceInput,
    watchedIds: Set<number>,
): Map<number, number> {
    const favGenres = new Set(prefs.favoriteGenres)
    const favDirectors = new Set(prefs.favoriteDirectors)
    const favActors = new Set(prefs.favoriteActors)
    const disGenres = new Set(prefs.dislikedGenres)
    const disDirectors = new Set(prefs.dislikedDirectors)
    const disActors = new Set(prefs.dislikedActors)
    const affinity = prefs.genreAffinity ?? {}

    const raw = new Map<number, number>()

    for (const c of candidates) {
        if (watchedIds.has(c.id)) continue
        let score = 0

        for (const g of parseIdList(c.genreIds)) {
            score += effectiveAffinity(affinity[String(g)])
            if (favGenres.has(g)) score += 5
            if (disGenres.has(g)) score -= 10
        }
        if (favDirectors.has(c.id_director)) score += 15
        if (disDirectors.has(c.id_director)) score -= 30

        const sharedFavActors = parseIdList(c.actorIds).filter(a => favActors.has(a)).length
        score += Math.min(sharedFavActors, 2) * 5

        const sharedDislikedActors = parseIdList(c.actorIds).filter(a => disActors.has(a)).length
        score -= Math.min(sharedDislikedActors, 2) * 10

        if (score > 0) raw.set(c.id, score)
    }

    return normalizeScores(raw)
}

// ═══════════════════════════════════════════════════════════════
//  Collaborative filtering: coseno item-item sobre interacciones
// ═══════════════════════════════════════════════════════════════
function buildItemMaps(allInteractions: { userId: string, movieId: number, weight: number }[]): Map<number, Map<string, number>> {
    const itemMaps = new Map<number, Map<string, number>>()
    for (const it of allInteractions) {
        let m = itemMaps.get(it.movieId)
        if (!m) { m = new Map(); itemMaps.set(it.movieId, m) }
        m.set(it.userId, it.weight)
    }
    return itemMaps
}

function cosine(a: Map<string, number>, b: Map<string, number>): number {
    let dot = 0, normA = 0, normB = 0
    for (const v of a.values()) normA += v * v
    for (const v of b.values()) normB += v * v
    if (normA === 0 || normB === 0) return 0
    const [small, large] = a.size <= b.size ? [a, b] : [b, a]
    for (const [u, v] of small) {
        const w = large.get(u)
        if (w !== undefined) dot += v * w
    }
    return dot / (Math.sqrt(normA) * Math.sqrt(normB))
}

function collabScores(
    userInteractions: UserInteraction[],
    itemMaps: Map<number, Map<string, number>>,
    excludeIds: Set<number>,
): Map<number, number> {
    const raw = new Map<number, number>()

    for (const [movieId, itemMap] of itemMaps) {
        if (excludeIds.has(movieId)) continue
        let score = 0
        for (const it of userInteractions) {
            const neighbor = itemMaps.get(it.movieId)
            if (!neighbor || it.movieId === movieId) continue
            score += it.weight * cosine(itemMap, neighbor)
        }
        if (score > 0) raw.set(movieId, score)
    }

    return normalizeScores(raw)
}

function topEntries(scores: Map<number, number>, n: number): Record<string, number> {
    return [...scores.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, n)
        .reduce<Record<string, number>>((acc, [id, score]) => {
            acc[String(id)] = score
            return acc
        }, {})
}

export class RecommendationService {
    constructor(
        private recRepo: RecommendationRepository,
        private prefsService: UserPreferencesService,
        private movieRepo: MovieRepository,
        private feedbackService: RecommendationFeedbackService,
    ) {}

    private cacheKey(userId: string, type: string): string {
        return `recs:user:${userId}:${type}`
    }

    // Namespace separado: la key `...:collab` guarda la lista final de
    // items (RecommendationItem[]), ésta guarda la matriz de scores
    // (Record<string, number>) que consume collabForUser/hybrid.
    private collabScoresKey(userId: string): string {
        return `recs:user:${userId}:collab:scores`
    }

    private redisReady(): boolean {
        try {
            return isRedisHealthy()
        } catch {
            return false
        }
    }

    async getRecommendations(userId: string, query: RecommendationQueryDTO): Promise<RecommendationItem[]> {
        try {
            const key = this.cacheKey(userId, query.type)
            if (this.redisReady()) {
                const cached = await getCached<RecommendationItem[]>(getRedisClient(), key)
                if (cached) return cached.slice(0, query.limit)
            }

            const items = await this.compute(userId, query)

            if (this.redisReady()) {
                await setCached(getRedisClient(), key, items, CACHE_TTL_SECONDS)
            }

            return items.slice(0, query.limit)
        } catch (error) {
            if (error instanceof AppError) throw error
            logger.error(`Error in getRecommendations: ${(error as Error).message}`)
            throw new AppError('Error al obtener recomendaciones', 500)
        }
    }

    private async compute(userId: string, query: RecommendationQueryDTO): Promise<RecommendationItem[]> {
        const [interactions, prefs, rawCandidates, excludedMovieIds] = await Promise.all([
            this.recRepo.getUserInteractions(userId),
            this.prefsService.getPreferences(userId),
            this.recRepo.getCandidates(),
            this.feedbackService.getExcludedMovieIds(userId),
        ])

        const excludedIds = new Set(excludedMovieIds)
        const filters: ContentFilters = query.type === 'hybrid' ? (prefs.contentFilters ?? {}) : {}
        const candidates = rawCandidates.filter(c => passesFilters(c, filters) && !excludedIds.has(c.id))

        const watchedIds = new Set(interactions.map(i => i.movieId))
        const seeds = query.type !== 'collab'
            ? contentScores(candidates, interactions, watchedIds)
            : { scores: new Map<number, number>(), seeds: new Map<number, { title: string, shared: number }>() }

        const prefMap = query.type === 'hybrid'
            ? preferenceScores(candidates, prefs as PreferenceInput, watchedIds)
            : new Map<number, number>()

        let collabMap = new Map<number, number>()
        if (query.type !== 'content') {
            collabMap = await this.collabForUser(userId, interactions, watchedIds)
        }

        const merged = new Map<number, { content: number, collab: number, pref: number }>()
        const put = (map: Map<number, number>, field: 'content' | 'collab' | 'pref') => {
            for (const [id, v] of map) {
                const entry = merged.get(id) ?? { content: 0, collab: 0, pref: 0 }
                entry[field] = v
                merged.set(id, entry)
            }
        }
        if (query.type !== 'collab') put(seeds.scores, 'content')
        put(collabMap, 'collab')
        put(prefMap, 'pref')

        const finalScores = new Map<number, number>()
        for (const [id, parts] of merged) {
            if (excludedIds.has(id)) continue
            const score = query.type === 'hybrid'
                ? parts.content * WEIGHTS.content + parts.collab * WEIGHTS.collab + parts.pref * WEIGHTS.pref
                : query.type === 'content' ? parts.content : parts.collab
            if (score > 0) finalScores.set(id, round1(score))
        }

        const ranked = [...finalScores.entries()].sort((a, b) => b[1] - a[1]).slice(0, query.limit)
        if (ranked.length === 0) return []

        const rows = await this.movieRepo.findByIds(ranked.map(([id]) => id))
        const rowMap = new Map(rows.map(r => [r.id, r]))

        return ranked.map(([id, score]) => {
            const row = rowMap.get(id)
            const parts = merged.get(id)!
            return {
                movie: {
                    id,
                    title: row?.title ?? '',
                    year: row?.year ?? 0,
                    rating: Number(row?.rating ?? 0),
                    director: row?.director ?? '',
                    genres: (row?.genres ?? '').split(', ').filter(Boolean),
                },
                score,
                reason: this.buildReason(query.type, parts, seeds.seeds.get(id)),
            }
        })
    }

    private async collabForUser(
        userId: string,
        interactions: UserInteraction[],
        watchedIds: Set<number>,
    ): Promise<Map<number, number>> {
        if (interactions.length === 0) return new Map()

        const key = this.collabScoresKey(userId)
        if (this.redisReady()) {
            const cached = await getCached<Record<string, number>>(getRedisClient(), key)
            if (cached) {
                return new Map(Object.entries(cached).map(([id, v]) => [Number(id), v]))
            }
        }

        const all = await this.recRepo.getAllInteractions()
        const scores = collabScores(interactions, buildItemMaps(all), watchedIds)

        if (this.redisReady() && scores.size > 0) {
            await setCached(getRedisClient(), key, topEntries(scores, COLLAB_TOP_N), CACHE_TTL_SECONDS)
        }

        return scores
    }

    private buildReason(
        type: RecommendationQueryDTO['type'],
        parts: { content: number, collab: number, pref: number },
        seed?: { title: string, shared: number },
    ): string {
        if (type === 'content') {
            return seed && seed.shared > 0 ? `Similar a "${seed.title}"` : 'Basado en tu historial de visualización'
        }
        if (type === 'collab') {
            return 'Usuarios como tú también la vieron'
        }

        const dominant = Math.max(parts.content, parts.collab, parts.pref)
        if (dominant === parts.collab) return 'Usuarios como tú también la vieron'
        if (dominant === parts.pref) return 'Coincide con tus géneros y artistas favoritos'
        return seed && seed.shared > 0 ? `Similar a "${seed.title}"` : 'Basado en tu historial de visualización'
    }

    async invalidate(userId: string): Promise<void> {
        if (!this.redisReady()) return
        try {
            await invalidatePattern(getRedisClient(), this.cacheKey(userId, '*'))
        } catch (error) {
            logger.warn(`Failed to invalidate recommendations for user ${userId}: ${(error as Error).message}`)
        }
    }

    async recomputeCollabForAllUsers(): Promise<number> {
        const [all, candidates] = await Promise.all([
            this.recRepo.getAllInteractions(),
            this.recRepo.getCandidates(),
        ])
        if (all.length === 0) return 0

        const itemMaps = buildItemMaps(all)
        const byUser = new Map<string, UserInteraction[]>()
        for (const it of all) {
            const list = byUser.get(it.userId) ?? []
            list.push({ movieId: it.movieId, weight: it.weight })
            byUser.set(it.userId, list)
        }

        const allCandidateIds = new Set(candidates.map(c => c.id))
        let processed = 0

        for (const [userId, interactions] of byUser) {
            const watched = new Set(interactions.map(i => i.movieId))
            const scores = collabScores(interactions, itemMaps, new Set([...watched].filter(id => allCandidateIds.has(id))))
            const key = this.collabScoresKey(userId)
            if (scores.size > 0) {
                await setCached(getRedisClient(), key, topEntries(scores, COLLAB_TOP_N), CACHE_TTL_SECONDS)
            } else {
                await invalidatePattern(getRedisClient(), key)
            }
            processed++
        }

        return processed
    }
}
