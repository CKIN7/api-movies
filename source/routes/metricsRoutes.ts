import { Router, Response } from 'express'
import { requireAuth } from '../middleware/requireAuth'
import { getRateLimitMetrics, clearMetrics } from '../services/rateLimitMetrics'

const router = Router()

router.get('/rate-limit', requireAuth, async (_req, res: Response) => {
  const metrics = await getRateLimitMetrics()
  res.json(metrics)
})

router.delete('/rate-limit', requireAuth, async (_req, res: Response) => {
  await clearMetrics()
  res.json({ message: 'Metrics cleared' })
})

router.delete('/rate-limit/penalty/:identifier', requireAuth, async (req, res: Response) => {
  const { clearPenalty } = await import('../middleware/penaltyBox')
  const identifier = Array.isArray(req.params.identifier) ? req.params.identifier[0] : req.params.identifier
  await clearPenalty(identifier)
  res.json({ message: `Penalty cleared for ${identifier}` })
})

export { router as metricsRouter }