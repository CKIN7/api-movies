import express from 'express'
import WatchlistController from '../controllers/WatchlistController'
import { requireAuth } from '../middleware/requireAuth'

export function createWatchlistRoutes(controller: WatchlistController) {
    const router = express.Router()
    router.post('/me/watchlist', requireAuth, controller.add)
    router.get('/me/watchlist', requireAuth, controller.getMyWatchlist)
    router.delete('/me/watchlist/:movieId', requireAuth, controller.remove)
    return router
}