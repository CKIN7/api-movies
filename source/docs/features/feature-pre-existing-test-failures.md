# Fix: Fallos de test pre-existentes

Como desarrollador de la API,
quiero eliminar los fallos de test que ya existían antes de las mejoras de infraestructura,
para que la suite completa quede totalmente en verde, determinista y sin depender de estado previo.

---

## Contexto y problema

Tras aislar el rate limiter (ver `feature-rate-limiter-test-isolation.md`), la suite completa seguía con **13 suites / 24 tests fallidos** ajenos al limiter. Los fallos se agrupaban en seis causas independientes:

| # | Causa | Suites afectadas |
|---|-------|------------------|
| 1 | El contrato de `POST /auth/register` cambió a `{ message, user: { id, email, role } }` pero los tests leían los campos en la raíz (`res.body.id`). | `auth.register`, `auth.verify`, `auth.resend` |
| 2 | El hash bcrypt del usuario seed no correspondía a la contraseña documentada `password123`, provocando `401` en login. | `auth.login`, `auth.refresh`, `auth.logout`, `auth.reset` |
| 3 | `MovieResponse` pasó a incluir `averageRating` y `reviewsCount`, y las expectativas/filas fake de los tests no los contemplaban (`averageRating: NaN`). | `unit/movies.service`, `unit/movies.create`, `unit/movies.random-batch` |
| 4 | `MovieService` sin cache inyectada usa el cliente Redis real, contaminando `movies:list:*` entre tests unitarios. | `pagination/movies.pagination.unit`, `unit/movies.service` |
| 5 | El `seedTestData` por test supera el timeout de hook de 5 s; el aluvión deja filas y el siguiente seed choca con `Duplicate entry '1-1' for key 'movie_actors.PRIMARY'`. | `movies.suggest` |
| 6 | `ratingStr` usaba `fc.double(...)` sin `noNaN`, que puede generar `NaN`; `String(NaN)` = `"NaN"` y la comparación `!==` es siempre verdadera con `NaN`. Fallo flaky dependiente de la semilla. | `property/movie-domain` |

---

## Alcance

* Alinear los tests con el contrato real de `POST /auth/register` (respuesta anidada en `user`).
* Corregir el hash del seed para que coincida con `password123`.
* Actualizar expectativas y filas fake con `averageRating` / `reviewsCount`.
* Desactivar la cache real de Redis en los tests unitarios (`null` inyectado), sin tocar `CACHE_ENABLED`.
* Dar margen al seed por test de `movies.suggest` (timeout de hook a 30 s).
* Excluir `NaN` del generador de `rating` en el property test.
* Documentar las nuevas variables de entorno en `.env`.

### No alcance

* No cambia lógica de producción salvo el hash del seed (dato, no código).
* No se desactiva `CACHE_ENABLED` de forma global (rompería `cache.integration.test.ts`).
* No se paraleliza la suite ni se migra a `jest projects` (se mantiene `maxWorkers: 1`).
* No se elimina la flakiness estructural del seed por test en `movies.suggest` (solo se le da margen).

---

## Criterios de aceptación

* **CA-1 — Contrato de registro.** Las suites de auth leen `res.body.user.*` y pasan.
* **CA-2 — Login funcional.** El usuario seed permite login con `password123` (401 eliminados en login/refresh/logout/reset).
* **CA-3 — Contrato de película.** Las expectativas de `MovieResponse` incluyen `averageRating` y `reviewsCount` sin `NaN`.
* **CA-4 — Unit tests aislados.** Las suites unitarias de películas no leen ni escriben en la cache real de Redis.
* **CA-5 — Seed determinista.** `movies.suggest` no revienta por timeout ni por clave duplicada.
* **CA-6 — Property test estable.** El generador de `rating` nunca produce `NaN`; N ejecuciones seguidas sin fallo.
* **CA-7 — Suite completa verde.** `0` suites / `0` tests fallidos.

---

## Happy Path

| # | Escenario | Comportamiento |
|---|-----------|----------------|
| H1 | `POST /auth/register` | Devuelve `201` con `{ message, user }`; los tests leen `body.user` |
| H2 | Login con usuario seed | `bcrypt.compare('password123', hash)` es `true` → `200` |
| H3 | `GET /movies` en unit test | `MovieResponse` con `averageRating: null` y `reviewsCount: 0` (sin cache real) |
| H4 | Suite `movies.suggest` | Cada `beforeEach` limpia y re-siembra dentro del timeout de 30 s |
| H5 | Property test | `rating` siempre numérico/finito; comparación fiable |

---

## Boundary / Corner / Edge Cases

| # | Caso | Comportamiento esperado |
|---|------|------------------------|
| B1 | `average_rating` ausente en la fila fake | Se usa `null`, no `NaN` |
| B2 | Cache inyectada como `null` | `isCacheEnabled()` es `false`; no se consulta Redis |
| C1 | Test unitario después de un `list` cacheado | No hay cache hit: el mock de repositorio se invoca de nuevo |
| C2 | Seed que tarda > 5 s | El hook no se cancela; se permite hasta 30 s |
| E1 | `fc.double(min,max)` con `noNaN: false` | Excluido: el generador fija `noNaN: true` |
| E2 | `REDIS_URL` sin índice de DB | El helper de tests reescribe el índice a `/15` |

---

## Notas de implementación

1. **Contrato de registro** (`__tests__/integration/auth.{register,verify,resend}.integration.test.ts`):

   ```ts
   expect(res.body).toMatchObject({ user: { id: expect.any(String), email: '…', role: 'user' } })
   const token = await getVerificationToken(registerRes.body.user.id)
   ```

   Un commit por fichero.

2. **Hash del seed** (`db/seed.ts`): se reemplaza el hash del usuario admin por uno válido para `password123` (coste 10):

   ```ts
   bcrypt.compareSync('password123', '$2b$10$NgrPn8CzDKC48dw7f1Q5T.Htz/sD1lWu1GCHotlxnw7lTo8sJ/n.O') // true
   ```

3. **Agregados de reviews** (`domain/Movie.ts` → `toResponse()`): `averageRating` y `reviewsCount` se añaden a las filas fake y a las expectativas:

   ```ts
   { …, average_rating: null, reviews_count: 0 }        // fila fake
   { …, averageRating: null, reviewsCount: 0 }          // expectativa
   ```

   En `movies.random-batch.test.ts` las filas se normalizan con `.map(row => ({ average_rating: null, reviews_count: 0, ...row }))`.

4. **Cache real en unit tests** (`unit/movies.service.test.ts`, `pagination/movies.pagination.unit.test.ts`): se inyecta `null` como 6.º argumento del constructor:

   ```ts
   new MovieService(repo, directorRepo, genreRepo, auditRepo, castRepo, null as any)
   ```

   Con `cache === null`, `isCacheEnabled()` devuelve `false` y no se toca Redis. No se modifica `CACHE_ENABLED`.

5. **Seed de `movies.suggest`** (`__tests__/integration/movies.suggest.integration.test.ts`): se alinea con el patrón ya usado en `search.integration.test.ts`:

   ```ts
   beforeEach(async () => { await clearTestData(db); await seedTestData(db) }, 30000)
   ```

6. **Property test** (`__tests__/property/movie-domain.property.test.ts`): el generador excluye `NaN`:

   ```ts
   fc.double({ min: 0, max: 10, noNaN: true }).map((n) => String(n))
   ```

7. **Variables de entorno** (`source/.env`, no versionado): se añaden explícitamente las usadas por el rate limiter y la cache:

   ```dotenv
   # Redis Rate Limiter / Caching
   REDIS_URL=redis://localhost:6379
   REDIS_URL_TEST=redis://localhost:6379/15
   RATE_LIMIT_ENABLED=true
   ```

   * `REDIS_URL`: conexión de la app (fallback a `redis://localhost:6379`).
   * `REDIS_URL_TEST`: Redis dedicado a tests; si falta, el helper deriva `<REDIS_URL>/15`.
   * `RATE_LIMIT_ENABLED`: `true` en dev; los tests lo fuerzan a `false` por su cuenta.

---

## Archivos (modificados ✎)

```text
source/
├── db/seed.ts                                              ✎ hash bcrypt de password123
├── .env                                                    ✎ REDIS_URL / REDIS_URL_TEST / RATE_LIMIT_ENABLED (no versionado)
├── __tests__/unit/
│   ├── movies.service.test.ts                              ✎ agregados reviews + cache null
│   ├── movies.create.test.ts                               ✎ agregados reviews
│   └── movies.random-batch.test.ts                         ✎ agregados reviews
├── __tests__/pagination/movies.pagination.unit.test.ts     ✎ cache null
├── __tests__/property/movie-domain.property.test.ts        ✎ fc.double noNaN
├── __tests__/integration/
│   ├── auth.register.integration.test.ts                   ✎ contrato user
│   ├── auth.verify.integration.test.ts                     ✎ contrato user
│   ├── auth.resend.integration.test.ts                     ✎ contrato user
│   └── movies.suggest.integration.test.ts                  ✎ timeout de seed 30 s
└── docs/features/feature-pre-existing-test-failures.md     ✧
```

---

## Verificación

* `npx tsc --noEmit` → sin errores.
* Suites afectadas en aislamiento → en verde (36 tests unitarios + 52 de integración).
* Property test ejecutado 25 veces con semillas aleatorias → `0` fallos (antes ~20 %).
* Suite completa:

  ```text
  Test Suites: 72 passed, 72 total
  Tests:       745 passed, 745 total
  ```

  Baseline previo: 13 suites / 24 tests fallidos → `0`.
