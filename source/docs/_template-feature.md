# <Título de la feature>

> **Tipo:** Feature · **HU:** HU-XX · **Estado:** Propuesta | En progreso | Implementado · **Revisión:** YYYY-MM-DD

## Contexto

Problema u objetivo y por qué es necesario.

## Alcance

Qué incluye y qué queda fuera.

## Contrato

Endpoints, payloads, respuestas y códigos de estado.

## Criterios de aceptación

- [ ] CA-1: …
- [ ] CA-2: …

## Casos

### Happy path

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| … | … | … |

## Implementación

Archivos relevantes (código y tests), decisiones y dependencias.

```text
ruta/al/archivo.ts
```

## Frontend, demo y laboratorio

Seguir la [guía de demo y laboratorio](./cross-cutting/frontend-lab-guideline.md). Si no aplica, indicar el motivo.

- Página: `public/<feature>.html` (+ `.js`).
- Modo demo (`?demo=1`): datos en memoria, sin backend.
- Modo laboratorio (`?lab=1`): acciones reales, contratos, casos borde y log.
- Mapa de convergencia embebido: capas y nodos que toca la fase.
- Guion E2E: pasos numerados con resultado esperado, coincidentes con el mapa.
- Escenarios QA: …
- Enlace en el menú: …
- Decisión sobre `?lab=1` en producción: …
- Deuda: …

## Verificación

Comandos ejecutados y resultado.

## Limitaciones / deuda

Pendientes conocidos y próximos pasos.
