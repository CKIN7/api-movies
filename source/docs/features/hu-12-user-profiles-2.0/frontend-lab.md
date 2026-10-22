# Laboratorio frontend F4/F5

> **Tipo:** Herramienta de desarrollo · **HU:** HU-12 · **Estado:** Implementado · **Revisión:** 2026-10-22

## Contexto

F4 (feedback de recomendaciones) y F5 (onboarding/cold-start) ya estaban implementadas en el backend, pero no había una forma visual de ejercitarlas. La página `public/preferences.html` ya concentraba autenticación, preferencias F2 y recomendaciones, así que se reutilizó en lugar de crear otra aplicación.

## Alcance

Incluye:

- Modo laboratorio activado con `?lab=1`.
- Onboarding F5 con selección de géneros y directores.
- Badge de estado de settings F3 (`onboardingCompleted`).
- Botones de feedback F4 en las tarjetas de recomendaciones, visibles solo en modo laboratorio.
- Checklist de escenarios y log de peticiones en modo laboratorio.
- Enlace “Preferencias” en el menú de usuario de la landing.

No incluye:

- Página de perfil F1 (se hará en otra feature).
- Edición completa de settings F3.
- Endpoints dev-only para crear o resetear usuarios.
- Tests automatizados de navegador.
- Protección de servidor para ocultar `?lab=1` en producción.

## Contrato

El frontend consume endpoints existentes:

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/users/me/settings` | Badge de onboarding |
| `POST` | `/users/me/onboarding` | Completar onboarding F5 |
| `GET` | `/users/me/preferences` | Preferencias y `genreAffinity` |
| `PUT` | `/users/me/preferences` | Guardar preferencias F2 |
| `GET` | `/users/me/recommendations?type=&limit=` | Recomendaciones |
| `POST` | `/users/me/recommendations/feedback` | Feedback F4 |
| `GET` | `/movies/genres?full=true` | Chips de géneros |

Respuestas relevantes:

- Onboarding: `{ onboardingCompleted, seeded, favoriteGenres, favoriteDirectors? }`.
- Feedback: `201` con `applied: true` en el primer registro y `200` con `applied: false` en duplicados.
- Recomendaciones: cada ítem incluye `movie.id`, `score` y `reason`.

## Criterios de aceptación

- [x] CA-1: sin `?lab=1` no se muestran botones de feedback ni el panel de laboratorio.
- [x] CA-2: con `?lab=1` se muestran feedback, checklist y log.
- [x] CA-3: el onboarding valida 1–10 géneros y muestra `seeded`.
- [x] CA-4: el badge refleja `onboardingCompleted`.
- [x] CA-5: el feedback muestra `applied: true/false` y refresca preferencias/recomendaciones.
- [x] CA-6: `not_interested` dispara la verificación de exclusión en `hybrid`, `content` y `collab`.
- [x] CA-7: `genreAffinity` acepta el formato `{ score, updatedAt }` y el formato numérico legado.

## Casos

### Happy path

1. Login con una cuenta existente.
2. Abrir `/preferences.html?lab=1`.
3. Elegir géneros y completar onboarding.
4. Verificar `seeded: true`, badge completado y afinidad +5.
5. Aplicar `like` a una recomendación y ver el incremento de afinidad.
6. Repetir el `like` y verificar `applied: false`.
7. Aplicar `not_interested` y verificar la exclusión en los tres tipos.

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| Onboarding sin géneros | `favoriteGenres: []` | `400` |
| Onboarding con más de 10 géneros | 11 géneros | `400` |
| Directores duplicados | `10,10,20` | Se deduplican antes de enviar |
| Feedback duplicado | Mismo `movieId` + `action` | `200`, `applied: false` |
| `not_interested` | Película marcada | Excluida en los tres tipos |
| Sin señales | Cuenta sin historial ni onboarding | Estado de cold start |
| Rate limit | Muchas acciones seguidas | `429` visible en el log y toast |

## Implementación

```text
public/preferences.html
public/preferences.js
public/index.html
```

Decisiones:

- `?lab=1` es una convención de UI, no un mecanismo de seguridad.
- El feedback no se muestra en modo normal para no mezclar controles de prueba con la UI de producto.
- El onboarding sí queda visible en modo normal cuando está pendiente.
- El usuario de prueba es una cuenta existente; no se modifican seed ni migraciones.
- El feedback es persistente y no se puede borrar desde la API: para reiniciar un escenario se usa otra cuenta o `npm run seed`.

## Verificación

Ejecutado desde `source/`:

```powershell
npm run typecheck
npm run build
npm test
```

Resultado: `typecheck` y `build` sin errores; `82` suites y `826` tests pasaron. La página se sirvió con `HTTP 200` desde Express.

Verificación manual pendiente de ejecutar con una cuenta real:

```text
/preferences.html
/preferences.html?lab=1
```

## Limitaciones / deuda

- No hay tests E2E; la verificación del DOM y de los flujos es manual.
- `?lab=1` puede abrirse en cualquier entorno; si debe ocultarse en producción, se necesita una guarda del servidor o quitar el modo del build.
- El feedback no se puede eliminar; la repetición de escenarios depende de cambiar de cuenta o resetear la base.
- La página de perfil F1 queda fuera de alcance.
