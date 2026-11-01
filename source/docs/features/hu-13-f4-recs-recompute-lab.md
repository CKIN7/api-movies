# Laboratorio frontend F4 — Recompute de recomendaciones

> **Tipo:** Herramienta de desarrollo · **HU:** HU-13 · **Estado:** Implementado · **Revisión:** 2026-11-01

## Contexto

F4 mueve el recompute de recomendaciones a BullMQ: invalidación síncrona, encolado
best-effort, worker separado y cron nocturno. El contrato está en
[`hu-13-f4-recs-recompute.md`](./hu-13-f4-recs-recompute.md). Faltaba una forma visual de
recorrer el flujo y de disparar las acciones que lo alimentan.

Esta feature agrega `public/recommendations.html` + `public/recommendations.js`, siguiendo
el patrón de [`notifications.html`](./hu-13-f3-notifications-lab.md): HTML + JS vanilla,
`public/auth.js` para la sesión y `express.static('public')`. No agrega dependencias ni build.

## Alcance

Incluye:

- Lista de recomendaciones (`hybrid`, `content`, `collab`) con `type` y `limit`.
- Feedback por tarjeta (`view`, `like`, `hide`, `not_interested`).
- Simulador de review (crear/eliminar) y watchlist (agregar/quitar).
- Mapa embebido de 6 pasos: HTTP → SQL + invalidación → encolado → worker → precache → `recs.ready`.
- Modo laboratorio con contratos, casos borde, guion E2E, resumen de F4 y log.
- Modo demo determinista con cache, colas, worker y notificaciones simuladas.
- Simulación del cron nocturno y de `recs.ready` (con dedupe por fecha).

No incluye:

- Endpoints nuevos de administración de colas (decisión: Opción A, sin backend).
- Lectura en vivo de `getJobCounts()` o del TTL del cache desde el navegador.
- Disparo del recompute masivo real desde la página.
- Tests automatizados de navegador.

## Decisión: Opción A (sin backend)

Desde el navegador no se puede observar si un job se encoló, si el worker lo consumió o si
el cache quedó repoblado: no hay endpoint que lo exponga y `recs.ready` solo lo emite el job
masivo. Para F4 se elige **no agregar endpoints**:

- **Modo real:** la página ejecuta la acción, verifica la invalidación síncrona (paso 2) y
  marca los pasos 3–5 como “no observables desde el navegador”, con link a Bull Board.
  Después recarga recomendaciones para mostrar el efecto del recompute lazy.
- **Modo demo:** anima el pipeline completo, incluido el worker caído, el cron y `recs.ready`.

La alternativa (agregar `GET /admin/queues/recs/status` y `POST .../recompute`) queda como
deuda si se necesita cerrar el mapa en vivo.

## Parámetros

| Parámetro | Default | Efecto |
|-----------|---------|--------|
| `?lab=1` | apagado | Muestra contratos, casos borde, guion, resumen y log |
| `?demo=1` | apagado | Datos mock en memoria; implica laboratorio y no llama a la API |
| `?worker=off` | apagado | Solo con `?demo=1`: simula `worker-recs` caído |
| `?movieId=N` | `1` | Película precargada en el simulador de review |
| `?type=...` | `hybrid` | Tipo inicial: `hybrid`, `content` o `collab` |
| `?limit=N` | `10` | Límite inicial: 5, 10, 20 o 50 |
| `?step=N` | — | Resalta y desplaza a la sección `N` (1 a 8) |

Ejemplos:

```text
/recommendations.html?demo=1
/recommendations.html?demo=1&worker=off&step=3
/recommendations.html?lab=1&type=content&limit=20
/recommendations.html?lab=1&step=5
```

## Contrato

La página consume endpoints existentes:

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/users/me/recommendations?type=&limit=` | Lista por tipo (máx 50) |
| `POST` | `/users/me/recommendations/feedback` | `{ movieId, action }` · invalida cache |
| `POST` | `/movies/:id/reviews` | Crea o actualiza review · invalida cache |
| `DELETE` | `/movies/:id/reviews/me` | Elimina review · invalida cache |
| `POST` | `/users/me/watchlist` | Agrega · invalida cache |
| `DELETE` | `/users/me/watchlist/:movieId` | Quita · invalida cache |

Respuestas relevantes:

- Recomendaciones: array de `{ movie, score, reason }`; vacío si no hay señales.
- Feedback: `201` con `{ movieId, action, applied }` (o `200` si no aplica).
- Review: `201` con `isNew: true` la primera vez; `200` con `isNew: false` en un update.
- Invalidación: `400` si `limit > 50` o si `type` no es válido.

## Criterios de aceptación

- [x] CA-1: sin sesión, la página muestra el aviso de login y no dispara peticiones autenticadas.
- [x] CA-2: la lista usa `GET /users/me/recommendations` con `type` y `limit`.
- [x] CA-3: el feedback por tarjeta envía `POST .../feedback` y recarga la lista.
- [x] CA-4: review y watchlist disparan la invalidación síncrona (paso 2).
- [x] CA-5: en modo real, los pasos 3–5 quedan en “verificar en Bull Board” y hay link a `/admin/queues`.
- [x] CA-6: `?demo=1` anima el pipeline completo sin API, Redis ni MySQL.
- [x] CA-7: `?demo=1&worker=off` deja el job en cola y los pasos 4–5 en ámbar.
- [x] CA-8: la simulación del cron emite `recs.ready` una sola vez por fecha.
- [x] CA-9: `limit=500` y `type=romance` devuelven `400` ejecutables desde casos borde.
- [x] CA-10: `?step=N` resalta la sección indicada.
- [x] CA-11: no hay dependencias nuevas ni cambios de build.

## Casos

### Happy path

1. Login con una cuenta con interacciones (review o watchlist).
2. Abrir `/recommendations.html?lab=1`.
3. Ver la lista `hybrid` y el mapa en reposo sobre los pasos 1–2.
4. Enviar feedback `like` desde una tarjeta.
5. Verificar el paso 2 en verde y los pasos 3–5 en “verificar en Bull Board”.
6. Abrir `/admin/queues`, buscar `recs-recompute-user` y ver el job completado.
7. Recargar recomendaciones: la lista refleja el feedback.
8. (Demo) Simular el cron: pasos 3–6 completos y `recs.ready` en la bandeja.

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| Sin sesión | Abrir la página sin token | Aviso de login, sin llamadas |
| Token vencido | `401` en la primera petición | `Auth` refresca; si falla, vuelve al aviso |
| Límite inválido | `limit=500` | `400` de Zod |
| Tipo inválido | `type=romance` | `400` de Zod |
| Sin señales | Cuenta nueva o demo sin interacciones | Lista vacía y job `skipped` |
| Dedupe por minuto | Dos acciones del mismo usuario en el mismo minuto | Un solo `jobId` |
| Worker caído | `?demo=1&worker=off` o `worker-recs` detenido | Job en cola, pasos 4–5 en ámbar |
| Cron repetido | Dos simulaciones del mismo día | `recs.ready` solo la primera vez |
| Feedback `view` | Acción “Ya la vi” | No invalida cache ni encola |
| API caída | Backend detenido | Error de red en el log; la página no se rompe |
| Modo demo | `?demo=1` | Datos mock; no hay tráfico de red |

## Implementación

```text
public/recommendations.html
public/recommendations.js
public/lab-guide.html
public/preferences.html
public/notifications.html
```

Decisiones:

- En modo real el mapa distingue lo observable (HTTP, SQL, invalidación síncrona) de lo que
  no lo es (cola, worker, precache). No simula estados que no puede verificar.
- En modo demo `demoRequest` imita el contrato real, incluidos `400`, `204` y el lazy fill
  del cache en el `GET`.
- La dedupe del cron usa `dedupeKey = date`; la segunda simulación del día muestra
  `INSERT IGNORE` como no-op.
- `recs.ready` solo se emite desde el cron (job masivo), nunca desde una invalidación.
- El log de peticiones guarda hasta 60 entradas en memoria.

## Verificación

Ejecutado desde `source/`:

```powershell
npm run typecheck
```

Verificación manual en el navegador integrado (servidor estático local):

- `?demo=1`: lista inicial de 8 tarjetas, sin errores de consola.
- Feedback `like`: lista reordenada y mapa 1–5 en verde.
- `?demo=1&worker=off`: pasos 3–5 en ámbar y toast de worker apagado.
- Cron demo: pasos 3–6 en verde y `recs.ready` visible; la segunda corrida no duplica.
- `?demo=1` + “Reset señales”: lista vacía.
- Casos borde: `400` por `limit` y `type`; jobId de dedupe estable.
- `?lab=1`: secciones de contratos, casos borde, guion, resumen y log visibles.
- `?step=5`: resalta y desplaza a casos borde.
- Modo real: tras una acción, pasos 3–5 en “verificar en Bull Board” y link a `/admin/queues`.
- Sin sesión: aviso de login visible y panel principal oculto.

## Limitaciones / deuda

- No hay tests E2E; la verificación es manual, igual que el resto de `public/`.
- El modo real no puede confirmar el estado del job ni el TTL del cache (Opción A).
- El modo demo no persiste: al recargar se reinicia el seed.
- `?lab=1` y `?demo=1` pueden abrirse en cualquier entorno; si deben ocultarse en producción
  se necesita una guarda del servidor.
- El cron se simula en el navegador; el cron real corre en `worker-recs` con
  `upsertJobScheduler`.
