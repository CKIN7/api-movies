# Contributing

## Modelo de ramas

- `main`: solo releases estables y hotfixes. No recibe commits directos: recibe PRs desde `develop` (release programado) y desde `hotfix/*` (correccion critica en produccion).
- `develop`: rama de integracion. Recibe features, fixes y docs. Los hotfixes llegan por sincronizacion desde `main`.
- `feature/*`, `fix/*` y `docs/*`: nacen de `develop` y se integran en `develop`. Las ramas `docs/*` son solo para cambios documentales.
- `hotfix/*`: nacen de `main`, se integran en `main` por PR y vuelven a `develop` por sincronizacion desde `main`. Se borran despues del sync.

```text
Release programado:
  develop ──●──●──●──●──► PR ──► main ──► tag vX.Y.Z

Hotfix:
  main ──► hotfix/x ──► PR ──► main ──► tag vX.Y.Z ──► merge main ──► develop
```

## Flujo de trabajo

1. Actualizar `develop` y crear la rama:

   ```powershell
   git switch develop
   git pull --ff-only
   git switch -c feature/nombre-corto
   ```

2. Validar en local antes de integrar:

   ```powershell
   cd source
   npm run build
   npm test
   npm run migrate
   ```

3. Integrar en `develop` con merge commit:

   ```powershell
   git switch develop
   git merge --no-ff feature/nombre-corto -m "Merge branch 'feature/nombre-corto' into develop"
   git push origin develop
   ```

4. Esperar a que CI quede verde en `develop`. Si falla, corregir en la rama de origen y volver a fusionar, o hacer un fix-forward explicito. Para cambios exclusivamente documentales se puede omitir CI con el atajo descrito en [CI para cambios de documentacion](#ci-para-cambios-de-documentacion).

## Releases

1. Subir la version en `develop`:

   ```powershell
   cd source
   npm version X.Y.Z --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "chore: release vX.Y.Z"
   git push origin develop
   ```

2. Abrir un PR de `develop` a `main`. Es el unico tipo de PR permitido.
3. Esperar los checks `build`, `test` y `migrations`.
4. Fusionar con merge commit. Nunca squash ni rebase.
5. Crear el tag manual:

   ```powershell
   git switch main
   git pull --ff-only
   git tag -a vX.Y.Z -m "Descripcion del release"
   git push origin vX.Y.Z
   ```

6. Sincronizar `develop` con `main`:

   ```powershell
   git switch develop
   git merge --ff-only main
   git push origin develop
   ```

## Hotfixes

Se usa solo para errores criticos que afectan a produccion y no pueden esperar al proximo release.

1. Crear la rama desde `main`:

   ```powershell
   git switch main
   git pull --ff-only
   git switch -c hotfix/nombre-del-error
   ```

2. Corregir el error. Un commit por archivo:

   ```powershell
   git add source/ruta/al/archivo.ts
   git commit -m "fix: descripcion del error critico"
   ```

3. Subir la version de parche. `package.json` y `package-lock.json` van en el mismo commit por ser un par atomico:

   ```powershell
   cd source
   npm version X.Y.Z --no-git-tag-version
   git add package.json package-lock.json
   git commit -m "chore: release vX.Y.Z (hotfix)"
   ```

   El bump va al final, cuando ya se sabe cual es el proximo parche libre. Si dos hotfixes corren en paralelo, el que mergea segundo rehace este ultimo commit con la version siguiente antes de abrir el PR (es un commit propio, todavia no publicado).

4. Validar antes de tocar `main`:

   ```powershell
   npm ci
   npm run build
   npm test
   npm run migrate
   ```

5. Abrir un PR de `hotfix/nombre-del-error` a `main`. `main` esta protegida: no se mergea localmente ni se pushea directo. El push de la rama `hotfix/*` no dispara CI, pero el PR si ejecuta `build`, `test` y `migrations`. Fusionar con merge commit (nunca squash ni rebase).

6. Etiquetar el merge commit ya integrado en `main`:

   ```powershell
   git switch main
   git pull --ff-only
   git tag -a vX.Y.Z -m "Hotfix vX.Y.Z: descripcion"
   git push origin vX.Y.Z
   ```

   No usar `git push --tags`, que sube todos los tags locales.

7. Sincronizar `develop` desde `main`. Aca `develop` ya divergio (tiene commits que no estan en `main`), asi que `--ff-only` falla y el merge tiene que ser `--no-ff`:

   ```powershell
   git switch develop
   git pull --ff-only
   git merge --no-ff main -m "Merge branch 'main' into develop (sync hotfix vX.Y.Z)"
   git push origin develop
   ```

8. Borrar la rama. Es la unica excepcion a la regla de no borrar ramas:

   ```powershell
   git branch -d hotfix/nombre-del-error
   git push origin --delete hotfix/nombre-del-error
   ```

Si el hotfix toca `db/migrations`, la migracion tiene que ser compatible hacia atras: produccion la aplica sobre `main` y `develop` la recibe despues por el merge de sincronizacion.

## Reglas

- No hacer commits directos a `main`; solo recibe merge commits via PR.
- No usar squash ni rebase para integrar.
- Un commit por archivo creado o modificado. No agrupar varios archivos en un mismo commit, salvo el par `package.json` + `package-lock.json`, que se commitea junto por ser atomico.
- No reescribir commits ya publicados.
- No usar `git push --force` en `develop` ni en `main`.
- No borrar ramas existentes, salvo `hotfix/*` ya tagueadas y sincronizadas en `develop`.
- Mantener los checks de CI en verde antes de cada release y cada hotfix.

## CI

El workflow vive en `.github/workflows/ci.yml` y se ejecuta en:

- push a `develop` y `main`;
- PRs hacia `main` (incluye los de `hotfix/*`);
- ejecucion manual.

Los pushes a `hotfix/*` no disparan el workflow: los checks corren recien en el PR hacia `main`.

Jobs:

- `build`: instala dependencias y compila TypeScript.
- `test`: levanta MySQL 8 y Redis 7 y ejecuta la suite completa.
- `migrations`: aplica `db/migrations` desde cero y verifica que sea idempotente.

La proteccion de ramas se aplica solo a `main`: PR obligatorio, checks obligatorios y merge commits habilitados.

### CI para cambios de documentacion

Para cambios exclusivamente documentales se puede evitar el CI del push a `develop` usando `[skip ci]` en el mensaje del merge commit:

```powershell
git switch develop
git pull --ff-only
git merge --no-ff docs/mi-cambio -m "Merge branch 'docs/mi-cambio' into develop [skip ci]"
git push origin develop
```

Esto no evita el CI del PR `develop` a `main`. Si el HEAD de `develop` sigue siendo el merge commit con `[skip ci]`, GitHub tambien omite el workflow del PR y los checks requeridos quedan pendientes, bloqueando el merge. Antes del PR, el HEAD debe ser un commit sin la instruccion. Si no se agregaron features despues, hay que pushear un commit nuevo, y ese push si ejecuta CI en `develop`.

No usar este atajo en codigo, tests, migraciones ni workflows. Guia completa: [`source/docs/cross-cutting/skip-ci-develop.md`](source/docs/cross-cutting/skip-ci-develop.md).
