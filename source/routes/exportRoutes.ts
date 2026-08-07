import express from 'express'
import ExportController from '../controllers/exportController'
import { requireAuth } from '../middleware/requireAuth'

export function createExportRoutes(controller: ExportController) {
    const router = express.Router()
    router.get('/export/:format', requireAuth, controller.handleExport)
    return router
}
