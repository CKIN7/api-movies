# 0001 - Ramas develop/main y CI sin CD

> **Estado:** Aceptada
> **Fecha:** 2026-10-21

## Contexto

El repositorio integraba todas las features directamente en `main` con merges `--no-ff`. Eso mantiene un historial detallado, pero `main` acumula trabajo no publicado y no existe un punto estable de release. Tampoco habia CI ni tags.

El objetivo es separar integracion de release, conservar el historial por feature y usar GitHub Actions para validar build, tests y migraciones.

## Decision

- `main` es la rama por defecto y solo recibe releases mediante PR desde `develop`.
- `develop` es la rama de integracion.
- `feature/*`, `fix/*` y `hotfix/*` nacen de `develop`.
- La integracion en `develop` es local, con `git merge --no-ff`, seguida de push. No se abren PRs hacia `develop`.
- El unico PR permitido es `develop` a `main`, y se fusiona con merge commit.
- No se usa squash ni rebase.
- La proteccion de ramas se aplica solo a `main`.
- No se borran ramas existentes.
- Los releases se marcan con tags manuales `vX.Y.Z`.
- No hay CD: no se genera artifact ni se despliega desde CI.

## CI

`.github/workflows/ci.yml` se ejecuta en push a `develop` y `main`, en PRs hacia `main` y de forma manual.

Jobs:

- `build`: `npm ci` y `npm run build`.
- `test`: MySQL 8 y Redis 7 como servicios, `npm test`.
- `migrations`: MySQL 8, aplica las migraciones desde cero dos veces y ejecuta `npm run migrate:status`.

El proyecto vive en `source/`, por eso el workflow usa `working-directory: source` y `cache-dependency-path: source/package-lock.json`.

## Consecuencias

- El historial de `develop` conserva dos bloques separados por feature y merge commits.
- `main` solo avanza en releases, pero conserva el detalle completo de los commits integrados.
- CI valida `develop` despues del merge local. La validacion previa es responsabilidad del desarrollador: `npm run build` y `npm test` antes de cada merge.
- `develop` no esta protegida, por lo que se puede empujar directamente y existe riesgo de force-push. La regla es no reescribir historia publicada.
- GitHub no debe borrar automaticamente la rama head del PR: al fusionar `develop` a `main`, la rama head es `develop`.
- Los commits aparecen en el grafico de contribuciones cuando llegan a `main` con el release.
- El tag de release no genera artifact descargable. GitHub adjunta solo el codigo fuente.
