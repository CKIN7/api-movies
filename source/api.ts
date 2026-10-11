import express from 'express'
import { createMovieRoutes } from './routes/movieRoutes'
import MovieController from './controllers/movieController'
import MovieService from './services/movieService'
import MovieRepository from './repositories/MovieRepository'
import DirectorRepository from './repositories/DirectorRepository'
import GenreRepository from './repositories/GenreRepository'
import AuditLogRepository from './repositories/AuditLogRepository'
import CastRepository from './repositories/CastRepository'
import AppError from './utils/AppError'
import { ZodError } from 'zod'
import logger from './utils/logger'
import { requestLogger } from './middleware/requestLogger'
import { rateLimiter } from './middleware/rateLimiter'
import { connectRedis, disconnectRedis } from './utils/redisClient'
import type { Request, Response, NextFunction } from 'express'
import connection from './db/connection'
import ExportService from './services/exportService'
import ExportController from './controllers/exportController'
import { createExportRoutes } from './routes/exportRoutes'
import AuthService from './services/authService'
import UserRepository from './repositories/UserRepository'
import RefreshTokenRepository from './repositories/RefreshTokenRepository'
import AuthController from './controllers/authController'
import { createAuthRoutes } from './routes/authRoutes'
import EmailVerificationRepository from './repositories/EmailVerificationRepository'
import DevEmailVerificationNotifier from './notifiers/DevEmailVerificationNotifier'
import DevPasswordResetNotifier from './notifiers/DevPasswordResetNotifier'
import ReviewRepository from './repositories/ReviewRepository'
import ReviewService from './services/reviewService'
import ReviewController from './controllers/reviewController'
import { createReviewRoutes } from './routes/reviewRoutes'
import WatchlistRepository from './repositories/WatchlistRepository'
import WatchlistService from './services/WatchlistService'
import WatchlistController from './controllers/WatchlistController'
import { createWatchlistRoutes } from './routes/watchlistRoutes'
import { metricsRouter } from './routes/metricsRoutes'
import SearchService from './services/searchService'
import SearchController from './controllers/searchController'
import { createSearchRoutes } from './routes/searchRoutes'
import { getMovieIndex } from './utils/meilisearchClient'

// ═══════════════════════════════════════════════════════════════
//  Patrones: Dependency Injection + Factory + Chain of Resp.
// ═══════════════════════════════════════════════════════════════
//  DI: Composition root. Crea todas las dependencias (repos,
//  servicios, controladores) y las inyecta por constructor.
//  Permite inyectar un MovieService mockeado para tests.
//  Factory: createApp() funciona como factory del objeto Express.
//  Chain of Resp.: El middleware de Express forma una cadena:
//  json → requestLogger → router de movies → error handler → 404.
// ═══════════════════════════════════════════════════════════════

export function createApp(movieService?: MovieService, searchService?: SearchService) {
    const app = express()

    app.disable('x-powered-by')
    app.use(express.json())
    app.use(rateLimiter)
    app.use(requestLogger)
    app.use(express.static('public'))

    const conn = connection

    const movieRepo = new MovieRepository(conn)
    const directorRepo = new DirectorRepository(conn)
    const genreRepo = new GenreRepository(conn)
    const auditRepo = new AuditLogRepository(conn)
    const castRepo = new CastRepository(conn)
    const userRepository = new UserRepository(conn)
    const refreshTokenRepository = new RefreshTokenRepository(conn)
    const emailVerificationRepository = new EmailVerificationRepository(conn)

    const searchServiceInstance = searchService ?? new SearchService(getMovieIndex(), movieRepo)
    const _service = movieService || new MovieService(movieRepo, directorRepo, genreRepo, auditRepo, castRepo, undefined, searchServiceInstance)
    const controller = new MovieController(_service)
    const router = createMovieRoutes(controller)

    const searchController = new SearchController(searchServiceInstance)
    const searchRouter = createSearchRoutes(searchController)

    const notifier = new DevEmailVerificationNotifier()
    const resetNotifier = new DevPasswordResetNotifier()


    const exportService = new ExportService(movieRepo)
    const exportController = new ExportController(exportService)
    const exportRouter = createExportRoutes(exportController)

    const authService = new AuthService(userRepository, refreshTokenRepository, emailVerificationRepository, notifier, resetNotifier)
    const authController = new AuthController(authService)
    const authRouter = createAuthRoutes(authController)

    const reviewRepository = new ReviewRepository(conn)
    const reviewService = new ReviewService(reviewRepository, movieRepo)
    const reviewController = new ReviewController(reviewService)
    const reviewRouter = createReviewRoutes(reviewController)

    const watchlistRepository = new WatchlistRepository(conn)
    const watchlistService = new WatchlistService(watchlistRepository, movieRepo)
    const watchlistController = new WatchlistController(watchlistService)
    const watchlistRouter = createWatchlistRoutes(watchlistController)

    app.use('/movies/search', searchRouter)
    app.use('/movies', exportRouter)
    app.use('/movies', router)
    app.use('/movies', reviewRouter)
    app.use('/users', watchlistRouter)
    app.use('/auth', authRouter)
    app.use('/metrics', metricsRouter)

    app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
        const statusCode = err instanceof AppError ? err.statusCode : err instanceof ZodError ? 400 : 500
        logger.error(`Error handler: ${err.message}`, { statusCode, stack: err.stack })
        res.status(statusCode).json({ error: err.message })
    })

    app.use((req: Request, resp: Response) => {
        resp.status(404).send('Ruta no encontrada')
    })

    return app
}

if (require.main === module) {
    const app = createApp()

    connectRedis()
        .then(() => {
            const PORT = 8089
            app.listen(PORT, () => {
                logger.info(`Servidor escuchando en http://localhost:${PORT}`)
            })
        })
        .catch((err) => {
            logger.error('Failed to connect to Redis', { error: err.message })
            process.exit(1)
        })

    process.on('SIGTERM', async () => {
        logger.info('SIGTERM received, shutting down gracefully')
        await disconnectRedis()
        process.exit(0)
    })

    process.on('SIGINT', async () => {
        logger.info('SIGINT received, shutting down gracefully')
        await disconnectRedis()
        process.exit(0)
    })
}
