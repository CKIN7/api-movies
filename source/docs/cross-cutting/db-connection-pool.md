# HU-12: Pool de Conexiones MySQL + Ciclo de Vida en Tests

> **Tipo:** Infra · **Alcance:** Base de datos · **Estado:** Implementado · **Revisión:** 2026-10-21

Como desarrollador de la API,
quiero que la aplicación use un pool de conexiones MySQL con ciclo de vida explícito y que los tests de integración no bloqueen la base de datos con DDL,
para que las transacciones sigan siendo correctas, no se filtren conexiones huérfanas y la suite de integración sea estable (sin cuelgues ni timeouts).

---

## Contexto y problema

Antes de esta feature, `db/connection.ts` creaba **una sola conexión** (`mysql.createConnection`), compartida por los ~13 repositorios vía el composition root (`api.ts`). Eso producía, entre otros:

1. **Sin recuperación ante fallos.** Una conexión única que muere a mitad de query no se reemplaza: las siguientes queries pueden quedar pendientes para siempre ("DB pegada").
2. **Fuga de estado de sesión.** `SET FOREIGN_KEY_CHECKS`, transacciones abiertas o `USE` se heredan entre operaciones en la misma conexión.
3. **Conexiones huérfanas en tests.** La conexión de la app se abría al importar `api.ts` y **nunca se cerraba** (no había `globalTeardown`).
4. **DDL contra conexiones abiertas.** `setupTestDb()` re-aplicaba `db/schema.sql` (`DROP TABLE`/`CREATE TABLE`) por suite; el DDL espera un **metadata lock**, y una conexión *idle-in-transaction* colgaba la suite.
5. **Transacciones rotas con pool.** `MovieRepository.transaction()` (y `EmailVerificationRepository.transaction()`) asumían la conexión única; con un pool, las queries internas podían caer en conexiones distintas y romper la atomicidad.

---

## Alcance

* `db/connection.ts` pasa de `createConnection` a `createPool` con opciones de resiliencia y expone `closeDb()`.
* `db/transactionContext.ts` (nuevo): propaga la conexión transaccional con `AsyncLocalStorage`.
* `MovieRepository.transaction()` y `EmailVerificationRepository.transaction()` toman una conexión dedicada del pool y la liberan siempre.
* Los repositorios que participan en transacciones resuelven su conexión desde el contexto: `Director`, `Genre`, `Cast`, `AuditLog`, `User` y `RefreshToken`.
* Cierre del pool en el apagado del servidor y en el teardown de cada suite de test.
* `setupTestDb()` deja de re-aplicar el esquema por suite.

### No alcance

* No toca el rate limiter ni Redis.
* No cambia los contratos de los endpoints.

---

## Criterios de aceptación

* **CA-01 — Pool.** `db/connection.ts` exporta un `Pool` de MySQL con `waitForConnections`, `connectionLimit`, `connectTimeout`, `enableKeepAlive` e `idleTimeout`.
* **CA-02 — Cierre explícito.** Existe `closeDb()` que cierra el pool; se invoca en SIGTERM/SIGINT del servidor.
* **CA-03 — Transacción atómica.** Todas las operaciones dentro de `transaction()` usan **la misma** conexión del pool; se libera en éxito, error y excepción.
* **CA-04 — Compatibilidad de tests.** Si el conn inyectado no es un pool (una `Connection` de test), `transaction()` la usa directamente sin reserva/liberación.
* **CA-05 — Sin huérfanas.** Al terminar cada archivo de test se cierra el pool de la app (`setupFilesAfterEnv`).
* **CA-06 — Sin DDL por suite.** `setupTestDb()` no vuelve a aplicar el esquema; cada suite arranca con tablas vacías sin `DROP/CREATE TABLE`.
* **CA-07 — Recuperación.** Una conexión muerta en el pool se reemplaza y las queries siguientes funcionan.
* **CA-08 — Dos transacciones migradas.** Tanto `MovieService` (create/update/delete) como `AuthService.resetPassword` ejecutan todas sus queries sobre una única conexión.

---

## Happy Path

| # | Escenario | Comportamiento |
|---|-----------|----------------|
| H1 | `GET /movies` | ✅ 200 — query atendida por el pool |
| H2 | `POST /movies` (transacción) | ✅ 201 — director/movie/géneros/cast/audit en una sola conexión atómica |
| H3 | `PATCH /movies/:id` (transacción) | ✅ 200 — snapshot de auditoría consistente |
| H4 | `DELETE /movies/:id` (transacción) | ✅ 200 — audit + borrados atómicos |
| H5 | Apagado del servidor (SIGTERM) | Redis y pool cerrados limpiamente |

---

## Boundary / Corner / Edge Cases

| # | Caso | Comportamiento esperado |
|---|------|------------------------|
| B1 | `transaction()` con éxito | conexión liberada (`release`) |
| B2 | `transaction()` con error | `rollback` + `release` |
| C1 | Conn inyectado es `Connection` de test | se usa directo, sin `getConnection`/`release` |
| C2 | Suite sin datos previos | `setupTestDb()` vacía tablas; no aplica DDL |
| E1 | Conexión del pool muere | pool entrega una nueva |
| E2 | Muchas queries concurrentes | atendidas hasta `connectionLimit`, luego encoladas (`queueLimit: 0`) |

---

## Notas de implementación

1. **Opciones del pool** (`db/connection.ts`):

   ```ts
   mysql.createPool({
       waitForConnections: true,
       connectionLimit: Number(process.env.DB_POOL_LIMIT) || 10,
       queueLimit: 0,
       connectTimeout: Number(process.env.DB_CONNECT_TIMEOUT_MS) || 10_000,
       enableKeepAlive: true,
       keepAliveInitialDelay: 10_000,
       idleTimeout: Number(process.env.DB_IDLE_TIMEOUT_MS) || 60_000,
   }).promise()
   ```

2. **Contexto transaccional** (`db/transactionContext.ts`): `AsyncLocalStorage<PoolConnection>`. `runInTransaction(conn, fn)` publica la conexión; `activeConnection(fallback)` la resuelve desde cualquier repositorio sin pasarla por parámetro.

3. **`transaction()`** (`MovieRepository.ts` y `EmailVerificationRepository.ts`): detecta si el conn es un pool (`typeof this.conn.getConnection === 'function'`), reserva conexión, `beginTransaction`, corre el callback dentro del contexto, `commit`/`rollback` y `release` en `finally`. Si el conn no es un pool (una `Connection` de test), se usa directo.

4. **Repositorios transaccionales:** `MovieRepository`, `DirectorRepository`, `GenreRepository`, `CastRepository`, `AuditLogRepository`, `EmailVerificationRepository`, `UserRepository` y `RefreshTokenRepository` cambian `this.conn.query(...)` por `activeConnection(this.conn).query(...)`.

5. **Teardown en tests** (`__tests__/helpers/closeDb.js` + `jest.config.js`): `setupFilesAfterEnv` registra `afterAll(closeDb)` en el worker, cerrando el pool de cada archivo de test. (No se usa `globalTeardown` porque corre en el proceso principal y no alcanza los pools de los workers.)

6. **`setupTestDb()`** (`__tests__/helpers/db.ts`): ya no aplica el esquema (lo crea `globalSetup` una sola vez, antes de abrir conexiones). Devuelve una `Connection` propia para los helpers de test y vacía tablas con `clearAll`.

7. **Apagado del servidor** (`api.ts`): `closeDb()` junto a `disconnectRedis()` en SIGTERM/SIGINT.

8. **Corrección de un segundo camino transaccional.** El refactor descubrió que `EmailVerificationRepository.transaction()` (usado por `AuthService.resetPassword`) seguía llamando `this.conn.beginTransaction()`: con un pool, `PromisePool` **no expone** `beginTransaction`/`commit`/`rollback` (solo `getConnection`, `query`, `execute`, `end`), así que lanzaba `TypeError` y `POST /auth/reset` respondía **500**. Se migró al mismo patrón y se llevaron al contexto `UserRepository` y `RefreshTokenRepository`, cuyas queries participan en esa transacción (de lo contrario la transacción no habría sido atómica).

---

## Archivos (creados ✧ / modificados ✎)

```text
source/
├── db/
│   ├── connection.ts                     ✎ createPool + closeDb()
│   └── transactionContext.ts             ✧ AsyncLocalStorage
├── repositories/
│   ├── MovieRepository.ts                ✎ transaction() con conexión dedicada
│   ├── DirectorRepository.ts             ✎ activeConnection()
│   ├── GenreRepository.ts                ✎ activeConnection()
│   ├── CastRepository.ts                 ✎ activeConnection()
│   ├── AuditLogRepository.ts             ✎ activeConnection()
│   ├── EmailVerificationRepository.ts    ✎ transaction() con conexión dedicada + activeConnection()
│   ├── UserRepository.ts                 ✎ activeConnection()
│   └── RefreshTokenRepository.ts         ✎ activeConnection()
├── __tests__/helpers/
│   ├── closeDb.js                        ✧ afterAll(closeDb)
│   └── db.ts                             ✎ setupTestDb sin DDL por suite
├── jest.config.js                        ✎ + setupFilesAfterEnv
└── api.ts                                ✎ closeDb() en el apagado
```

---

## Diagrama de flujo (textual)

```text
Request: POST /movies  (transacción)
  │
  ├─ movieService.createMovie()
  │    └─ movieRepo.transaction(fn)
  │         ├─ ¿conn es pool? → conn = pool.getConnection()
  │         ├─ conn.beginTransaction()
  │         ├─ AsyncLocalStorage.run(conn, fn)
  │         │      ├─ directorRepo.findOrCreate()   → activeConnection() = conn
  │         │      ├─ movieRepo.insert()            → activeConnection() = conn
  │         │      ├─ genreRepo.findOrCreate()/link → activeConnection() = conn
  │         │      └─ auditRepo.record()            → activeConnection() = conn
  │         ├─ conn.commit()
  │         └─ finally: conn.release()
  │
  └─ Response: 201 Created

Request: POST /auth/reset  (transacción)
  │
  ├─ authService.resetPassword()
  │    └─ emailVerificationRepo.transaction(fn)
  │         ├─ ¿conn es pool? → conn = pool.getConnection()
  │         ├─ conn.beginTransaction()
  │         ├─ AsyncLocalStorage.run(conn, fn)
  │         │      ├─ userRepo.updatePassword()          → activeConnection() = conn
  │         │      ├─ emailVerificationRepo.markUsed()    → activeConnection() = conn
  │         │      └─ refreshTokenRepo.revokeAllByUserId() → activeConnection() = conn
  │         ├─ conn.commit()
  │         └─ finally: conn.release()
  │
  └─ Response: 200 OK

Tests (por archivo):
  globalSetup → crea la BD de tests con el esquema (una sola vez)
  setupFiles → apunta DB_NAME a la BD de tests
  beforeAll  → setupTestDb(): clearAll (sin DDL) + Connection propia
  afterAll   → teardownTestDb(db) + closeDb()
```

---

## Verificación

* `npx tsc --noEmit` → sin errores.
* `movies.api.integration` (create/update/delete transaccionales) → 12/12 ✅.
* Suite completa con Redis limpio: rama **15 suites / 56 tests** fallidos vs `main` **17 / 71** → sin regresiones (los fallos restantes son pre-existentes: pollution del rate limiter y seed de `auth`).
* Comparación en aislamiento de `auth.login`, `auth.verify`, `reviews.api` → idéntico resultado que `main`.
* Análisis estático de la corrección: ningún repositorio que participa en una transacción quedó con `this.conn.query` directo. Los que aún lo usan (`RecommendationRepository`, `ReviewRepository`, `UserPreferencesRepository`, `WatchlistRepository`) **no** se invocan dentro de un `transaction()`.
