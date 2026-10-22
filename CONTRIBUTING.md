# Contributing

## Modelo de ramas

- `main`: solo releases estables. No recibe commits directos.
- `develop`: rama de integracion. Recibe features, fixes y hotfixes.
- `feature/*`, `fix/*`, `hotfix/*`: nacen de `develop` y se integran en `develop`.

```text
main      ●──────────────────●  (vX.Y.Z)
           \                /
develop     ●──●──●──●──●──●
             \/  \/  \/
        feature/*  fix/*  hotfix/*
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

4. Esperar a que CI quede verde en `develop`. Si falla, corregir en la rama de origen y volver a fusionar, o hacer un fix-forward explicito.

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

- Nacen de `develop`, no de `main`.
- Se fusionan en `develop` con `--no-ff`.
- Se publican con el mismo flujo de release: PR `develop` a `main` y tag de parche.

## Reglas

- No hacer commits directos a `main`.
- No usar squash ni rebase para integrar.
- No reescribir commits ya publicados.
- No usar `git push --force` en `develop` ni en `main`.
- No borrar ramas existentes.
- Mantener los checks de CI en verde antes de cada release.

## CI

El workflow vive en `.github/workflows/ci.yml` y se ejecuta en:

- push a `develop` y `main`;
- PRs hacia `main`;
- ejecucion manual.

Jobs:

- `build`: instala dependencias y compila TypeScript.
- `test`: levanta MySQL 8 y Redis 7 y ejecuta la suite completa.
- `migrations`: aplica `db/migrations` desde cero y verifica que sea idempotente.

La proteccion de ramas se aplica solo a `main`: PR obligatorio, checks obligatorios y merge commits habilitados.
