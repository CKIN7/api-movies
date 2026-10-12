import type { Request, Response } from 'express'
import SearchService from '../services/searchService'
import { searchQuerySchema } from '../schemas/searchQuery'
import { suggestQuerySchema } from '../schemas/suggestQuerySchema'

class SearchController {
    constructor(private searchService: SearchService) {}

    search = async (req: Request, res: Response) => {
        const parsed = searchQuerySchema.parse(req.query)
        const result = await this.searchService.search(parsed)
        res.json(result)
    }

    suggest = async (req: Request, res: Response) => {
        const parsed = suggestQuerySchema.parse(req.query)
        const result = await this.searchService.suggest(parsed)
        res.json(result)
    }
}

export default SearchController
