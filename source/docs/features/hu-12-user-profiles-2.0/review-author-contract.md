# Contrato de autor en reviews: `userId` en lugar de `email`

> **Tipo:** Contrato · **HU:** HU-12 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como consumidor de la API,
quiero conocer el UUID del autor de una review para poder enlazar a su perfil público,
sin recibir su email, que es un dato sensible e innecesario para la UI.

Este cambio acompaña a F1 (`GET /users/:id/profile`): el frontend puede pasar de una review a
`/users/{userId}/profile` sin adivinar ni pedir el id por otra vía.

---

## Contexto

Antes, las reviews se leían con un `JOIN users` y el DTO exponía `email`. Con el perfil público ya
disponible, el identificador correcto para navegar es `users.id` (UUID), no el email.

---

## Contrato

| Endpoint | Antes | Ahora |
|----------|-------|-------|
| `POST /movies/:id/reviews` | `data.email` | `data.userId` |
| `PATCH /movies/:id/reviews/me` | `data.email` | `data.userId` |
| `GET /movies/:id/reviews` | cada item con `email` | cada item con `userId` |
| `GET /movies/:id/reviews/me` | fila cruda con `user_id` y `email` | fila cruda con `user_id`, **sin `email`** (sigue en `snake_case`) |

`userId` es el `users.id` (UUID v4) del autor.

### Excepción conocida: `GET /movies/:id/reviews/me`

Ese endpoint devuelve la fila de persistencia tal cual (`reviewService.getMyReview` →
`ReviewRow`) envuelta en `{ data: ... }` (`controllers/reviewController.ts:42-44`), así que sus
campos siguen en `snake_case`:

```json
{
  "data": {
    "id": 1,
    "movie_id": 7,
    "user_id": "0f0c...",
    "rating": 4.5,
    "comment": "Excelente",
    "created_at": "...",
    "updated_at": "..."
  }
}
```

No se normalizó en este cambio para no ampliar el breaking change. Queda como deuda: mapearlo a
`ReviewResponse` (camelCase, sin `movie_id`/timestamps internos) en un follow-up. Mientras tanto,
**no asumir `userId` en ese endpoint**.

---

## Implementación

* `types/review.ts`: `ReviewResponse.userId`; se elimina `email` de `ReviewRow`.
* `domain/Review.ts`: el dominio guarda `userId` y `toResponse()` lo serializa; `fromRow()` lee
  `row.user_id`.
* `repositories/ReviewRepository.ts`: se elimina el `JOIN users` y la selección de `u.email` en
  `findByMovieId`, `findById` y `findByUserAndMovie`; ahora se usa `SELECT r.*` / columnas
  explícitas de `reviews`.
* `__tests__/integration/reviews.api.integration.test.ts`: valida `userId === TEST_USER_ID` y
  `email === undefined` en POST y en el listado GET.
* `__tests__/unit/reviews.unit.test.ts`: mocks con filas `snake_case` (`movie_id`, `user_id`,
  `created_at`, `updated_at`) sin `email`.

---

## Compatibilidad

Es un cambio incompatible para cualquier cliente que leyera `email` en reviews. En este
repositorio:

* La UI propia (`public/`) consume `POST /movies/:id/reviews`, pero solo usa el status y muestra un
  toast; no lee `email` (`public/preferences.js:268-283`).
* La colección de Postman no asserta `email`; al actualizarla para F4/F5 (entregable `F4-6`)
  conviene añadir la aserción de `userId` y la ausencia de `email`.

---

## Verificación

* `npm test -- reviews` (unit)
* `npm test -- reviews.api` (integración)
* `npm run build`

---

## Deuda abierta

* Normalizar `GET /movies/:id/reviews/me` a `ReviewResponse` (breaking para ese endpoint).
* Evaluar si el frontend necesita `createdAt` en ese endpoint; `ReviewResponse` ya lo incluye.
