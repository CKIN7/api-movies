import { Router, Response } from 'express'
import { requireAuth } from '../middleware/requireAuth'
import { getRateLimitMetrics, clearMetrics } from '../services/rateLimitMetrics'

// ═══════════════════════════════════════════════════════════════
//  Decisión de Diseño: Controller Omission by Simplicity
// ═══════════════════════════════════════════════════════════════
//  Este router NO usa controllers por las siguientes razones:
//
//  1. PRAGMATISMO / YAGNI (You Aren't Gonna Need It)
//     No se añade complejidad (archivo controller, wiring, exports)
//     hasta que exista una necesidad real.
//
//  2. CONTROLLER THRESHOLD
//     Un controller se justifica cuando hay:
//       - Validación compleja (Zod schemas, DTOs)
//       - Orquestación de múltiples servicios
//       - Transformación de request/response
//       - Lógica condicional de respuesta
//     Aquí NO hay nada de eso: 1 service call → direct JSON.
//
//  3. COMPLEJIDAD ACCIDENTAL VS ESENCIAL
//     Un controller que solo hace `res.json(await service.x())`
//     es boilerplate (complejidad accidental) sin valor de negocio.
//
//  4. SRP (Single Responsibility Principle)
//     Si el controller nunca cambia (no hay lógica de presentación
//     que evolucione), no tiene razón de existir como entidad separada.
//
//  Cuándo SÍ usar controller en este proyecto:
//    - /movies: query params complejos, paginación, múltiples servicios
//    - /auth: body validation, tokens, cookies, flujos múltiples
// ═══════════════════════════════════════════════════════════════

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