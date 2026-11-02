# Fix: fail-open del rate limiter con Redis no disponible

> **Tipo:** Fix · **Estado:** Implementado · **Revisión:** 2026-10-29 · **Rama:** `fix/rate-limiter-redis-down`

Como usuario de la API,
quiero que una caída de Redis no me devuelva `500` en todas las rutas,
para poder seguir operando (degradado, sin rate limiting) mientras la infraestructura vuelve.

Este fix no agrega endpoints ni cambia el contrato público: corrige el manejo de errores del
rate limiter. La política `RATE_LIMIT_FAIL_OPEN` ya existía y estaba documentada, pero **no se
cumplía**.

---

## Contexto

`createApp` monta el limiter antes que todo (`api.ts:96`), así que sus errores afectan a
**cualquier** request, incluido `POST /auth/register`:

```ts
app.use(rateLimiterMiddleware ?? (isRateLimitEnabled() ? rateLimiter : noopRateLimiter))
```

El defecto se observó en producción local: con Redis caído (o `REDIS_URL` apuntando a un puerto
cerrado) el registro devolvía

```json
{ "error": "Connection is closed." }
```

con `500`, y el handler de `authService` **nunca se ejecutaba**. La cadena era:

```
rateLimiter.ts:22   checkPenalty(identifier)        ← FUERA del try
  penaltyBox.ts:18    redis.ttl(...)
    redisClient.ts:14   retryStrategy → null tras 3 intentos
      ioredis           "Connection is closed."
        api.ts:200      res.status(500).json({ error: err.message })
```

Tres defectos independientes:

| # | Ubicación | Problema |
|---|-----------|----------|
| D1 | `middleware/rateLimiter.ts:22` | `checkPenalty` fuera del `try`, sin fail-open |
| D2 | `services/rateLimitMetrics.ts:100-102` | `incrementMetric` propagaba el error de Redis, así que el `catch` que implementa fail-open (líneas 38-39) **volvía a lanzar** al registrar la métrica |
| D3 | `utils/redisClient.ts:14-16` | `retryStrategy` devuelve `null` tras 3 intentos: la conexión queda cerrada de forma permanente y no se recupera hasta reiniciar el proceso |

D1 y D2 hacen que `RATE_LIMIT_FAIL_OPEN=true` sea una promesa incumplida. D3 queda **fuera de
alcance** de este fix (ver "Deuda conocida").

---

## Spec

### S1 — `checkPenalty` respeta el fail-open

Misma semántica que ya usaba `executeSlidingWindow`: ante un error de Redis se registra la
métrica y se deja pasar la request si `RATE_LIMIT_FAIL_OPEN` está activo; si no, se propaga.

```ts
let penalty: { blocked: boolean; retryAfter?: number }
try {
  penalty = await checkPenalty(identifier)
} catch (err) {
  await recordRedisError()
  if (rateLimitConfig.failOpen) return next()
  throw err
}
```

Un Redis caído implica "no hay penalización activa": no se puede afirmar que el cliente esté
bloqueado, y fail-**open** es la decisión ya tomada en la configuración.

### S2 — Las métricas son best-effort

`incrementMetric` atrapa el error y lo descarta: la observabilidad no puede tumbar un request.

```ts
export async function incrementMetric(key: keyof typeof METRICS_KEYS): Promise<void> {
  try {
    await getRedisClient().incr(METRICS_KEYS[key])
  } catch {
    // Sin Redis el contador se pierde; el request sigue su curso.
  }
}
```

Esto cubre los cuatro `record*` (`recordHit`, `recordRejection`, `recordRedisError`,
`recordRedisSlow`) y es requisito para que S1 funcione: si `recordRedisError()` lanzara, el
`catch` de S1 volvería a propagar el error.

### S3 — Fuera de alcance

- Reconexión del cliente compartido (D3).
- `getRateLimitMetrics` (endpoint de administración): sigue fallando si Redis no responde, por
  ser una lectura explícita y no parte del camino de request.

---

## Criterios de aceptación

- [x] CA-1: Con Redis inaccesible y `RATE_LIMIT_FAIL_OPEN=true`, un `POST /auth/register` **no**
      devuelve `500`; el handler corre y responde `201` (el fallo del encolado sigue siendo
      best-effort).
- [x] CA-2: Con `RATE_LIMIT_FAIL_OPEN=false`, el error de Redis se propaga (comportamiento
      previo, ahora explícito y testeado).
- [x] CA-3: Ni `checkPenalty` ni las métricas pueden romper el request por sí solos.
- [x] CA-4: Con Redis sano, el flujo no cambia: headers, `429` y `403` por penalización siguen
      igual.

---

## Casos borde

| # | Caso | Comportamiento esperado |
|---|------|-------------------------|
| E1 | `checkPenalty` falla, fail-open activo | `next()`; request continúa sin rate limiting |
| E2 | `executeSlidingWindow` falla, fail-open activo | `next()` (comportamiento previo, ahora cubierto por test) |
| E3 | Cualquiera de los dos falla, fail-open desactivado | El error se propaga al error handler |
| E4 | Redis sano | Sin cambios: `recordHit`, headers, `429`, `403` |
| E5 | Redis cae con penalización activa en curso | Se pierde la penalización (no se puede leer): degradación aceptada |

---

## Verificación

```powershell
# Unit
npx jest __tests__/unit/rateLimiter.middleware.test.ts __tests__/unit/rateLimitMetrics.test.ts
```

Prueba manual (la que expuso el defecto), con `RATE_LIMIT_ENABLED=true` y `REDIS_URL` apuntando a
un puerto cerrado:

| Antes | Después |
|-------|---------|
| `500 { "error": "Connection is closed." }` en ~1 s | `201` (tras `EMAIL_ENQUEUE_TIMEOUT_MS`) |
| El handler no se ejecutaba | `register` corre; el encolado falla con log y la respuesta es `201` |

---

## Deuda conocida

| Item | Detalle |
|------|---------|
| **D3: sin reconexión** | `retryStrategy` devuelve `null` tras 3 intentos: con Redis caído, el cliente compartido (rate limiter + cache) no se recupera solo, incluso cuando Redis vuelve. Requiere reiniciar el proceso. Candidato a `fix/redis-client-reconnect` |
| **Penalización no persistente ante caída** | Si Redis cae con una IP penalizada, la penalización se pierde (E5). Aceptado: la alternativa es fall-**closed**, que rompería disponibilidad |
| **Métricas perdidas** | Con Redis caído no se registran hits/errores. Aceptado: best-effort explícito |

---

## Archivos

| Archivo | Cambio |
|---------|--------|
| `middleware/rateLimiter.ts` | `checkPenalty` dentro de `try/catch` con fail-open |
| `services/rateLimitMetrics.ts` | `incrementMetric` no propaga errores |
| `__tests__/unit/rateLimiter.middleware.test.ts` | Nuevo: fail-open, fail-closed y camino feliz |
| `__tests__/unit/rateLimitMetrics.test.ts` | Casos de métricas best-effort |
| `docs/cross-cutting/rate-limiter-test-isolation.md` | Corrige E1, que afirmaba un fail-open que no ocurría |
