# Laboratorio frontend F3 — Notificaciones in-app

> **Tipo:** Herramienta de desarrollo · **HU:** HU-13 · **Estado:** Implementado · **Revisión:** 2026-10-30

## Contexto

F3 (notificaciones in-app con fan-out y email opcional) quedó implementada y verificada en el backend, pero no existía una forma visual de ejercitarla: la API se probaba con tests, `curl`/Postman y Bull Board. Esta feature agrega una página estática, `public/notifications.html`, para mostrar el flujo completo, explicar las decisiones de diseño y permitir crear una review real que dispare el evento.

Sigue el patrón de `public/preferences.html` y `public/settings.html`: HTML + JS vanilla, `public/auth.js` para la sesión y `express.static('public')` para servirla. No agrega dependencias ni build.

## Alcance

Incluye:

- Lista de notificaciones del usuario autenticado, con badge de no leídas.
- Filtro `Todas` / `No leídas` y acciones `Marcar leída` y `Marcar todas`.
- Polling configurable (default 30 s; `0` lo desactiva).
- Diagrama animado del flujo `review.published → fan-out → in-app/email`.
- Simulador que crea una review real y muestra el resultado (`201` vs `200`, `isNew`).
- Toggle de `notify_email` que actualiza `PATCH /users/me/settings` antes de crear la review.
- Toggle para repetir el `POST` y demostrar la idempotencia (`isNew=false`, sin notificación nueva).
- Modo laboratorio con contratos, casos borde, resumen de lo construido y log de peticiones.
- Modo demo con datos en memoria, sin API, Redis ni MySQL.
- Enlace `Notificaciones` en el menú de usuario de la landing y del resto de las páginas.

No incluye:

- Notificaciones en tiempo real (SSE/WebSocket); el polling es el mecanismo vigente.
- Centro de preferencias de notificaciones por canal.
- Paginación visual más allá de la primera página de 20 ítems.
- Tests automatizados de navegador.
- Protección de servidor para ocultar `?lab=1` en producción.

## Parámetros

| Parámetro | Default | Efecto |
|-----------|---------|--------|
| `?lab=1` | apagado | Muestra simulador, contratos, casos borde, resumen y log |
| `?demo=1` | apagado | Datos mock en memoria; implica modo laboratorio y no llama a la API |
| `?autopoll=N` | `30` | Intervalo de polling en segundos; `0` lo desactiva |
| `?movieId=N` | `1` | Película precargada en el simulador |
| `?step=N` | — | Resalta y desplaza a la sección `N` (1 a 7) |

Ejemplos:

```text
/notifications.html?demo=1&step=3
/notifications.html?lab=1&autopoll=10
/notifications.html?lab=1&movieId=2&step=3
```

## Contrato

La página consume endpoints existentes:

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/users/me/notifications?page=&limit=&unread_only=` | Lista paginada |
| `GET` | `/users/me/notifications/unread-count` | Badge de no leídas |
| `PATCH` | `/users/me/notifications/:id/read` | Marcar una |
| `PATCH` | `/users/me/notifications/read-all` | Marcar todas |
| `PATCH` | `/users/me/settings` | Actualizar `notifyEmail` desde el simulador |
| `POST` | `/movies/:id/reviews` | Crear o actualizar la review que emite el evento |

Respuestas relevantes:

- Lista: `{ notifications, total, page, limit }`; cada ítem trae `id` string, `type`, `payload`, `readAt`, `createdAt`.
- Contador: `{ unread }`.
- Marcar una: `{ notification }`; idempotente, conserva el `readAt` original.
- Marcar todas: `{ updated }`.
- Review: `201` con `isNew: true` en la primera creación y `200` con `isNew: false` en un update.
- Notificación ajena: `404` con `{ error: 'Notificación no encontrada' }` (nunca `403`).

## Criterios de aceptación

- [x] CA-1: sin sesión, la página muestra el aviso de login y no dispara peticiones autenticadas.
- [x] CA-2: con sesión, la lista y el badge usan `notifications` y `unread-count`.
- [x] CA-3: `Marcar leída` y `Marcar todas` reflejan el cambio en la lista y en el badge.
- [x] CA-4: el filtro `No leídas` envía `unread_only=true` y renderiza solo las pendientes.
- [x] CA-5: el polling refresca la vista cada 30 s por defecto y se puede desactivar con `?autopoll=0`.
- [x] CA-6: el simulador crea una review y la notificación aparece tras el polling manual.
- [x] CA-7: repetir el `POST` devuelve `200` con `isNew=false` y no genera notificación nueva.
- [x] CA-8: `notify_email` se aplica vía settings y el flujo animado omite el nodo de email cuando está en `false`.
- [x] CA-9: `?lab=1` muestra contratos, casos borde, resumen F3 y log de peticiones.
- [x] CA-10: `?demo=1` funciona sin backend, sin Redis y sin MySQL.
- [x] CA-11: `?step=N` resalta la sección indicada.
- [x] CA-12: no hay dependencias nuevas ni cambios de build.
- [x] CA-13: el menú de usuario de la landing y de las páginas existentes linkea a `notifications.html`.

## Casos

### Happy path

1. Login con una cuenta verificada.
2. Abrir `/notifications.html?lab=1`.
3. Ver la lista y el badge con las notificaciones existentes.
4. Crear una review desde el simulador y esperar el refresco.
5. Verificar que aparece la notificación nueva y que el badge incrementa.
6. Marcar una como leída y luego marcar todas.
7. Repetir el `POST` y comprobar `isNew=false` sin notificación nueva.

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| Sin sesión | Abrir la página sin token | Aviso de login, sin llamadas |
| Token vencido | `401` en la primera petición | `Auth` refresca; si falla, vuelve al aviso de login |
| Notificación ajena | `PATCH` con id de otro usuario | `404` visible en el caso borde |
| Límite inválido | `limit=500` | `400` de Zod |
| Marcar dos veces | Dos `PATCH` sobre el mismo id | Mismo `readAt` en ambas respuestas |
| Review existente | `POST` sobre una película ya reseñada | `200`, `isNew=false`, sin evento |
| Sin notificaciones | Cuenta nueva | Estado vacío con invitación a crear una review |
| `notify_email=false` | Toggle apagado | Notificación in-app sí, email no |
| API caída | Backend detenido | Error de red en el log; la página no se rompe |
| Modo demo | `?demo=1` | Datos mock; no hay tráfico de red |

## Implementación

```text
public/notifications.html
public/notifications.js
public/index.html
public/settings.html
public/preferences.html
public/profile.html
```

Decisiones:

- La página es un laboratorio, no una SPA: usa el patrón estático del repo y `auth.js` existente.
- `?lab=1` y `?demo=1` son convenciones de UI, no mecanismos de seguridad.
- En modo demo el router de `demoRequest` imita el contrato real (incluidos `404` y `400`) para que la presentación no dependa del entorno.
- El simulador modifica `notifyEmail` en settings porque el fan-out lo lee desde `user_settings`; no hay forma de pasarlo por el `POST` de la review.
- El polling se pausa cuando la pestaña no está visible.
- La animación del flujo es ilustrativa y ocurre después de la respuesta del `POST`; no refleja el tiempo real del worker.
- El log de peticiones se guarda en memoria, con un máximo de 60 entradas.

## Verificación

Ejecutado desde `source/`:

```powershell
npm run typecheck
```

La página se sirvió con un servidor estático local y se verificó en el navegador integrado:

- `?demo=1`: badge inicial en 2, lista de 3 ítems, sin errores de consola.
- Simulador: `201 · isNew=true`, aparece la notificación y el badge pasa a 3.
- Repetición: dos `POST` con `200 · isNew=false`, sin ítem nuevo.
- Marcar leída, filtro `No leídas` y `Marcar todas`: estado y badge consistentes.
- Casos borde: `404`, `400`, `readAt` estable e `isNew=false`.
- `?step=7`: resalta y desplaza a la sección de log.
- Sin sesión: aviso de login visible y panel principal oculto.

## Limitaciones / deuda

- No hay tests E2E; la verificación es manual, igual que en el resto de las páginas de `public/`.
- `?lab=1` y `?demo=1` pueden abrirse en cualquier entorno; si deben ocultarse en producción se necesita una guarda del servidor o quitarlas del build.
- El simulador usa `rating: 4.5` y un comentario generado; no permite elegir rating ni comentario.
- Solo se muestra la primera página (20 ítems); no hay controles de paginación.
- El polling no reemplaza a SSE/WebSocket, que siguen como deuda post-F4.
- El modo demo no persiste: al recargar se reinicia el seed.
