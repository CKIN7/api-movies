# Dislikes de F2 y labels de feedback F4

> **Tipo:** Propuesta · **Estado:** Pendiente de evaluación · **Fecha:** 2026-10-22

## Contexto

F2 ya persiste preferencias negativas declaradas:

- `dislikedGenres`
- `dislikedDirectors`
- `dislikedActors`

Pero `public/preferences.html` solo expone favoritos. Además, el feedback F4 usa el label
“Ocultar” para la acción `hide`, que no excluye la película: solo baja la afinidad de sus
géneros en `-0.5`. La única exclusión real es `not_interested`, con `-1.5` y filtrado en
`hybrid`, `content` y `collab`.

## Problema

1. No hay forma visual de cargar los dislikes de F2, aunque el backend ya los acepta.
2. “Ocultar” promete una desaparición que `hide` no produce.
3. “No me interesa” (`not_interested`) y un futuro “dislike” de F2 podrían confundirse
   si se usan labels parecidos.

## Opciones

### Opción A (recomendada): solo frontend

- Agregar una sección “Géneros/directores/actores a evitar” en `preferences.html`.
- Enviar los campos existentes con `PUT /users/me/preferences`.
- Renombrar las acciones de feedback:
  - `hide`: “Menos como esta”.
  - `not_interested`: “No recomendar”.
  - Opcional: `view`: “Ya la vi”.
- No cambia el contrato del backend ni los pesos actuales.

Ventajas:

- Aprovecha campos ya implementados.
- Corrige la expectativa de `hide` sin tocar el motor.
- Mantiene separados “preferencia declarada” (F2) y “feedback por película” (F4).

### Opción B (diferida): cambiar la semántica de `hide`

- Hacer que `hide` excluya la película, además de bajar afinidad.
- Requiere modificar `getExcludedMovieIds`, tests de F4, documentación y posiblemente
  la invalidación de cache.

Riesgo: cambia el contrato actual y mezcla una señal suave con una exclusión dura.
No se recomienda sin una decisión explícita de producto.

## Recomendación

Implementar la Opción A primero. Si el producto necesita que “ocultar” elimine de verdad,
evaluar la Opción B en una propuesta separada.

## Criterios de aceptación de la Opción A

- [ ] CA-1: la página permite elegir géneros, directores y actores a evitar.
- [ ] CA-2: al guardar, se envían `dislikedGenres`, `dislikedDirectors` y
      `dislikedActors` sin borrar los favoritos existentes.
- [ ] CA-3: el feedback `hide` se muestra como “Menos como esta”.
- [ ] CA-4: `not_interested` se muestra como “No recomendar”.
- [ ] CA-5: los textos no prometen exclusión para `hide`.
- [ ] CA-6: no hay cambios de backend, migraciones ni tests de API.

## Fuera de alcance

- Cambiar el motor de recomendaciones o sus pesos.
- Hacer que `hide` excluya.
- Exponer `contentFilters` en la UI.
- Rediseñar la página de preferencias.

## Implementación si se acepta

```text
public/preferences.html
public/preferences.js
```

Referencias actuales:

- Pesos de dislikes: `services/recommendationService.ts:139`.
- Deltas de feedback: `services/recommendationFeedbackService.ts:9`.
- Exclusión real: `repositories/RecommendationFeedbackRepository.ts:25`.
- Schema de preferencias: `schemas/userPreferences.ts`.

## Limitaciones

- Los dislikes de F2 reducen el score de preferencia, pero no garantizan que una
  película desaparezca si `content` o `collab` la siguen recomendando.
- La propuesta no está comprometida para ninguna HU ni release.
