# Contenerización y despliegue continuo

> **Tipo:** Guía · **Alcance:** Infra / CI-CD · **Estado:** Vigente · **Revisión:** 2026-11-07

Cómo construir, publicar y desplegar la API y sus workers con Docker Compose sobre un host
único. Las decisiones están en el ADR
[`0002-containerization-and-cd`](../decisions/0002-containerization-and-cd.md).

---

## Imagen

Una sola imagen multi-stage (`source/Dockerfile`) sirve todos los procesos. El stage
`builder` compila TypeScript; el stage `runtime` instala solo dependencias de producción,
copia `dist/`, `public/` y los `.sql` de `db/` a `dist/db/`, y corre como usuario `node`.

| Proceso | Comando |
|---------|---------|
| `api` | `node dist/api.js` |
| `worker-email` | `node dist/workers/emailWorker.js` |
| `worker-notifications` | `node dist/workers/notificationWorker.js` |
| `worker-recs` | `node dist/workers/recommendationWorker.js` |
| `migrate` | `node dist/db/migrate.js` (one-shot) |

`dist/workers/index.js` **no** se usa en producción: arranca un worker de prueba.

Healthchecks: `GET /health` (liveness) y `GET /health/ready` (MySQL + Redis).
Se montan antes del rate limiter para que el sondeo no consuma cuota.

---

## Uso local

Requisitos: Docker Desktop en ejecución.

```powershell
# 1. Crear el .env de Compose (ignorado por git)
Copy-Item .env.docker.example .env

# 2. Levantar MySQL, Redis, migraciones, API y workers
docker compose up --build -d

# 3. Verificar
curl http://localhost:8089/health
curl http://localhost:8089/health/ready
docker compose ps
docker compose logs -f api
```

- La API queda en `http://localhost:8089`.
- MySQL escucha en `localhost:3306` y Redis en `localhost:6379` (solo en local; en
  producción no se publican).
- Meilisearch es opcional:

```powershell
docker compose --profile search up -d
```

  Con `MEILISEARCH_ENABLED=true` en `.env`. Si está apagado, la búsqueda cae a MySQL.

- Cargar datos de ejemplo (solo local; **`seed` hace `DROP TABLE`**):

```powershell
docker compose run --rm migrate
docker compose run --rm api node dist/db/seed.js
```

- Reindexar Meilisearch (si está habilitado):

```powershell
docker compose run --rm api node dist/scripts/reindex.js
```

---

## Build y publicación

La imagen se publica en GHCR como `ghcr.io/<owner>/api-movies` (minúsculas):

| Evento | Tags |
|--------|------|
| PR | build sin push |
| push a `develop` | `sha-<short>`, `develop` |
| push a `main` | `sha-<full>`, `latest` |
| tag `vX.Y.Z` | `sha-<full>`, `X.Y.Z` |

`.github/workflows/ci.yml` agrega el job `docker` (build en PR; push en `develop`/`main`).
`.github/workflows/release.yml` publica en `main` y tags y luego despliega.

Build manual:

```powershell
cd source
docker build -t api-movies:local .
```

---

## Host (la PC)

El host es la PC del autor: **Windows + Docker Desktop**. El deploy corre en un runner
**self-hosted** de GitHub Actions, así no hay que abrir puertos entrantes ni configurar SSH.

### 1. Runner self-hosted

Instalar un runner con las etiquetas `self-hosted` y `windows` (el workflow usa
`runs-on: [self-hosted, windows]`). El runner debe poder ejecutar `docker` y
`docker compose`.

### 2. Directorio de despliegue

El runner espera un directorio fijo (secreto `DEPLOY_PATH`) con:

```text
DEPLOY_PATH/
├── docker-compose.prod.yml   # copiado del repo
└── .env                      # secretos y configuracion del host
```

El `.env` es el mismo formato que `.env.docker.example`, con al menos:

```dotenv
IMAGE_NAME=ghcr.io/<owner>/api-movies
IMAGE_TAG=latest
MYSQL_ROOT_PASSWORD=...
DB_PASSWORD=...
DB_NAME=api_movies
JWT_SECRET=...
JWT_REFRESH_SECRET=...
REDIS_URL=redis://redis:6379
PORT=8089
```

> No commitear `.env`. Las imágenes GHCR privadas requieren credenciales con `read:packages`.

### 3. Secretos del repositorio

| Secreto | Uso |
|---------|-----|
| `DEPLOY_PATH` | Ruta absoluta del directorio de despliegue en la PC |
| `GHCR_USER` | Usuario de GitHub para `docker login ghcr.io` |
| `GHCR_TOKEN` | PAT con `read:packages` |

`GITHUB_TOKEN` (automático) se usa en CI para publicar.

---

## Flujo de deploy

```text
push a main / tag vX.Y.Z
  → job docker: build + push :sha-<full> (+ latest / X.Y.Z)
  → job deploy (self-hosted Windows, environment production)
      docker login ghcr.io
      docker compose -f docker-compose.prod.yml pull
      docker compose -f docker-compose.prod.yml run --rm migrate
      docker compose -f docker-compose.prod.yml up -d --remove-orphans
      GET /health/ready (hasta 60 s)
```

El workflow fija `IMAGE_TAG=sha-<full>` por deploy, así que cada rollout usa una imagen
inmutable.

### Rollback

Volver al tag anterior y recrear:

```powershell
$env:IMAGE_TAG = "sha-<sha-anterior>"
docker compose -f docker-compose.prod.yml pull
docker compose -f docker-compose.prod.yml up -d --remove-orphans
```

Las migraciones deben ser **compatibles hacia atrás** para que un rollback no rompa la app
anterior.

---

## Operación

- **Backups:** `mysql-data` y `redis-data` son volúmenes Docker. Programar `mysqldump`
  (o backup del volumen) fuera del host.
- **TLS / reverse proxy:** si se expone fuera de `localhost`, poner Caddy/Nginx delante y
  definir `TRUST_PROXY=true` para que el rate limiter use la IP real.
- **Pool MySQL:** `DB_POOL_LIMIT` se multiplica por réplica de `api`. Ajustar según el
  límite del servidor.
- **`worker-recs`:** una sola réplica; registra el cron nocturno (`upsertJobScheduler`).
- **Bull Board:** `/admin/queues` no está autenticado; no exponerlo públicamente.
- **Redis:** standalone es un punto único de falla; migrar a gestionado/Sentinel cuando
  el uso crezca.
- **Logs:** los contenedores rotan `json-file` a 10 MB × 3. Winston además escribe
  `logs/` dentro del contenedor (efímero).

---

## Troubleshooting

| Síntoma | Causa probable |
|---------|----------------|
| `docker compose up` falla en `migrate` | MySQL aún no está healthy; revisar `docker compose logs mysql` |
| `Cannot find module dist/db/migrations` | La imagen no copió los `.sql`; rebuild |
| `/health/ready` devuelve 503 | MySQL o Redis caídos; el body indica `checks` |
| `pull access denied` en el host | Falta `docker login ghcr.io` o el PAT no tiene `read:packages` |
| El deploy no arranca | El runner self-hosted no está online o no tiene las etiquetas `windows` |
