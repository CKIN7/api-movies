import WatchlistService from '../../services/WatchlistService'
import type { MovieRow } from '../../types/movie'
import type { WatchlistRow } from '../../types/watchlist'

const mockWatchlistRepo = {
    findByUserAndMovie: jest.fn(),
    create: jest.fn(),
    findByUserId: jest.fn(),
    delete: jest.fn()
}

const mockMovieRepo = {
    findById: jest.fn(),
    findByIds: jest.fn()
}

describe('WatchlistService (unit)', () => {
    let service: WatchlistService

    beforeEach(() => {
        jest.clearAllMocks()
        service = new WatchlistService(mockWatchlistRepo as any, mockMovieRepo as any)
    })

    const mockMovieRow: MovieRow = {
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

    const mockEntryRow: WatchlistRow = {
        id: 1,
        user_id: 'user-1',
        movie_id: 42,
        notes: 'Ver luego',
        priority: 4,
        added_at: '2026-01-15T10:30:00.000Z'
    }

    describe('add', () => {
        test('crea entrada y devuelve respuesta completa', async () => {
            mockMovieRepo.findById.mockResolvedValue(mockMovieRow)
            mockWatchlistRepo.findByUserAndMovie
                .mockResolvedValueOnce(null)  // check if exists
                .mockResolvedValueOnce(mockEntryRow)  // get created entry
            mockWatchlistRepo.create.mockResolvedValue(1)

            const result = await service.add('user-1', { movieId: 42, notes: 'Ver luego', priority: 4 })

            expect(result).toMatchObject({
                id: 1,
                userId: 'user-1',
                movieId: 42,
                notes: 'Ver luego',
                priority: 4,
                addedAt: '2026-01-15T10:30:00.000Z'
            })
            expect(result.movie).toBeDefined()
            expect(result.movie.id).toBe(42)
            expect(result.movie.title).toBe('Inception')
        })

        test('lanza 404 si película no existe', async () => {
            mockMovieRepo.findById.mockResolvedValue(null)

            await expect(service.add('user-1', { movieId: 999 })).rejects.toThrow('Película no encontrada')
        })

        test('lanza 409 si ya existe en watchlist', async () => {
            mockMovieRepo.findById.mockResolvedValue(mockMovieRow)
            mockWatchlistRepo.findByUserAndMovie.mockResolvedValue(mockEntryRow)

            await expect(service.add('user-1', { movieId: 42 })).rejects.toThrow('La película ya está en tu watchlist')
        })

        test('usa priority default 3 y notes null si no se proveen', async () => {
            mockMovieRepo.findById.mockResolvedValue(mockMovieRow)
            mockWatchlistRepo.findByUserAndMovie
                .mockResolvedValueOnce(null)
                .mockResolvedValueOnce({ ...mockEntryRow, priority: 3, notes: null })
            mockWatchlistRepo.create.mockResolvedValue(1)

            const result = await service.add('user-1', { movieId: 42 })

            expect(result.priority).toBe(3)
            expect(result.notes).toBeNull()
            expect(mockWatchlistRepo.create).toHaveBeenCalledWith('user-1', 42, null, 3)
        })
    })

    describe('getMyWatchlist', () => {
        test('devuelve lista paginada con películas completas', async () => {
            mockWatchlistRepo.findByUserId.mockResolvedValue({
                rows: [mockEntryRow],
                total: 1
            })
            mockMovieRepo.findByIds.mockResolvedValue([mockMovieRow])

            const result = await service.getMyWatchlist('user-1', {
                page: 1, limit: 10, sortBy: 'addedAt', sortOrder: 'desc'
            })

            expect(result.data).toHaveLength(1)
            expect(result.data[0].movie.id).toBe(42)
            expect(result.meta).toEqual({ total: 1, page: 1, limit: 10, totalPages: 1 })
        })

        test('devuelve lista vacía si no hay entradas', async () => {
            mockWatchlistRepo.findByUserId.mockResolvedValue({ rows: [], total: 0 })
            mockMovieRepo.findByIds.mockResolvedValue([])

            const result = await service.getMyWatchlist('user-1', { page: 1, limit: 10, sortBy: 'addedAt', sortOrder: 'desc' })

            expect(result.data).toEqual([])
            expect(result.meta.total).toBe(0)
        })
    })

    describe('remove', () => {
        test('borra entrada existente', async () => {
            mockWatchlistRepo.delete.mockResolvedValue(true)

            await expect(service.remove('user-1', 42)).resolves.toBeUndefined()
        })

        test('lanza 404 si entrada no existe', async () => {
            mockWatchlistRepo.delete.mockResolvedValue(false)

            await expect(service.remove('user-1', 999)).rejects.toThrow('Entrada no encontrada en tu watchlist')
        })
    })
})