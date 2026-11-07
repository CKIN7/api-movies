# 0002 - Contenerización y CD sobre un host único

> **Estado:** Aceptada
> **Fecha:** 2026-11-07

## Contexto

El proyecto se despliega hoy con PM2 (`source/ecosystem.config.js`) sobre un host único:
`api` en modo cluster y cuatro workers (`worker`, `worker-email`, `worker-notifications`,
`worker-recs`) en modo fork. El CI valida `build`, `test` y `migrations`, pero no genera
artefactos ni despliega: no hay Dockerfile, imágenes, registry ni CD.

Se quiere dar el paso a un ciclo CI/CD real sin adoptar todavía un orquestador como
Kubernetes. Las decisiones de producto/infra son:

- El host de despliegue será **la propia PC del autor** (Windows + Docker Desktop).
- El registro de imágenes será **GitHub Container Registry (GHCR)**.
- MySQL 8, Redis 7 y (opcionalmente) Meilisearch correrán como **contenedores en el mismo
  host** en esta etapa.
- Todo el trabajo se integra en `develop` y se abre **un único PR `develop → main`** cuando
  el conjunto esté completo y verificado.

## Decisión

1. **Una imagen, varios procesos.** Se construye una única imagen multi-stage
   (`source/Dockerfile`) y se reutiliza con distintos `command`:
   `api`, `worker-email`, `worker-notifications`, `worker-recs` y `migrate`.
   No se usa `dist/workers/index.js` en producción (arranca un worker de prueba).
2. **Registry GHCR.** Las imágenes se publican como
   `ghcr.io/<owner>/api-movies` (nombre en minúsculas) con tags `sha-<short>`,
   `develop`, `latest` (solo `main`) y `vX.Y.Z` (tags de release).
3. **Docker Compose en un host único.** `docker-compose.yml` para local y
   `docker-compose.prod.yml` para el host. MySQL/Redis/Meilisearch viven en Compose en
   esta etapa; migrar a servicios gestionados es un paso posterior.
4. **Migraciones como contenedor one-shot.** El servicio `migrate` corre
   `node dist/db/migrate.js` antes de arrancar `api` y los workers. `seed.ts` nunca se
   ejecuta en producción (hace `DROP TABLE`).
5. **Salud explícita.** Se agregan `GET /health` (liveness) y `GET /health/ready`
   (MySQL + Redis) para healthchecks de Compose y del deploy.
6. **CD con self-hosted runner.** El deploy corre en un runner de GitHub Actions instalado
   en la PC (`runs-on: [self-hosted, windows]`), de modo que no hace falta abrir puertos
   entrantes ni depender de SSH. Alternativa documentada: SSH/Tailscale.
7. **Fases de entrega.** El trabajo se parte en ramas `feature/*` y `docs/*` que se integran
   en `develop` con `merge --no-ff`; el PR a `main` se abre recién al final.

## Fases

| Fase | Rama | Entregable |
|------|------|------------|
| 0 | `docs/containerization-decisions` | Este ADR |
| 1a | `feature/container-health-and-port` | `/health`, `PORT`, rutas configurables de migración/seed, tests |
| 1b | `feature/docker-image-and-compose` | `Dockerfile`, `.dockerignore`, `docker-compose.yml`, `.env.docker.example`, `.gitignore` |
| 2 | `feature/ci-docker-build` | Job `docker` en `ci.yml` (build en PR; push en `develop`/`main`) |
| 3 | `feature/cd-compose-deploy` | `docker-compose.prod.yml`, `release.yml`, runbook |

## Consecuencias

- **Positivas:** artefacto inmutable y reproducible, mismo entorno en local y host,
  rollback por tag, deploy sin intervención manual del host y CI que detecta roturas del
  Dockerfile en cada PR.
- **Negativas / deuda:** un único host es punto único de falla; los backups de MySQL,
  el TLS/reverse proxy y las actualizaciones del SO quedan a cargo del operador; Redis
  sigue siendo standalone; `/admin/queues` (Bull Board) no está autenticado y no debe
  exponerse públicamente.
- **Operación:** `DB_POOL_LIMIT` debe ajustarse por réplica; con reverse proxy hay que
  definir `TRUST_PROXY=true`; `worker-recs` debe correr con **una sola réplica** porque
  registra el cron nocturno.
