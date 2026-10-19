# HU-12 / Roadmap: User Profiles & Preferences 2.0 (F4–F5)

Fases F0–F3 ya entregadas: correcciones base (`F0`), perfil (`F1`),
preferencias enriquecidas con dislikes/filtros/decay (`F2`) y configuración (`F3`).

Este documento describe las fases **pendientes**. No forma parte del alcance actual.

---

## F4 — Feedback Loop de Recomendaciones

**Objetivo:** cerrar el ciclo usuario → recs → feedback → mejores recs.

| # | Entregable | Descripción |
|---|-----------|-------------|
| F4-1 | Tabla `recommendation_feedback` | `user_id`, `movie_id`, `action` (`view`, `hide`, `like`, `not_interested`), `created_at` |
| F4-2 | `POST /users/me/recommendations/feedback` | Registra la interacción |
| F4-3 | Ajuste de afinidad | `like` suma afinidad; `not_interested`/`hide` penalizan el género/director/actor |
| F4-4 | Exclusión | Películas marcadas `not_interested` se excluyen como candidatas |
| F4-5 | Invalidación | El feedback invalida el cache de recs del usuario |

**Riesgos:** bucles de realimentación (una rec mala penaliza de más) → usar un decay
más agresivo (vida media 30 días) para el feedback implícito.

**Depende de:** F2 (afinidad con timestamps), F3 (config, p. ej. si el perfil es privado).

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

## Métricas de éxito (a instrumentar)

* CTR de recomendaciones (`feedback/view` / `recs`served).
* Ratio `not_interested` (objetivo: < 10%).
* Cobertura de catálogo (distribución de géneros recomendados).
* Tasa de finalización del onboarding (F5).

---

## Fuera de alcance (por ahora)

* Recomendación en tiempo real (streaming).
* Perfiles múltiples por cuenta.
* Privacidad granular por campo del perfil (además de `is_public`).
