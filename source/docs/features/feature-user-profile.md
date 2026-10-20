# HU-12 / F1: Perfil de Usuario

Como usuario de la API,
quiero tener un perfil (nombre visible, bio, avatar, país) con visibilidad configurable,
para presentarme ante otros usuarios sin exponer mi email.

Fase 1 de *User Profiles & Preferences 2.0*. Añade la tabla `user_profiles` y tres endpoints.
El perfil es **privado por defecto** (`is_public = 0`).

---

## Endpoints

### `GET /users/me/profile` (auth)

Perfil completo del usuario autenticado.

```json
{
  "displayName": "Ana",
  "bio": "Fan del sci-fi de los 90",
  "avatarUrl": "https://example.com/ana.png",
  "country": "ES",
  "birthYear": 1990,
  "isPublic": true,
  "createdAt": "2026-10-19T10:00:00.000Z",
  "updatedAt": "2026-10-19T10:05:00.000Z"
}
```

### `PATCH /users/me/profile` (auth)

Actualización **parcial**. Campos: `displayName`, `bio`, `avatarUrl`, `country`, `birthYear`, `isPublic`.
Enviar `null` limpia el campo.

### `GET /users/:id/profile` (público)

Perfil público. Nunca expone el email.
Si el perfil es privado (o no existe fila), devuelve una tarjeta minimal `{ ..., "isPublic": false }`.
Si es público, incluye `stats`:

```json
{
  "displayName": "Ana",
  "bio": "Fan del sci-fi de los 90",
  "avatarUrl": "https://example.com/ana.png",
  "country": "ES",
  "isPublic": true,
  "stats": {
    "topGenres": [{ "genreId": 2, "genreName": "sci-fi", "count": 4 }],
    "topDirectors": [{ "directorId": 1, "directorName": "Christopher Nolan", "count": 3 }],
    "totalReviews": 12,
    "totalWatchlist": 5
  }
}
```

---

## Criterios de Aceptación

* **CA-F1-01 — Validación**
  `displayName` 2–50 sin HTML; `bio` ≤ 300 sin HTML; `avatarUrl` http/https ≤ 500;
  `country` ISO-3166 alfa-2 (normalizado a mayúsculas); `birthYear` ∈ [1900, añoActual−13].

* **CA-F1-02 — PATCH parcial**
  Solo actualiza los campos enviados; body vacío `{}` → `400`.

* **CA-F1-03 — Sin fila**
  `GET /users/me/profile` de un usuario sin perfil → `200` con defaults (`isPublic: false`), nunca `404`.

* **CA-F1-04 — Visibilidad pública**
  `:id` inexistente → `404`. Perfil privado o sin fila → `200` con tarjeta minimal (`isPublic: false`).

* **CA-F1-05 — Stats públicos**
  Perfil público incluye `stats` (reutiliza `getStats`). Nunca incluye `email`.

* **CA-F1-06 — Invalidación**
  `PATCH` invalida las recomendaciones del usuario (fail-open) **solo si cambian `birthYear` o
  `country`**. Son los únicos campos que el motor podrá consumir en el futuro (filtros de edad y
  catálogo regional); los cambios cosméticos no fuerzan recomputación.

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `PATCH /users/me/profile { displayName: "Ana" }` | ✅ 200 → perfil actualizado |
| H2 | `PATCH ... { isPublic: true }` + `GET /users/:id/profile` | ✅ 200 → perfil con `stats` |
| H3 | `GET /users/me/profile` sin fila | ✅ 200 → defaults |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | `displayName` de 1 char | ❌ 400 |
| B2 | `displayName` de 51 chars | ❌ 400 |
| B3 | `bio` de 301 chars | ❌ 400 |
| B4 | `avatarUrl` con `ftp://` | ❌ 400 |
| B5 | `country: "XXX"` | ❌ 400 |
| B6 | `birthYear: 1899` | ❌ 400 |
| B7 | body `{}` | ❌ 400 |

---

## Corner Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| C1 | `/users/me/profile` sin token | ❌ 401 |
| C2 | `/users/:id/profile` con `:id` no-UUID | ❌ 400 |
| C3 | Perfil ajeno privado | ✅ 200 → tarjeta minimal |
| C4 | `:id` inexistente | ❌ 404 |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | `bio: ""` | Se guarda `null` (o vacío normalizado) |
| EC2 | `country: "es"` | Se normaliza a `"ES"` |
| EC3 | Emojis en `displayName` | Válido |
| EC4 | `isPublic` cambia | Reflejado de inmediato en `/users/:id/profile` |

---

## Notas de implementación

1. **Tabla** `user_profiles` (PK = `user_id`, FK `users` ON DELETE CASCADE), `is_public` default `0`.
2. **Orden de rutas**: `GET/PATCH /me/profile` antes de `GET /:id/profile`.
3. **Privacidad**: el DTO público se compone en el servicio; nunca se serializa `email`.
4. **Sin fila al `GET`**: se devuelve un default estable, sin crear registros de forma implícita.

---

## Cambio final: autor de reviews con `userId` (sin `email`)

Para que el frontend pueda navegar de una review a `GET /users/:id/profile`, las respuestas de reviews exponen el UUID del autor. A la vez se deja de exponer su email, que era un dato más sensible y no necesario para la UI.

### Contrato

| Endpoint | Antes | Ahora |
|----------|-------|-------|
| `POST /movies/:id/reviews` | `data.email` | `data.userId` |
| `PATCH /movies/:id/reviews/me` | `data.email` | `data.userId` |
| `GET /movies/:id/reviews` | cada item con `email` | cada item con `userId` |

`userId` es el `users.id` (UUID v4) del autor. El frontend lo usa para enlazar a `/users/{userId}/profile`; no necesita adivinarlo ni obtenerlo de otra fuente.

### Implementación

* `types/review.ts`: `ReviewResponse.userId`; se elimina `email` de `ReviewRow`.
* `domain/Review.ts`: el dominio guarda `userId` y `toResponse()` lo serializa; `fromRow()` lee `row.user_id`.
* `repositories/ReviewRepository.ts`: se elimina el `JOIN users` y la selección de `u.email` en `findByMovieId`, `findById` y `findByUserAndMovie`.
* `__tests__/integration/reviews.api.integration.test.ts`: valida `userId === TEST_USER_ID` y `email === undefined` en POST y GET.
* `__tests__/unit/reviews.unit.test.ts`: mocks con filas snake_case (`movie_id`, `user_id`, `created_at`, `updated_at`) sin `email`.

### Compatibilidad

Es un cambio incompatible para cualquier cliente que leyera `email` en reviews. En este repositorio el único consumidor es la UI propia (`public/`), que todavía no renderiza reviews, así que no hay impacto en producción. La colección de Postman no asserta `email`; al actualizarla para F4/F5 conviene añadir la aserción de `userId` y la ausencia de `email`.

---

## Archivos a crear (Estructura de árbol)

```text
source/
├── db/migrations/
│   └── 202610190001_user_profiles.sql          ★ NUEVO
├── domain/
│   └── UserProfile.ts                          ★ NUEVO
├── repositories/
│   └── UserProfileRepository.ts                ★ NUEVO
├── schemas/
│   └── userProfile.ts                          ★ NUEVO
├── services/
│   └── userProfileService.ts                   ★ NUEVO
├── controllers/
│   └── userProfileController.ts                ★ NUEVO
├── routes/
│   └── userProfileRoutes.ts                    ★ NUEVO
├── types/
│   └── user.ts                                 ✎ tipos de perfil
├── api.ts                                      ✎ wiring + mount
└── __tests__/
    ├── unit/
    │   └── userProfile.test.ts                 ★ NUEVO
    └── integration/
        └── user-profile.integration.test.ts    ★ NUEVO
```

---

## Diagrama de flujo (textual)

```text
PATCH /users/me/profile
  │
  ├─ userProfileRoutes (requireAuth) → controller.updateMyProfile
  ├─ updateUserProfileSchema.safeParse(body) → 400 si inválido / body vacío
  ├─ userProfileService.updateProfile()
  │    ├─ findByUserId() → merge con fila actual (o defaults)
  │    ├─ repo.update() | repo.insert()
  │    └─ si cambian birthYear/country → invalidateUserRecommendations(userId)
  └─ 200 OK → UserProfileResponse

GET /users/:id/profile
  │
  ├─ userProfileController.getPublicProfile
  ├─ service: userRepo.findById(id) → 404 si no existe
  ├─ profileRepo.findByUserId(id) → sin fila / !isPublic → tarjeta minimal
  └─ 200 OK → PublicProfileResponse (+ stats si público)
```

---

## Verificación

* `npm test -- userProfile` (unit)
* `npm test -- user-profile` (integración)
* `npm test -- reviews` (unit) y `npm test -- reviews.api` (integración): contrato `userId` sin `email`.
* `npm run build`
