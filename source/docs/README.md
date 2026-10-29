# Documentación

> **Revisión:** 2026-10-22

Índice de la documentación técnica y funcional del proyecto.

## Estructura

```text
docs/
  README.md                  # este índice
  _template-feature.md       # plantilla para nuevas specs
  features/                  # specs por historia de usuario
    hu-09-suggest.md
    hu-10-user-profiles-preferences.md
    hu-11-recommendation-engine.md
    hu-12-user-profiles-2.0/
  cross-cutting/             # mejoras transversales (infra, tests, export)
  fixes/                     # correcciones puntuales con spec propia
  proposals/                 # propuestas y notas de diseño sin implementar
```

## Features

| HU | Documento | Estado |
|----|-----------|--------|
| HU-09 | [Sugerencia de película incompleta](./features/hu-09-suggest.md) | Implementado |
| HU-10 | [User Profiles & Preferences](./features/hu-10-user-profiles-preferences.md) | Implementado |
| HU-11 | [Motor de recomendaciones](./features/hu-11-recommendation-engine.md) | Implementado |
| HU-12 | [User Profiles & Preferences 2.0](./features/hu-12-user-profiles-2.0/README.md) | F0–F5 implementadas |
| HU-13 | [BullMQ Job Queue System](./features/hu-13-bullmq-job-queue.md) | F1–F2 implementadas (F3–F4 planificadas) |

Herramienta de desarrollo: [Laboratorio frontend F4/F5](./features/hu-12-user-profiles-2.0/frontend-lab.md).

## Cross-cutting

| Documento | Alcance | Estado |
|-----------|---------|--------|
| [Exportar catálogo (CSV)](./cross-cutting/csv-export.md) | Catálogo | Implementado |
| [Pool de conexiones MySQL](./cross-cutting/db-connection-pool.md) | Infra DB | Implementado |
| [Aislamiento del rate limiter en tests](./cross-cutting/rate-limiter-test-isolation.md) | Tests | Implementado |
| [Fallos de test pre-existentes](./cross-cutting/pre-existing-test-failures.md) | Tests | Implementado |
| [Omitir CI en develop para docs](./cross-cutting/skip-ci-develop.md) | Tests / CI | Guia |

## Fixes

| Documento | Estado |
|-----------|--------|
| [Registro atómico (`users` + `email_verifications`)](./fixes/register-atomicity.md) | Implementado en F2 de HU-13 |
| [Correcciones de la infraestructura BullMQ (F1)](./fixes/bullmq-f1-corrections.md) | Implementado |
| [Fail-open del rate limiter con Redis caído](./fixes/rate-limiter-fail-open.md) | Implementado |

## Propuestas

| Documento | Fecha |
|-----------|-------|
| [Propuestas para el Domain Model](./proposals/2026-07-29-domain-model.md) | 2026-07-29 |
| [Dislikes de F2 y labels de feedback F4](./proposals/2026-10-22-f2-dislikes-y-labels-feedback.md) | 2026-10-22 |
| [Otros casos de uso para BullMQ](./proposals/2026-10-24-bullmq-use-cases.md) | 2026-10-24 |

## Convenciones

- Un documento por feature, fix o propuesta; nombre en `kebab-case`.
- Las features se agrupan por HU/epic cuando la HU tiene varias fases.
- Usar [`_template-feature.md`](./_template-feature.md) como base.
- Enlazar el código y los tests relevantes dentro de cada documento.
- Mantener el estado real en este índice y en el README del epic.
