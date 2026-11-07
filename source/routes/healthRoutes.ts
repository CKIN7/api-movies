import { Router } from 'express'
import connection from '../db/connection'
import { getRedisClient } from '../utils/redisClient'
import logger from '../utils/logger'

// ═══════════════════════════════════════════════════════════════
//  Healthchecks para contenedores y orquestacion
// ═══════════════════════════════════════════════════════════════
//  /health       -> liveness: el proceso HTTP esta vivo.
//  /health/ready -> readiness: MySQL y Redis responden.
//  Se monta ANTES del rate limiter para que un pod/host pueda
//  sondear sin consumir cuota ni quedar penalizado.
// ═══════════════════════════════════════════════════════════════

const router = Router()

router.get('/', (_req, res) => {
  res.status(200).json({ status: 'ok' })
})

router.get('/ready', async (_req, res) => {
  let mysql = false
  let redis = false

  try {
    await connection.query('SELECT 1')
    mysql = true
  } catch (error) {
    logger.error(`[Health] MySQL not ready: ${(error as Error).message}`)
  }

  try {
    const client = getRedisClient()
    if (client.status === 'wait') {
      await client.connect()
    }
    const pong = await client.ping()
    redis = pong === 'PONG'
  } catch (error) {
    logger.error(`[Health] Redis not ready: ${(error as Error).message}`)
  }

  const ready = mysql && redis
  res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    checks: { mysql, redis },
  })
})

export { router as healthRouter }
