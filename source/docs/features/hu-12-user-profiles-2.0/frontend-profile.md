# Perfil de usuario frontend (F1)

> **Tipo:** Feature · **HU:** HU-12 · **Fase:** F1 · **Estado:** Implementado · **Revisión:** 2026-10-22

## Contexto

F1 ya estaba implementada en backend (`GET/PATCH /users/me/profile` y
`GET /users/:id/profile`), pero no existía una pantalla para editar el perfil ni
para ver un perfil público. Esta feature agrega esa capa visual reutilizando el
frontend vanilla existente.

## Alcance

Incluye:

- Página `/profile.html` para el perfil propio, con login requerido.
- Edición de `displayName`, `bio`, `avatarUrl`, `country`, `birthYear` e `isPublic`.
- Vista pública en `/profile.html?id=<uuid>`.
- Estadísticas del perfil público cuando `isPublic` es verdadero.
- Avatar por URL con preview y fallback a iniciales.
- Links a Perfil desde la landing y desde Preferencias.
- Link “Ver mi perfil público” cuando el perfil es público.

No incluye:

- Upload de imágenes: el backend solo acepta `avatarUrl`.
- Borrado de perfil: se limpian campos enviando `null`.
- Listado de reviews o watchlist en el perfil público.
- Tests E2E o framework de testing de navegador.
- Cambios de backend, migraciones o nuevos endpoints.

## Contrato

| Método | Ruta | Uso |
|--------|------|-----|
| `GET` | `/users/me/profile` | Carga del perfil propio |
| `PATCH` | `/users/me/profile` | Guardado parcial |
| `GET` | `/users/:id/profile` | Perfil público sin autenticación |

Reglas de la UI:

- `displayName` es opcional; si tiene valor debe tener entre 2 y 50 caracteres y
  no contener HTML. Vacío se envía como `null`.
- `bio` admite hasta 300 caracteres y no HTML. Vacío se envía como `null`
  (el backend guardaría `""` si se enviara cadena vacía).
- `avatarUrl` debe ser `http` o `https`, hasta 500 caracteres. Vacío se envía
  como `null`.
- `country` es un código ISO de 2 letras y se envía en mayúsculas.
- `birthYear` debe estar entre 1900 y el año actual menos 13.
- Solo se envían los campos modificados; si no hay cambios, no se hace `PATCH`.
- El perfil público nunca muestra email, `birthYear`, `createdAt` ni `updatedAt`.

Respuestas relevantes:

- Perfil propio sin fila: `200` con defaults y `isPublic: false`.
- Perfil público: `200` con `stats` si es público; tarjeta minimal si es privado.
- UUID inválido: `400`.
- Perfil inexistente: `404`.

## Criterios de aceptación

- [x] CA-1: sin sesión, `/profile.html` muestra el aviso de login.
- [x] CA-2: con sesión, se cargan los campos del perfil propio.
- [x] CA-3: guardar envía solo los campos modificados.
- [x] CA-4: vaciar un campo envía `null` y lo limpia.
- [x] CA-5: se validan nombre, bio, avatar, país y año de nacimiento.
- [x] CA-6: el avatar muestra preview y cae a iniciales si la URL falla.
- [x] CA-7: `/profile.html?id=<uuid>` muestra el perfil público y sus stats.
- [x] CA-8: un perfil privado muestra la tarjeta privada sin stats.
- [x] CA-9: el link “Ver mi perfil público” aparece solo si `isPublic` está activo.
- [x] CA-10: la navegación a Perfil existe desde la landing y Preferencias.

## Casos

### Happy path

1. Iniciar sesión.
2. Abrir `/profile.html`.
3. Completar nombre, bio, avatar, país y año.
4. Guardar y recargar: los valores persisten.
5. Activar “Perfil público” y abrir el link público.
6. Verificar nombre, bio, avatar, país y estadísticas.

### Boundary / corner / edge cases

| Caso | Entrada | Resultado esperado |
|------|---------|--------------------|
| Nombre de 1 carácter | `A` | Error de validación |
| Nombre de 51 caracteres | 51 chars | Error de validación |
| Bio de 301 caracteres | 301 chars | Error de validación |
| HTML en nombre o bio | `<b>Ana</b>` | Error de validación |
| Avatar `ftp://` | URL no HTTP | Error de validación |
| País inválido | `XXX` | Error de validación |
| Año fuera de rango | `1899` | Error de validación |
| Campo vacío | `""` | Se envía `null` y se limpia |
| Sin cambios | Guardar sin editar | No se hace `PATCH` |
| Perfil privado | `?id=<uuid>` | Tarjeta privada, sin stats |
| UUID inválido | `?id=no-es-uuid` | Mensaje de identificador inválido |
| UUID inexistente | UUID válido no registrado | “Perfil no encontrado” |
| Avatar roto | URL 404 | Se muestran las iniciales |
| Sesión expirada | Token vencido sin refresh | Vuelve al estado de login |

## Implementación

```text
public/profile.html
public/profile.js
public/index.html
public/preferences.html
```

Decisiones:

- Se reutiliza `Auth` y `auth.fetchWithAuth`; no se modifica `auth.js`.
- El header y los modales de login se replican con los mismos IDs que espera
  `auth.js`, siguiendo el patrón de `preferences.html`.
- `profile.html?id=<uuid>` funciona sin login; el modo se detecta por query string.
- Los datos del usuario se pintan con `textContent` para evitar XSS.
- El `PATCH` usa diff contra el estado cargado para no borrar campos por accidente.
- El link público usa `auth.user.id`, disponible en la respuesta de login.

## Verificación

Ejecutado desde `source/`:

```powershell
npm run typecheck
npm run build
npm test
```

Resultado: `typecheck` y `build` sin errores; `82` suites y `826` tests pasaron.

Smoke con la API y la BD de tests:

- `GET /profile.html` y `GET /profile.js`: `200`.
- Registro, verificación de email, login, `PATCH /users/me/profile` y `GET /users/me/profile`: OK.
- `GET /users/:id/profile` con perfil público: `200` con datos y stats.
- Perfil privado: `200` con tarjeta minimal.
- UUID inválido: `400`; UUID inexistente: `404`; sin auth: `401`; `PATCH {}`: `400`.

Smoke en Chrome headless:

```text
/profile.html?id=<uuid>   -> renderiza el perfil público
/profile.html?id=<uuid>   -> perfil privado muestra "Perfil privado"
/profile.html?id=bad-id   -> muestra error de identificador inválido
```

## Limitaciones / deuda

- No hay tests automatizados de frontend ni E2E.
- El avatar es solo una URL externa; no hay upload ni almacenamiento.
- No se puede eliminar el perfil; solo limpiar campos.
- La vista pública solo es accesible por URL directa o por el link del perfil;
  no hay todavía un listado de reviews desde el cual enlazar autores.
- El header y los modales de autenticación están duplicados entre páginas.
