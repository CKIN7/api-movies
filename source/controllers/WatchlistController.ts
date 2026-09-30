import type { Request, Response } from 'express'
import WatchlistService from '../services/WatchlistService'
import { addToWatchlistSchema, watchlistQuerySchema, movieIdParamSchema } from '../schemas/watchlistSchema'

class WatchlistController {
    constructor(private watchlistService: WatchlistService) {}

    add = async (req: Request, res: Response) => {
        const parsed = addToWatchlistSchema.safeParse(req.body)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        const entry = await this.watchlistService.add(userId, parsed.data)

        res.status(201).json({
            message: 'Película agregada a tu watchlist',
            data: entry
        })
    }

    getMyWatchlist = async (req: Request, res: Response) => {
        const parsed = watchlistQuerySchema.safeParse(req.query)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        const result = await this.watchlistService.getMyWatchlist(userId, parsed.data)

        res.json(result)
    }

    remove = async (req: Request, res: Response) => {
        const parsed = movieIdParamSchema.safeParse(req.params)
        if (parsed.error) {
            return res.status(400).json({ error: parsed.error.message })
        }

        const userId = req.user!.id
        await this.watchlistService.remove(userId, parsed.data.movieId)

        res.status(204).send()
    }
}

export default WatchlistController