import { WatchlistEntry } from '../../domain/WatchlistEntry'
import { Movie } from '../../domain/Movie'

describe('WatchlistEntry domain (v1)', () => {
    const mockMovieRow = {
        id: 42,
        title: 'Inception',
        year: 2010,
        director: 'Christopher Nolan',
        rating: 8.8,
        duration: 148,
        plot: 'A thief who steals corporate secrets through dream-sharing.',
        poster: 'https://example.com/inception.jpg',
        genres: 'action, sci-fi',
        cast: 'Leonardo DiCaprio||Dom Cobb|||Joseph Gordon-Levitt||Arthur',
        age_rating: 'PG-13',
        average_rating: 8.5,
        reviews_count: 10
    }

    const mockEntryRow = {
        id: 1,
        user_id: 'cfd74902-7d20-4653-bdf6-759bb4947956',
        movie_id: 42,
        notes: 'Ver este fin de semana',
        priority: 4,
        added_at: '2026-01-15T10:30:00.000Z'
    }

    test('fromRow + toResponse devuelve shape correcto', () => {
        const entry = WatchlistEntry.fromRow(mockEntryRow, mockMovieRow)
        const response = entry.toResponse()

        expect(response).toMatchObject({
            id: 1,
            userId: 'cfd74902-7d20-4653-bdf6-759bb4947956',
            movieId: 42,
            notes: 'Ver este fin de semana',
            priority: 4,
            addedAt: '2026-01-15T10:30:00.000Z'
        })
        expect(response.movie).toBeDefined()
        expect(response.movie.id).toBe(42)
        expect(response.movie.title).toBe('Inception')
        expect(response.movie.genres).toEqual(['action', 'sci-fi'])
    })

    test('fromRow con notes null', () => {
        const entryRow = { ...mockEntryRow, notes: null }
        const entry = WatchlistEntry.fromRow(entryRow, mockMovieRow)
        const response = entry.toResponse()

        expect(response.notes).toBeNull()
    })

    test('fromRow con priority default 3', () => {
        const entryRow = { ...mockEntryRow, priority: 3 }
        const entry = WatchlistEntry.fromRow(entryRow, mockMovieRow)
        const response = entry.toResponse()

        expect(response.priority).toBe(3)
    })

    // v2 tests (cuando se implementen):
    // test('isHighPriority devuelve true para priority >= 4', () => { ... })
    // test('daysSinceAdded calcula días correctamente', () => { ... })

    // v3 tests:
    // test('updatePriority retorna nueva instancia inmutable', () => { ... })
    // test('toAdminView incluye email usuario', () => { ... })
})