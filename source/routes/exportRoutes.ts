import express from 'express'
import ExportController from '../controllers/exportController'
import { requireAuth } from '../middleware/requireAuth'
import { requireRole } from '../middleware/requireRole'

export function createExportRoutes(controller: ExportController) {
    const router = express.Router()
    router.get('/export/:format', requireAuth, requireRole('premium'), controller.handleExport)
    return router
}
