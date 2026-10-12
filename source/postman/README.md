# Postman — API Movies

Colección Postman con los 34 endpoints de la API (más 3 casos negativos de errores).

## Archivos

- `api-movies.postman_collection.json` — colección (v2.1).
- `api-movies.postman_environment.json` — environment con variables (`baseUrl`, credenciales del admin seed, tokens, etc.).

## Importación

1. Postman → **Import** → selecciona los dos archivos JSON.
2. Selecciona el environment **API Movies - Local** en el selector superior derecho.
3. Levanta la API (`npm run dev` en `source/`, necesita MySQL y Redis).

## Flujo recomendado

1. **Auth → Login (admin seed)** — usa `admin@example.com` / `password123` (usuario seed verificado con rol admin; ver `db/seed.ts`). Guarda automáticamente `accessToken`, `refreshToken` y `userId`.
2. Ejecuta las carpetas en orden: **Movies → Search → Reviews → Watchlist → Export → Users → Metrics**.
3. El pre-request de la colección **renueva el access token** solo cuando está por expirar (usa `/auth/refresh`, que rota el refresh token). Si falla el refresh, vuelve a ejecutar el login.

## Variables principales

| Variable | Descripción |
|---|---|
| `baseUrl` | `http://localhost:8089` (puerto fijo en `api.ts`) |
| `accessToken` / `refreshToken` | Se rellenan con el login; access token dura 15 min |
| `autoLogin` | `true` para login automático cuando faltan tokens (cuidado: `/auth` limita 10 req/min) |
| `movieId` | Id numérico de película; se actualiza solo desde GET/POST/PATCH de Movies |
| `exportFormat` | `csv` o `json` |
| `targetUserId` | UUID de otro usuario para `PATCH /users/:id/role` (no puedes cambiar tu propio rol → 400) |
| `verifyToken` / `resetToken` | Tokens de email en dev: aparecen en la **consola del servidor** (`{APP_URL}/auth/verify/{token}`, `{APP_URL}/auth/reset/{token}`) |
| `userAccessToken` | Token de un rol `user` para probar el 403 de la carpeta *Errores comunes* |

## Notas

- **Roles**: `user` < `premium` < `admin`. Export requiere premium+; CRUD de películas, audit-log, `/users/:id/role` y `/metrics/*` requieren admin.
- **Rate limits**: `/auth/*` 10/min por IP; escrituras en `/movies*` 30/min; global 100/min. Errores 429 con `{ error, retryAfter }` y headers `X-RateLimit-*`.
- **Login exige email verificado** (403 si no). Registra un usuario y usa el token de verificación de los logs del servidor.
- Las reseñas son **upsert por usuario y película** (POST → 201 si es nueva, 200 si actualiza).
- `DELETE /movies/:id` borra de verdad: usa una película creada por ti si vas a seguir probando.
- Para descargar el archivo de export cómodamente: Postman → Settings → *Download postman response files*, o botón *Send and Download*.
- La búsqueda (`/movies/search`) usa Meilisearch si está habilitado y hace fallback a MySQL (`meta.source` lo indica).
