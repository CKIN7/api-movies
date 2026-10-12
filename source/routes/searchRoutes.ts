import express from 'express'
import SearchController from '../controllers/searchController'

export function createSearchRoutes(controller: SearchController) {
    const router = express.Router()
    router.get('/', controller.search)
    return router
}
