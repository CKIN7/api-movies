# Configuración de usuario frontend (F3)

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F3 · **Estado:** Implementado · **Revisión:** 2026-10-22

## Contexto

F3 ya estaba implementada en backend con `GET/PATCH /users/me/settings`, pero no
existía una pantalla para editar idioma, tema, región, notificaciones, privacidad
ni modo sin spoilers. Esta feature agrega esa capa visual reutilizando el
frontend vanilla existente.

## Alcance

Incluye:

- Página `/settings.html` con login requerido.
- Edición de `language`, `theme`, `region`, `notifyEmail`, `notifyPush`,
  `privacyReviews`, `privacyWatchlist`, `privacyActivity` y `spoilerFree`.
- Guardado parcial con `PATCH`: solo envía los campos modificados.
- Región vacía se envía como `null` para borrarla.
- Vista previa del tema (`light`, `dark`, `system`) en la propia página.
- Badge de `onboardingCompleted` en modo solo lectura.
- Fecha de `updatedAt` cuando existe.
- Links a Configuración desde la landing, Preferencias y Perfil.

No incluye:

- Traducción de la interfaz según `language`.
- Aplicación global del tema en todas las páginas.
- Catálogo regional filtrado según `region`.
- Edición de `onboardingCompleted`: lo marca `POST /users/me/onboarding`.
- Tests E2E o framework de testing de navegador.
- Cambios de backend, migraciones o nuevos endpoints.

## Contrato

El frontend consume endpoints existentes:

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/users/me/settings` | Cargar configuración y defaults |
| `PATCH` | `/users/me/settings` | Guardar cambios parciales con upsert |

Campos editables y valores:

| Campo | Valores |
|-------|---------|
| `language` | `es`, `en`, `en-US`, `pt`, `pt-BR` |
| `theme` | `system`, `light`, `dark` |
| `region` | ISO-3166 alfa-2, normalizado a mayúsculas o `null` |
| `notifyEmail` | boolean |
| `notifyPush` | boolean |
| `privacyReviews` | `public`, `friends`, `private` |
| `privacyWatchlist` | `public`, `friends`, `private` |
| `privacyActivity` | `public`, `friends`, `private` |
| `spoilerFree` | boolean |

`onboardingCompleted` y `updatedAt` se muestran, pero no se envían en el `PATCH`.

## Criterios de aceptación

- [x] CA-1: sin sesión se muestra el aviso de login y no el formulario.
- [x] CA-2: `GET` sin fila muestra los defaults del backend.
- [x] CA-3: el guardado envía solo los campos modificados.
- [x] CA-4: una región vacía se envía como `null`.
- [x] CA-5: `onboardingCompleted` es visible y de solo lectura.
- [x] CA-6: el tema elegido se previsualiza en la página.
- [x] CA-7: `401`, `400` y `429` muestran un error legible.
- [x] CA-8: el botón Guardar permanece deshabilitado sin cambios.

## Casos

### Happy path

1. Iniciar sesión y abrir `/settings.html`.
2. Cambiar idioma, tema, notificaciones y privacidad.
3. Guardar y verificar que el botón se deshabilita.
4. Recargar y comprobar que los valores persisten.
5. Activar/desactivar `spoilerFree` y verificar el cambio.

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| Región inválida | `ESP` | Se recorta a `ES` en la UI; el backend valida igual |
| Región vacía | `""` | `region: null` |
| Body vacío | Guardar sin cambios | No se envía `PATCH` |
| Tema inválido | Valor fuera del select | Error de validación local |
| Sesión expirada | `401` en `GET`/`PATCH` | Se limpia auth y se pide login |
| Rate limit | Muchos guardados seguidos | `429` visible en toast y error |
| Onboarding completado | `true` | Badge “Completado”, sin edición |

## Implementación

```text
public/settings.html
public/settings.js
public/index.html
public/preferences.html
public/profile.html
```

Decisiones:

- El tema se aplica como vista previa solo en `/settings.html`; extrapolarlo al
  resto del frontend requiere una capa de tema compartida.
- `language` y `region` se persisten, pero todavía no cambian textos ni
  catálogo. Es deuda explícita de i18n/regionalización.
- Se usa `textContent` para mensajes dinámicos.
- El `PATCH` usa diff contra el estado cargado para no sobrescribir campos.
- El header y los modales de autenticación siguen el patrón duplicado del resto
  de páginas vanilla.

## Verificación

Ejecutado desde `source/`:

```powershell
npm run typecheck
npm run build
npm test
```

Resultado: `typecheck` y `build` sin errores; `82` suites y `826` tests pasaron.

Smoke con la API y la BD de tests:

- `GET /settings.html` y `GET /settings.js`: `200`.
- `GET /users/me/settings` sin fila: defaults.
- `PATCH /users/me/settings` parcial: persiste y normaliza `region`.
- `PATCH` posterior: conserva los campos no enviados.
- `onboardingCompleted` no se modifica desde settings.
- `PATCH {}`: `400`; sin token: `401`.

Smoke en Chrome headless:

```text
/settings.html   -> formulario con datos guardados y badge de onboarding
/settings.html   -> cambio de tema/región, guardado y toast de confirmación
/settings.html   -> el PATCH se refleja en un GET posterior de la API
```

## Limitaciones / deuda

- No hay tests automatizados de frontend ni E2E.
- El tema no se aplica fuera de la página de configuración.
- El idioma y la región no modifican la UI ni el catálogo.
- No se puede editar `onboardingCompleted` desde settings.
- El header y los modales de autenticación están duplicados entre páginas.
