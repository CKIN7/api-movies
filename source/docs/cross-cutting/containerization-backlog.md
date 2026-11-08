# Backlog de contenerización y CD

> **Tipo:** Backlog · **Alcance:** Infra / CI-CD · **Estado:** Pendiente · **Revisión:** 2026-11-08

Fases pendientes después de la primera entrega de contenerización. El contexto y las
decisiones están en el ADR [`0002-containerization-and-cd`](../decisions/0002-containerization-and-cd.md)
y el runbook [`containerization.md`](./containerization.md).

> El cierre del release (PR `develop → main`, bump de versión y tag) queda **fuera**
> de este documento. Acá se rastrean solo el hardening del stack y la siguiente etapa
> de CD.

## Estado de partida

- `develop` integrado y pusheado; CI en verde (`build`, `test`, `migrations`, `docker`).
- Imagen publicada en GHCR: `ghcr.io/ckin7/api-movies` con tags `develop` y `sha-<short>`.
- `main` todavía no recibió la entrega, así que **no existe el tag `latest`**.
- Stack local validado con Docker Compose. Quedaron falsos positivos de healthcheck en
  los workers y puertos del host ocupados por MySQL/Memurai locales.

---

## 2. Hardening detectado en la validación local

### Objetivo

Corregir los problemas encontrados al levantar el stack en la PC, dejar el Compose
portable entre local y host, y preparar la imagen para correr en un PaaS o en la nube
sin cambios adicionales.

### Alcance

| ID | Prioridad | Cambio | Archivos | Por qué |
|----|-----------|--------|----------|---------|
| H-01 | Alta | Agregar `MYSQL_HOST_PORT`, `REDIS_HOST_PORT`, `MEILI_HOST_PORT` y `API_HOST_PORT`; publicar `${VAR:-default}`. | `docker-compose.yml`, `.env.docker.example` | Hoy MySQL reutiliza `DB_PORT` y Redis está fijo en `6379`; choca con MySQL80 y Memurai del host. |
| H-02 | Alta | Separar el puerto del host del `PORT` interno de la app: `API_HOST_PORT:8089` y `PORT` solo dentro del contenedor. | `docker-compose.yml`, `docker-compose.prod.yml` | Con `PORT` distinto de `8089` la app escucha en `PORT` pero Docker publica `8089`. |
| H-03 | Alta | `healthcheck: { disable: true }` en `worker-email`, `worker-notifications` y `worker-recs`. | ambos Compose | Heredan el `HEALTHCHECK` HTTP de la imagen y quedan `unhealthy` aunque funcionen. |
| H-04 | Alta | `HEALTHCHECK` del Dockerfile usando `$PORT` (shell form) o delegarlo al orquestador. | `source/Dockerfile` | Hardcodea `8089`; en PaaS o con `PORT` custom falla. |
| H-05 | Media | Cambiar el project name de producción a `api-movies-prod`. | `docker-compose.prod.yml` | Hoy local y prod comparten `name: api-movies`: misma red y volúmenes si corren en la misma PC. |
| H-06 | Media | Evitar la doble ejecución de `migrate` en el deploy. | `.github/workflows/release.yml`, `docker-compose.prod.yml` | `run --rm migrate` + `up -d` con `depends_on: service_completed_successfully` corre la migración dos veces. |
| H-07 | Media | Evitar que el job `docker` de `ci.yml` publique en `main`. | `.github/workflows/ci.yml` | `ci.yml` y `release.yml` compilan y pushean `latest` en cada push a `main`. |
| H-08 | Media | Publicar también `sha-<full>` y exponer el `digest` como output. | `.github/workflows/ci.yml` | Deploy inmutable y rollback por digest. |
| H-09 | Media | Alinear `MEILISEARCH_API_KEY` con `MEILI_MASTER_KEY`. | `.env.docker.example`, Compose | Con la key vacía Meili arranca con `masterKey` y la API recibe `401`. |
| H-10 | Media | Proteger `/admin/queues` (Bull Board no tiene auth). | `source/api.ts`, reverse proxy | La API se publica en `8089`; el panel de colas quedaría expuesto. |
| H-11 | Baja | Logs JSON a stdout en producción y rotación para MySQL/Redis/Meili. | `source/utils/logger.ts`, Compose | Winston escribe archivos efímeros y en prod solo rotan los contenedores de la app. |
| H-12 | Baja | Agregar `NOTIFICATION_WORKER_CONCURRENCY` y `NOTIFICATION_ENQUEUE_TIMEOUT_MS`. | `.env.docker.example` | Faltan en la plantilla; hoy se usan los defaults del código. |
| H-13 | Baja | Exponer `GIT_SHA`/versión en `/health`. | `source/routes/healthRoutes.ts` | Permite que el smoke test verifique el commit desplegado. |

### Detalle de los cambios de mayor riesgo

**H-01 / H-02 — Puertos.** El objetivo es que `DB_PORT` y `PORT` sean siempre los
puertos internos (`3306` y `8089`), y que los puertos del host se configuren aparte:

```dotenv
MYSQL_HOST_PORT=3307
REDIS_HOST_PORT=6380
MEILI_HOST_PORT=7700
API_HOST_PORT=8089
```

En el Compose, el mapeo queda `"${MYSQL_HOST_PORT:-3306}:3306"` y
`"${API_HOST_PORT:-8089}:8089"`. Así se puede convivir con MySQL/Memurai locales sin
tocar la configuración interna de la app.

**H-03 / H-04 — Healthchecks.** El healthcheck de la imagen es HTTP y solo tiene
sentido para `api`. Los workers deben declararlo deshabilitado. En el Dockerfile,
usar `$PORT` evita que un PaaS o un `PORT` distinto de `8089` marque el contenedor
como enfermo.

**H-05 — Project name.** Si el host de producción es la misma PC que el entorno de
desarrollo, compartir `name: api-movies` hace que ambos stacks usen los mismos
contenedores, red y volúmenes. Con `api-movies-prod`, los volúmenes pasan a
`api-movies-prod_mysql-data`, etc. Igual hay que recordar que ambos pelean por
`API_HOST_PORT`.

### Criterios de aceptación

- [ ] `docker compose config --quiet` y `docker compose -f docker-compose.prod.yml config --quiet` pasan.
- [ ] Con MySQL80 y Memurai corriendo, el stack local levanta usando `MYSQL_HOST_PORT` y `REDIS_HOST_PORT`.
- [ ] Los cuatro workers dejan de aparecer `unhealthy`.
- [ ] Cambiar `API_HOST_PORT` no rompe la app; `PORT` interno sigue en `8089`.
- [ ] `npm run typecheck`, `npm run build` y `npm test` en verde.
- [ ] CI en verde en `develop`.

### Verificación

```powershell
docker compose config --quiet
docker compose -f docker-compose.prod.yml config --quiet
docker compose up -d --build
docker compose ps
npm run typecheck
npm test
```

---

## 3. Siguiente etapa (no empezada)

### Objetivo

Pasar de "deploy en la PC" a un ciclo CD real con staging estable y, más adelante,
producción en la nube. La app no cambia: cambia dónde corre y cómo se promueve la
imagen.

### 3.1 Staging en un PaaS barato

**Flujo propuesto:**

```text
push a develop
  → CI (build · test · migrations)
  → job docker: push ghcr.io/ckin7/api-movies:sha-<full> (+ develop)
  → job deploy-staging (GitHub Environment "staging")
      1. deploy de la imagen por tag/digest inmutable
      2. migraciones (pre-deploy / release command)
      3. esperar /health/ready
      4. smoke test
      5. si falla → redeploy de la imagen anterior y job en rojo
```

**Proveedores:**

| PaaS | Imagen GHCR | MySQL gestionado | Workers | Rollback | Comentario |
|------|-------------|------------------|---------|----------|------------|
| Railway | Servicio desde imagen o API | Sí | Sí | Redeploy de la deployment anterior | Todo en uno: MySQL, Redis y Meili en el mismo lugar. |
| Fly.io | Nativo con `fly deploy --image` | No (externo: PlanetScale/Aiven) | Process groups | Releases / `--image` | El más limpio para "GHCR → deploy"; MySQL hay que buscarlo afuera. |
| Render | Image-backed services | No (solo Postgres/Key Value) | Background workers | Rollback a deploy anterior | Requiere MySQL externo; workers son de pago. |

Recomendación: **Railway** para staging si se quiere todo en un proveedor, o
**Fly.io + MySQL externo** si se prioriza desplegar la imagen prebuilt por CLI.
Verificar que el pin de imagen por tag se pueda hacer desde CI antes de comprometerse.

**Cambios necesarios:**

- ADR `0003` con la decisión de staging (proveedor, MySQL/Redis, rollback).
- `.github/workflows/deploy-staging.yml` (o un job nuevo en `ci.yml`) con
  `environment: staging`, secretos del PaaS y `needs` del CI.
- Pocket de secretos: token del PaaS y credenciales de GHCR si el paquete pasa a privado.
- Variables de staging: `TRUST_PROXY=true`, `APP_URL` con el dominio de staging,
  `MEILISEARCH_ENABLED=false` al inicio, JWT y DB separados de producción, usuario
  MySQL dedicado, `DB_POOL_LIMIT` por instancia.
- Migraciones como pre-deploy/release command, compatibles hacia atrás.
- Smoke test: `GET /health`, `GET /health/ready`, `GET /movies?page=1&limit=5` y,
  si `H-13` está implementado, verificación de `GIT_SHA`.

**Criterios de salida:**

- [ ] Un push a `develop` despliega staging automáticamente.
- [ ] `/health/ready` responde `200` con MySQL y Redis en `true`.
- [ ] El smoke test falla el workflow si la app no responde.
- [ ] Rollback probado a un tag anterior.
- [ ] Sin secretos en el repo ni en la imagen.
- [ ] `worker-recs` corre con una sola réplica.

### 3.2 Cloud de verdad

Dos caminos posibles; conviene transitarlos en orden.

**A. VM/VPS + Docker Compose + Caddy (recomendado primero).**

- VPS Linux con Docker Engine y el mismo `docker-compose.prod.yml`.
- Caddy adelante con TLS automático; solo se publican `80/443` (y `22`).
- MySQL/Redis sin puertos publicados; `TRUST_PROXY=true`.
- Backups diarios con `mysqldump` + copia fuera del host y restauración probada.
- Firewall (`ufw`/`iptables`), SSH con claves, `fail2ban`, actualizaciones automáticas.
- Costo aproximado: USD 5–15/mes (2 vCPU / 4 GB).

**B. Contenedores gestionados + datos gestionados.**

- AWS: ECS Fargate + RDS MySQL + ElastiCache + ALB + Secrets Manager + CloudWatch.
- GCP: Cloud Run/GKE + Cloud SQL + Memorystore + Cloud Load Balancing.
- Azure: Container Apps + Azure Database for MySQL + Azure Cache + Key Vault.
- Costo aproximado: USD 80–150/mes en el mínimo viable (ALB + NAT + RDS + Redis).
- Los workers BullMQ necesitan cómputo always-on; Cloud Run request-driven no encaja
  sin CPU siempre asignada.

**Checklist de producción:**

- [ ] MySQL y Redis en subredes privadas; security groups solo desde la app.
- [ ] TLS extremo a extremo y redirección HTTP → HTTPS.
- [ ] Secretos en Secrets Manager/Key Vault/Secret Manager; GitHub Actions con OIDC,
      sin claves de larga vida.
- [ ] Backups automáticos + PITR y una restauración de prueba.
- [ ] Redis con `maxmemory-policy noeviction` y alarmas de memoria/evictions.
- [ ] Logs JSON a stdout con retención; métricas de 5xx, latencia y colas.
- [ ] Alarmas a email/Slack para healthchecks, 5xx, DB y Redis.
- [ ] Deploy por digest, migraciones antes del rollout y rollback documentado.
- [ ] `/admin/queues` bloqueado o autenticado.

**Criterios de salida:**

- [ ] Base y Redis no accesibles desde Internet.
- [ ] Deploy y rollback ejecutados al menos una vez en producción.
- [ ] Restauración de backup validada.
- [ ] Alarmas llegando a un canal real.
- [ ] Runbook actualizado con el nuevo destino.

---

## Orden sugerido

1. `fix/compose-hardening`: H-01 a H-05.
2. `ci/release-hardening`: H-06 a H-10.
3. `fix/logging-hardening`: H-11 a H-13.
4. `docs/`: ADR `0003` y actualización del runbook.
5. Staging en PaaS y, después, cloud real.

Cada fase va en su rama desde `develop`, con un commit por archivo y merge `--no-ff`,
según [`CONTRIBUTING.md`](../../../CONTRIBUTING.md).
