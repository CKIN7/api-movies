# AGENTS

## Proyecto

API REST MVC para un catalogo de peliculas. Expone endpoints para autenticacion JWT, catalogo, busqueda y sugerencias, reviews, watchlist, recomendaciones, perfiles/preferencias/onboarding y exportacion CSV.

- Runtime: Node 24 + TypeScript + Express 5.
- Persistencia: MySQL 8 (`utf8mb4_0900_ai_ci`).
- Cache y rate limiting: Redis 7. En tests se usa `ioredis-mock`, salvo las suites de integracion del rate limiter.
- Busqueda: Meilisearch opcional; si esta deshabilitado, se usa fallback MySQL.
- Arquitectura: `api.ts` actua como composition root; routes -> controllers -> services -> repositories -> domain/schemas.
- Validacion: Zod. Autenticacion: JWT. Logs: Winston.
- Tests: Jest + Supertest, con `maxWorkers: 1`.
- Ultima version publicada: `v1.0.0`. La version vigente esta en `source/package.json`.
- Documentacion funcional y tecnica: `source/docs/README.md`.

## Estructura

- La raiz del repositorio contiene `.github/`, `AGENTS.md` y `CONTRIBUTING.md`.
- La aplicacion vive en `source/`. Todos los comandos de npm se ejecutan desde ahi.

## Comandos

Ejecutar desde `source/`:

```powershell
npm ci
npm run dev
npm run build
npm run typecheck
npm test
npm run migrate
npm run migrate:status
npm run seed
```

## Requisitos

- Node 24 o superior.
- MySQL 8 (el esquema usa `utf8mb4_0900_ai_ci`).
- Redis para las suites de integracion del rate limiter. El resto usa `ioredis-mock`.
- Meilisearch es opcional; en tests se desactiva con `MEILISEARCH_ENABLED=false`.

## Base de datos de tests

`__tests__/helpers/globalSetup.js` recrea `DB_NAME_TEST` y aplica `db/schema.sql`. Nunca apuntar `DB_NAME_TEST` a la base de desarrollo. El guard del helper rechaza nombres que no terminen en `_test`.

## Ramas

- `main`: solo releases y hotfixes. Recibe PRs desde `develop` (release programado) y desde `hotfix/*` (correccion critica). Cada release u hotfix se etiqueta `vX.Y.Z` sobre el merge commit en `main`.
- `develop`: integracion. Recibe merges locales `--no-ff` desde `feature/*`, `fix/*` y `docs/*`. No recibe `hotfix/*`: se sincroniza desde `main` con `--no-ff` despues de cada hotfix.
- `hotfix/*`: nacen de `main`, se integran en `main` por PR y vuelven a `develop` por sincronizacion desde `main`. Se borran despues del sync.
- `docs/*`: cambios exclusivamente documentales. Se integran en `develop` con `--no-ff`.
- No se hacen commits directos a `main`; `main` solo recibe merge commits via PR.
- No se usa squash ni rebase para integrar.
- Un commit por archivo creado o modificado. No agrupar varios archivos en un mismo commit, salvo el par `package.json` + `package-lock.json`, que se commitea junto por ser atomico.
- Las ramas existentes no se borran, salvo `hotfix/*` ya tagueadas y sincronizadas en `develop`.

## CI

`.github/workflows/ci.yml` corre en push a `develop` y `main`, y en PRs hacia `main`. Jobs: `build`, `test`, `migrations`. El job `test` levanta MySQL 8 y Redis 7 como servicios. Los pushes a `hotfix/*` no disparan CI; el PR hacia `main` si ejecuta los tres jobs.

## CI para cambios de documentacion

Los cambios docs-only pueden integrarse a `develop` con `[skip ci]` en el merge commit para evitar el workflow. Antes de abrir el PR `develop -> main`, el HEAD de `develop` debe ser un commit sin esa instruccion; de lo contrario, los checks requeridos quedan pendientes y el PR se bloquea. No usar este atajo en codigo, tests, migraciones ni workflows. Ver `source/docs/cross-cutting/skip-ci-develop.md`.

## Documentacion

Las specs y decisiones viven en `source/docs/`; el indice esta en `source/docs/README.md`. Usar `source/docs/_template-feature.md` para nuevas features y `source/docs/decisions/` para ADRs. El flujo de ramas y releases esta en `CONTRIBUTING.md`. La guia para omitir CI en docs esta en `source/docs/cross-cutting/skip-ci-develop.md`.
