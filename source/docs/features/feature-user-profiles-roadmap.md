# HU-12 / Roadmap: User Profiles & Preferences 2.0 (F4–F5)

Fases F0–F3 ya entregadas: correcciones base (`F0`), perfil (`F1`),
preferencias enriquecidas con dislikes/filtros/decay (`F2`) y configuración (`F3`).

Este documento describe las fases **pendientes** y el cierre de cada una (incluida la colección de Postman).

---

## F4 — Feedback Loop de Recomendaciones

**Objetivo:** cerrar el ciclo usuario → recs → feedback → mejores recs.

| # | Entregable | Descripción |
|---|-----------|-------------|
| F4-1 | Tabla `recommendation_feedback` | `user_id`, `movie_id`, `action` (`view`, `hide`, `like`, `not_interested`), `created_at` |
| F4-2 | `POST /users/me/recommendations/feedback` | Registra la interacción |
| F4-3 | Ajuste de afinidad | `like` suma afinidad; `not_interested`/`hide` penalizan la afinidad de **géneros** (F2 solo persiste `genre_affinity`; extender a directores/actores requiere mapas nuevos) |
| F4-4 | Exclusión | Películas marcadas `not_interested` se excluyen como candidatas |
| F4-5 | Invalidación | El feedback invalida el cache de recs del usuario |
| F4-6 | Postman | Al cerrar la fase: requests de feedback, asserts de reviews (`userId` presente, `email` ausente) y smoke run de la colección (las carpetas `Profile`/`Settings` de F1/F3 ya están incorporadas) |

**Riesgos:** bucles de realimentación (una rec mala penaliza de más) → usar un decay
más agresivo (vida media 30 días) para el feedback implícito.

**Depende de:** F2 (afinidad con timestamps). F1/F3 solo son relevantes si el feedback se expone
en perfiles públicos o se condiciona a `privacy_activity`.

---

## F5 — Onboarding & Cold-Start

**Objetivo:** obtener señal inicial de usuarios nuevos sin historial.

| # | Entregable | Descripción |
|---|-----------|-------------|
| F5-1 | `POST /users/me/onboarding` | Selección guiada de géneros/directores favoritos |
| F5-2 | Seed de afinidad | El onboarding siembra `genre_affinity` con peso alto inicial |
| F5-3 | Recs "populares del género" | Fallback cuando la afinidad está vacía |
| F5-4 | Progreso de onboarding | Bandera `onboarding_completed` en `user_settings` |
| F5-5 | Cold-start híbrido | Mezcla popularidad global + afinidad sembrada |
| F5-6 | Postman | Al cerrar la fase: requests de onboarding y revisión final de la colección |

**Riesgos:** sesgo de popularidad → diversificar con un vector de exploración (10%).

**Depende de:** F2 (afinidad), F3 (`user_settings.onboarding_completed`), F4 (feedback).

---

## Orden recomendado

```text
F4 (feedback) ──▶ F5 (onboarding cold-start)
        └──────────────┘
   F2/F3 ya cierran la base de afinidad/config
```

---

## Cierre de fase

Cada fase termina con:

1. Tests de la suite afectada y `npm run build`.
2. Actualización de `postman/api-movies.postman_collection.json` (carpeta de la fase + backfill
   pendiente) y smoke run de la colección.
3. Doc de la fase actualizado.

---

## Métricas de éxito (a instrumentar)

* CTR de recomendaciones (`feedback/view` / `recs_served`).
* Ratio `not_interested` (objetivo: < 10%).
* Cobertura de catálogo (distribución de géneros recomendados).
* Tasa de finalización del onboarding (F5).

---

## Fuera de alcance (por ahora)

* Recomendación en tiempo real (streaming).
* Perfiles múltiples por cuenta.
* Privacidad granular por campo del perfil (además de `is_public`).
