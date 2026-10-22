# HU-12: User Profiles & Preferences 2.0

> **Tipo:** Epic · **Estado:** F0–F5 implementadas · **Revisión:** 2026-10-22

Fases F0–F5 entregadas: correcciones base (`F0`), perfil (`F1`),
preferencias enriquecidas con dislikes/filtros/decay (`F2`), configuración (`F3`),
feedback de recomendaciones (`F4`) y onboarding/cold-start (`F5`).

## Documentos

| Fase | Documento | Estado |
|------|-----------|--------|
| F0 | [Deuda técnica](./f0-deuda.md) | Implementado |
| F1 | [Perfil de usuario](./f1-profile.md) | Implementado |
| F2 | [Preferencias v2](./f2-preferences-v2.md) | Implementado |
| F3 | [Configuración](./f3-settings.md) | Implementado |
| F4 | [Feedback de recomendaciones](./f4-recommendation-feedback.md) | Implementado |
| F5 | [Onboarding & cold-start](./f5-onboarding.md) | Implementado |
| — | [Perfil de usuario frontend](./frontend-profile.md) | Implementado |
| — | [Laboratorio frontend F4/F5](./frontend-lab.md) | Implementado |
| — | [Contrato de autor en reviews](./review-author-contract.md) | Implementado |

El roadmap original de F4–F5 se conserva abajo; las specs detalladas viven en cada
documento enlazado.

---

## F4 — Feedback Loop de Recomendaciones

**Objetivo:** cerrar el ciclo usuario → recs → feedback → mejores recs.

**Estado:** implementado (F4-1…F4-6). Ver [feedback de recomendaciones](./f4-recommendation-feedback.md).

| # | Entregable | Descripción |
|---|-----------|-------------|
| F4-1 | Tabla `recommendation_feedback` | `user_id`, `movie_id`, `action` (`view`, `hide`, `like`, `not_interested`), `created_at` |
| F4-2 | `POST /users/me/recommendations/feedback` | Registra la interacción |
| F4-3 | Ajuste de afinidad | `like` +1; `hide` -0.5; `not_interested` -1.5 por **género**. Solo afecta a `type=hybrid`; `updateGenreAffinity` elimina la entrada al llegar a 0 (no hay valores negativos) |
| F4-4 | Exclusión | Películas marcadas `not_interested` se excluyen en `content`, `collab` y `hybrid` |
| F4-5 | Invalidación | El feedback invalida el cache de recs del usuario |
| F4-6 | Postman | Request de feedback y asserts de reviews (`userId` presente, `email` ausente) |

**Riesgos:** bucles de realimentación (una rec mala penaliza de más) → usar un decay
más agresivo (vida media 30 días) para el feedback implícito.

**Depende de:** F2 (afinidad con timestamps). F1/F3 solo son relevantes si el feedback se expone
en perfiles públicos o se condiciona a `privacy_activity`.

---

## F5 — Onboarding & Cold-Start

**Objetivo:** obtener señal inicial de usuarios nuevos sin historial.

**Estado:** implementado (F5-1…F5-6). Ver [onboarding & cold-start](./f5-onboarding.md).

| # | Entregable | Descripción |
|---|-----------|-------------|
| F5-1 | `POST /users/me/onboarding` | Selección guiada de géneros/directores favoritos |
| F5-2 | Seed de afinidad | El onboarding siembra `genre_affinity` con peso alto inicial |
| F5-3 | Recs "populares del género" | Fallback de `hybrid` cuando no hay ranking: `rating` dentro de géneros favoritos/afinidad |
| F5-4 | Progreso de onboarding | Bandera `onboarding_completed` en `user_settings` (solo lectura vía settings) |
| F5-5 | Cold-start híbrido | `rating` (popularidad) + favoritos + afinidad efectiva, excluyendo vistos y `not_interested` |
| F5-6 | Postman | Request `Completar onboarding` en la carpeta `Preferences` y revisión final |

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
