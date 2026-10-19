# Feature 2: Aislamiento del rate limiter en tests

Como desarrollador de la API,
quiero que el rate limiter no contamine el estado entre suites de tests,
para que la suite completa sea determinista y no dependa del orden de ejecución ni de un Redis "sucio".

---

## Contexto y problema

`createApp()` monta el rate limiter como middleware global (`api.ts`). El limiter guarda su estado en Redis DB 0, compartida con desarrollo, con identificador por IP (en local siempre `127.0.0.1`):

| Clave | TTL |
|-------|-----|
| `ratelimit:<scope>:<identifier>:<windowStart>` | `windowMs` (~60 s) |
| `ratelimit:penalty:<identifier>` | 15 min (`RATE_LIMIT_PENALTY_DURATION_MS`) |
| `ratelimit:penaltyrejections:<scope>:<identifier>` | 5 min (`RATE_LIMIT_PENALTY_WINDOW_MS`) |
| `ratelimit:metrics:*` | sin expiración |

Con los umbrales de auth (10 rechazos) basta una suite que sature `/auth/` para penalizar a `127.0.0.1` durante 15 minutos. Todas las suites siguientes reciben `403` en cualquier request, produciendo fallos masivos y no deterministas.

Las mitigaciones previas no bastaban:

* `resetRateLimitState()` solo se ejecutaba en suites que usaban `setupTestDb()`, una vez en `beforeAll`, y limpiaba por patrón sobre DB 0.
* `rate-limiter.redis.integration.test.ts` limpiaba prefijos incorrectos (`penalty:*` en vez de `ratelimit:penalty:*`) y seguía compartiendo DB 0.
* `rate-limiter.integration.test.ts` mockeaba `utils/redisClient` sin `loadLuaScripts`: el middleware lanzaba y hacía fail-open, por lo que el test pasaba sin ejercitar el limiter (falso positivo).

---

## Alcance

* `createApp()` acepta un tercer parámetro opcional `rateLimiterMiddleware` (default: limiter real).
* Nuevo flag `RATE_LIMIT_ENABLED` (default habilitado; `false` desactiva el limiter).
* Los workers de test apuntan a una Redis DB dedicada (`/15`) y desactivan el limiter por defecto.
* Las suites del limiter reactivan el flag, inyectan el middleware real y hacen `FLUSHDB` sobre la DB 15.
* Se elimina `resetRateLimitState()` de `__tests__/helpers/db.ts`.
* Se corrige el falso positivo de `rate-limiter.integration.test.ts`.
* Script `npm run test:ratelimit`.

### No alcance

* No cambia el comportamiento del limiter en producción (sigue activo por defecto y en DB 0).
* No se paraleliza la suite ni se migra a `jest projects` (se mantiene `maxWorkers: 1`).
* No se tocan los fallos pre-existentes de `auth.login`, `auth.verify` ni `reviews.api`.

---

## Criterios de aceptación

* **CA-1 — Penalización aislada.** Una suite que activa el penalty box no afecta a ninguna otra, sin limpieza manual.
* **CA-2 — Determinismo.** La suite completa no depende del orden de ejecución ni de un Redis sucio.
* **CA-3 — Tests reales del limiter.** Los tests del limiter ejercitan el middleware real (429/penalty/headers), no un fail-open silencioso.
* **CA-4 — Inyección/desactivación explícita.** `createApp(..., rateLimiterMiddleware?)` permite inyectar un middleware; `RATE_LIMIT_ENABLED=false` lo desactiva.
* **CA-5 — Sin limpieza legacy.** `resetRateLimitState()` eliminado y sin regresiones.

---

## Happy Path

| # | Escenario | Comportamiento |
|---|-----------|----------------|
| H1 | Suite normal con `RATE_LIMIT_ENABLED=false` | El limiter no se ejecuta; no escribe en Redis |
| H2 | Suite del limiter | Reactiva el flag, usa DB 15, `FLUSHDB` por test y valida 429/penalty |
| H3 | Producción `createApp()` | Limiter real montado, DB 0, comportamiento sin cambios |
| H4 | Producción `RATE_LIMIT_ENABLED=false` | Limiter desactivado explícitamente |

---

## Boundary / Corner / Edge Cases

| # | Caso | Comportamiento esperado |
|---|------|------------------------|
| B1 | Test inyecta un no-op | Se usa el inyectado, sin consultar Redis |
| B2 | Test inyecta el limiter real | Se usa el real, aunque el flag esté en `false` |
| C1 | Redis de tests venía sucio | `FLUSHDB` deja la DB 15 limpia antes del test |
| C2 | Test del limiter deja penalty activa | `FLUSHDB` en `afterAll` evita filtrarla |
| E1 | Redis no disponible | Se mantiene el fail-open del limiter real (`RATE_LIMIT_FAIL_OPEN`) |
| E2 | `REDIS_URL_TEST` definido | Se respeta tal cual; si no, se reescribe el índice a `/15` |

---

## Notas de implementación

1. **Flag en tiempo de llamada** (`config/rateLimitConfig.ts`):

   ```ts
   export function isRateLimitEnabled(): boolean {
     return process.env.RATE_LIMIT_ENABLED !== 'false'
   }
   ```

   Se evalúa en cada `createApp()`, no al importar el módulo, para que una suite pueda reactivarlo en `beforeAll`.

2. **Inyección en `createApp`** (`api.ts`):

   ```ts
   export function createApp(
       movieService?: MovieService,
       searchService?: SearchService,
       rateLimiterMiddleware?: RequestHandler
   ) {
       app.use(rateLimiterMiddleware ?? (isRateLimitEnabled() ? rateLimiter : noopRateLimiter))
   }
   ```

   El tercer parámetro es opcional, por lo que las llamadas existentes (`createApp()`, `createApp(service)`) siguen recibiendo el limiter real.

3. **Entorno de test por worker** (`__tests__/helpers/setTestDbEnv.js`):

   ```js
   process.env.REDIS_URL =
       process.env.REDIS_URL_TEST ||
       (process.env.REDIS_URL || 'redis://localhost:6379').replace(/\/\d+$/, '') + '/15'
   process.env.RATE_LIMIT_ENABLED = 'false'
   ```

   Así ninguna suite normal escribe en Redis ni en DB 0.

4. **Suites del limiter** (`rate-limiter.integration.test.ts` y `rate-limiter.redis.integration.test.ts`):

   ```ts
   beforeAll(async () => {
     process.env.RATE_LIMIT_ENABLED = 'true'
     redis = await connectRedis()
     await redis.flushdb()
   })

   beforeEach(() => redis.flushdb())

   afterAll(async () => {
     await redis.flushdb()
     await disconnectRedis()
     process.env.RATE_LIMIT_ENABLED = 'false'
   })
   ```

   Se usa `flushdb()` (solo DB 15), nunca `flushall()` (borraría DB 0).

5. **Falso positivo corregido.** `rate-limiter.integration.test.ts` deja de mockear `redisClient` y valida contra Redis real: headers de límite global, `429` al superar auth y `403` con `X-RateLimit-Penalty` tras activar el penalty box.

6. **Limpieza legacy.** `setupTestDb()` ya no llama a `resetRateLimitState()`; el aislamiento se garantiza por DB dedicada + flag desactivado.

---

## Archivos (creados ✧ / modificados ✎)

```text
source/
├── api.ts                                              ✎ 3er parametro + flag
├── config/rateLimitConfig.ts                           ✎ isRateLimitEnabled()
├── package.json                                        ✎ script test:ratelimit
├── __tests__/helpers/
│   ├── setTestDbEnv.js                                 ✎ REDIS_URL /15 + flag off
│   └── db.ts                                           ✎ sin resetRateLimitState()
├── __tests__/integration/
│   ├── rate-limiter.integration.test.ts                ✎ Redis real, sin falso positivo
│   └── rate-limiter.redis.integration.test.ts          ✎ FLUSHDB DB 15 + flag on
├── __tests__/unit/rateLimitConfig.test.ts              ✎ threshold real + flag
└── docs/features/feature-rate-limiter-test-isolation.md ✧
```

---

## Verificación

* `npx tsc --noEmit` → sin errores.
* `npm run test:ratelimit` → suites del limiter en verde.
* Suite completa comparada con el baseline de `feature/db-connection-pool` (15 suites / 56 tests fallidos): sin regresiones y sin fallos dependientes del orden.
* Tras `test:ratelimit`, DB 15 sin `ratelimit:penalty:*` y DB 0 intacta:

  ```powershell
  node -e "const R=require('ioredis');const c=new R('redis://localhost:6379/15');(async()=>{console.log(await c.keys('ratelimit:penalty:*'));await c.quit()})()"
  node -e "const R=require('ioredis');const c=new R('redis://localhost:6379/0');(async()=>{console.log(await c.keys('ratelimit:*'));await c.quit()})()"
  ```
