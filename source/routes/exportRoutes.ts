import express from 'express'
import ExportController from '../controllers/exportController'

export function createExportRoutes(controller: ExportController) {
    const router = express.Router()
    router.get('/export/:format', controller.handleExport)
    return router
}
