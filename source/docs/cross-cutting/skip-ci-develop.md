# Omitir CI en develop para cambios de documentación

> **Tipo:** Guía · **Alcance:** CI · **Estado:** Vigente · **Revisión:** 2026-10-22

Cómo evitar que se ejecute el workflow de CI en un push a `develop` cuando el cambio es exclusivamente documental.

---

## Objetivo

Evitar el costo de CI en `develop` para cambios que no tocan código, sin modificar el workflow ni la protección de `main`.

Esta guía **no cambia** `.github/workflows/ci.yml`: usa la instrucción `[skip ci]` que GitHub Actions interpreta de forma nativa.

## Alcance

Usar solo para cambios de documentación:

- `AGENTS.md`, `CONTRIBUTING.md`, `README.md`.
- `source/docs/**/*.md`.
- Notas, specs y plantillas.

No usar para:

- Código TypeScript.
- Tests.
- Migraciones o `schema.sql`.
- Workflows de GitHub Actions.
- Configuración de la aplicación.

## Cómo funciona

GitHub Actions omite los workflows disparados por `push` y `pull_request` cuando el mensaje del commit contiene alguna de estas instrucciones:

```text
[skip ci]
[ci skip]
[no ci]
[skip actions]
[actions skip]
```

En un `push`, GitHub mira el commit HEAD. En un `pull_request`, mira el HEAD del PR.

Además, el workflow actual no corre en pushes a ramas `feature/*`, `docs/*` ni `fix/*`: solo en push a `develop`/`main` y en PRs hacia `main`. Por eso el push de la rama de documentación no ejecuta CI; la instrucción solo es necesaria en el merge commit que llega a `develop`.

## Flujo

### 1. Crear la rama desde develop

```powershell
git switch develop
git pull --ff-only
git switch -c docs/mi-cambio
```

### 2. Commit y push de la rama

```powershell
git add AGENTS.md CONTRIBUTING.md source/docs
git commit -m "docs: describir el cambio"
git push -u origin docs/mi-cambio
```

Este push no dispara CI.

### 3. Integrar en develop con el merge commit marcado

```powershell
git switch develop
git pull --ff-only
git merge --no-ff docs/mi-cambio -m "Merge branch 'docs/mi-cambio' into develop [skip ci]"
git push origin develop
```

El `--no-ff` garantiza un merge commit, y ese commit es el HEAD del push. GitHub lo omite.

## Advertencia: el HEAD del PR

El atajo solo evita el CI del push a `develop`. **No evita el CI del PR `develop → main`.**

Si el HEAD de `develop` sigue siendo el merge commit con `[skip ci]`, GitHub también omite el workflow de `pull_request`. Como `main` exige `build`, `test` y `migrations`, esos checks quedan en estado `Pending` y el PR no se puede fusionar.

Antes de abrir el PR de release, el HEAD de `develop` debe ser un commit **sin** la instrucción.

### Si después agregás features

Los merges de features dejan un HEAD nuevo sin `[skip ci]`. El PR a `main` funciona normalmente.

### Si vas a liberar solo documentación

Necesitás un commit nuevo que no contenga `[skip ci]`:

```powershell
git switch develop
git pull --ff-only
git commit --allow-empty -m "ci: preparar checks para el release"
git push origin develop
```

Ese push **sí ejecuta CI en `develop`**. No hay forma de evitar también el CI del PR a `main` sin debilitar la protección.

También podés agregar un cambio real de documentación en lugar de un commit vacío. En cualquiera de los dos casos, no incluyas `[skip ci]` en ese commit.

## Recuperación si el PR queda bloqueado

1. Confirmar el mensaje del HEAD:

   ```powershell
   git log -1 --pretty=%B
   ```

2. Si contiene `[skip ci]`, pushear un commit nuevo sin la instrucción a `develop`.
3. Esperar a que CI cree los checks requeridos.
4. Verificar que el PR muestre `build`, `test` y `migrations` en verde.

## Limitaciones

- No evita CI en el PR de release.
- No debe usarse para código: una feature sin CI en `develop` se valida recién en el PR a `main`.
- La instrucción solo aplica a eventos `push` y `pull_request`; no afecta a `workflow_dispatch`.
- Si el commit con `[skip ci]` deja de ser HEAD, el workflow corre normalmente.
- No usar `paths-ignore` en el workflow que valida PRs a `main`: si el workflow no se ejecuta, los checks requeridos tampoco se crean y el PR queda bloqueado.

## Verificación

- En GitHub Actions no debe aparecer un run nuevo para el push a `develop` con `[skip ci]`.
- `git log -1 --pretty=%B` debe mostrar la instrucción en el merge commit.
- Antes del PR, `git log -1 --pretty=%B` no debe contenerla.
- El PR a `main` debe mostrar los tres checks requeridos.

## Referencias

- [GitHub Docs — Skipping workflow runs](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/skip-workflow-runs)
- [`CONTRIBUTING.md`](../../../CONTRIBUTING.md)
