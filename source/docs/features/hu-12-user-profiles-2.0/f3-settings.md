# HU-12 / F3: Configuración de Usuario

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F3 · **Estado:** Implementado · **Revisión:** 2026-10-21

Como usuario de la API,
quiero ajustar el idioma, tema, notificaciones y privacidad de mi cuenta,
para que la experiencia respete mis preferencias.

Fase 3 de *User Profiles & Preferences 2.0*. Añade la tabla `user_settings` y dos endpoints.
**Sin fila ⇒ defaults**; el primer `PATCH` hace upsert (no requiere registro previo).

---

## Endpoints

### `GET /users/me/settings` (auth)

```json
{
  "language": "es",
  "theme": "system",
  "region": null,
  "notifyEmail": true,
  "notifyPush": false,
  "privacyReviews": "public",
  "privacyWatchlist": "public",
  "privacyActivity": "friends",
  "spoilerFree": false,
  "onboardingCompleted": false,
  "updatedAt": null
}
```

### `PATCH /users/me/settings` (auth)

Actualización **parcial** con upsert. Valores por defecto si no existe fila:

| Campo | Default | Valores |
|-------|---------|---------|
| `language` | `es` | `es`, `en`, `en-US`, … |
| `theme` | `system` | `light` \| `dark` \| `system` |
| `region` | `null` | ISO-3166 alfa-2 (normalizado a mayúsculas) |
| `notifyEmail` | `true` | boolean |
| `notifyPush` | `false` | boolean |
| `privacyReviews` | `public` | `public` \| `friends` \| `private` |
| `privacyWatchlist` | `public` | `public` \| `friends` \| `private` |
| `privacyActivity` | `friends` | `public` \| `friends` \| `private` |
| `spoilerFree` | `false` | boolean |
| `onboardingCompleted` | `false` | boolean (**solo lectura**; lo marca `POST /users/me/onboarding`) |

`onboardingCompleted` se devuelve en `GET` y `PATCH`, pero no se acepta en el body del
`PATCH`: un `PATCH` posterior preserva el valor actual.

---

## Criterios de Aceptación

* **CA-F3-01 — Defaults sin fila**
  `GET /users/me/settings` de un usuario sin fila → `200` con `DEFAULT_SETTINGS` (nunca `404`).

* **CA-F3-02 — PATCH parcial + upsert**
  Solo actualiza los campos enviados; body vacío `{}` → `400`; el primer PATCH crea la fila.

* **CA-F3-03 — Validación**
  `theme` ∈ THEMES; `privacy*` ∈ PRIVACY_LEVELS; `language` con formato `xx` / `xx-YY`;
  `region` ISO-3166 alfa-2 (normalizado).

* **CA-F3-04 — Persistencia**
  Los valores sobreviven a un `GET` posterior y a varios `PATCH` incrementales.

* **CA-F3-05 — Aislamiento**
  Un usuario no puede leer ni modificar la configuración de otro (`:id` no existe en la ruta; siempre `req.user.id`).

* **CA-F3-06 — Autenticación**
  Sin token válido → `401`.

* **CA-F3-07 — Bandera de onboarding (F5)**
  `onboardingCompleted` es `false` por defecto y solo lectura en settings; lo marca
  `POST /users/me/onboarding`. Un `PATCH` posterior preserva el valor (`true`).

---

## Happy Path

| # | Entrada | Comportamiento |
|---|---------|----------------|
| H1 | `GET` sin fila | ✅ 200 → defaults |
| H2 | `PATCH { theme: "dark" }` | ✅ 200 → `theme: "dark"` |
| H3 | `PATCH { region: "es" }` | ✅ 200 → `region: "ES"` |
| H4 | `PATCH` seguido de `GET` | ✅ valores persistidos |

---

## Boundary Cases

| # | Entrada | Comportamiento |
|---|---------|----------------|
| B1 | `theme: "neon"` | ❌ 400 |
| B2 | `privacyActivity: "secret"` | ❌ 400 |
| B3 | `language: "e"` | ❌ 400 |
| B4 | `region: "ESP"` | ❌ 400 |
| B5 | body `{}` | ❌ 400 |

---

## Corner Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| C1 | `GET` sin token | ❌ 401 |
| C2 | `PATCH` sin token | ❌ 401 |
| C3 | `PATCH` dos veces (merge) | Se conservan campos previos |
| C4 | Usuario A no ve la config de B | `req.user.id` siempre |

---

## Edge Cases

| # | Caso | Comportamiento |
|---|------|----------------|
| EC1 | `region: null` | Se elimina la región |
| EC2 | `notifyEmail: false` | Se guarda `0` y se lee `false` |
| EC3 | `updatedAt` | `null` hasta el primer `PATCH` |

---

## Notas de implementación

1. **Tabla** `user_settings` (PK = `user_id`, FK `users` ON DELETE CASCADE).
2. **Upsert**: `INSERT ... ON DUPLICATE KEY UPDATE` (una sola ruta para crear y actualizar).
3. **Booleanos**: `TINYINT(1)` en DB ↔ `boolean` en el DTO (`toBool`).
4. **Rutas**: bajo `/users` con `requireAuth`.

---

## Archivos a crear (Estructura de árbol)

```text
source/
├── db/migrations/
│   └── 202610190003_user_settings.sql          ★ NUEVO
├── domain/
│   └── UserSettings.ts                         ★ NUEVO
├── repositories/
│   └── UserSettingsRepository.ts               ★ NUEVO
├── schemas/
│   └── userSettings.ts                         ★ NUEVO
├── services/
│   └── userSettingsService.ts                  ★ NUEVO
├── controllers/
│   └── userSettingsController.ts               ★ NUEVO
├── routes/
│   └── userSettingsRoutes.ts                   ★ NUEVO
├── types/
│   └── user.ts                                 ✎ UserSettings* / PRIVACY_LEVELS / THEMES
├── api.ts                                      ✎ wiring + mount
└── __tests__/
    ├── unit/
    │   └── userSettings.test.ts                ★ NUEVO
    └── integration/
        └── user-settings.integration.test.ts   ★ NUEVO
```

---

## Diagrama de flujo (textual)

```text
PATCH /users/me/settings
  │
  ├─ userSettingsRoutes (requireAuth) → controller.updateSettings
  ├─ updateUserSettingsSchema.safeParse(body) → 400 si inválido / vacío
  ├─ userSettingsService.updateSettings()
  │    ├─ findByUserId() → merge con defaults
  │    └─ repo.save()  ← INSERT ... ON DUPLICATE KEY UPDATE
  └─ 200 OK → UserSettingsResponse
```

---

## Verificación

* `npm run migrate` (aplica la migración en la BD de la app)
* `npm test -- userSettings` · `npm test -- user-settings`
* `npm run build`
