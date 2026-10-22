# AGENTS

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

- `main`: solo releases. Recibe PRs desde `develop` y tags `vX.Y.Z`.
- `develop`: integracion. Recibe merges locales `--no-ff` desde `feature/*`, `fix/*` y `hotfix/*`.
- No se hacen commits directos a `main`.
- No se usa squash ni rebase para integrar.
- Las ramas existentes no se borran.

## CI

`.github/workflows/ci.yml` corre en push a `develop` y `main`, y en PRs hacia `main`. Jobs: `build`, `test`, `migrations`. El job `test` levanta MySQL 8 y Redis 7 como servicios.

## Documentacion

Las specs y decisiones viven en `source/docs/`. Usar `source/docs/_template-feature.md` para nuevas features y `source/docs/decisions/` para ADRs.
