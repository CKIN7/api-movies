# Demo y laboratorio frontend por feature

> **Tipo:** Guía · **Alcance:** Frontend / QA · **Estado:** Guía · **Revisión:** 2026-10-30

## Contexto

Las features de este proyecto se cierran con tests, contrato documentado y, desde HU-12, con páginas estáticas en `public/` para probarlas visualmente. Ese patrón funcionó bien en F4/F5 y en F3, pero quedó como iniciativa de cada fase: no hay un criterio común sobre qué debe incluir el laboratorio, cómo se relaciona con la API completa ni qué le aporta a QA.

Esta guía fija ese criterio: al cerrar una feature con flujo observable, el entregable incluye una página con **modo demo**, **modo laboratorio** y un **mapa de convergencia** que muestre cómo los componentes de la fase se conectan con el resto de la API.

No reemplaza los tests automatizados ni el contrato de la feature. Es una herramienta de demostración, verificación manual y soporte a QA.

## Objetivo

- Que cualquier persona del equipo pueda **ver** la feature funcionando sin preparar MySQL, Redis, Meilisearch ni credenciales.
- Que QA pueda **ejecutar** escenarios, incluidos los negativos, sin depender de Postman ni de conocimiento interno.
- Que el mapa de la fase explique **dónde encaja** en la arquitectura: navegador, API, base de datos, colas, workers y servicios externos.
- Que la evidencia de una prueba quede **adjuntable** a un ticket: request, status, latencia y respuesta.

## Cuándo aplica

Aplica cuando la feature:

- Expone endpoints que se pueden ejercitar desde el navegador.
- Tiene un flujo asincrónico (colas, workers, emails, recomendaciones).
- Tiene estados visibles (lista, badge, onboarding, preferencias, notificaciones).
- Necesita demostrarse a alguien fuera del equipo técnico.

No aplica cuando:

- El cambio es interno y no tiene efecto observable (refactor, migración sin UI).
- El laboratorio se limitaría a simular algo que todavía no existe.
- La feature solo se valida con propiedades o unit tests y no tiene flujo de usuario.

En esos casos, el documento de la feature debe declarar “No aplica” y el motivo.

## Modos

| Modo | Activación | Backend | Datos | Para quién |
|------|------------|---------|-------|------------|
| Producto | sin parámetros | Real | Reales | Usuario final |
| Laboratorio | `?lab=1` | Real | Reales + acciones de prueba | Dev / QA |
| Demo | `?demo=1` | Ninguno | Mock en memoria, determinista | Demos, UX, onboarding |

Reglas:

- El modo demo **no debe llamar a la API**, ni a Redis, ni a MySQL.
- El modo demo debe partir del mismo estado en cada carga (seed fijo, sin aleatoriedad).
- El modo laboratorio debe marcar visualmente que es un laboratorio (banner, chip o borde).
- `?lab=1` y `?demo=1` son convenciones de UI, **no** mecanismos de seguridad. La autorización sigue en `requireAuth` y en el `user_id` del token.

## Secciones mínimas de la página

1. **Flujo de la fase**: qué evento dispara qué, en 3–6 nodos.
2. **Estado real**: la vista que consume el usuario (lista, badge, formulario, tarjetas).
3. **Acciones**: crear, ejecutar, reintentar, limpiar; con estado de carga y error.
4. **Contratos**: tabla de endpoints con botón “Probar” y respuesta visible.
5. **Casos borde**: botones para `400`, `404`, idempotencia, permisos y límites.
6. **Mapa de convergencia**: cómo se conecta la fase con la API completa (ver abajo).
7. **Guion E2E**: pasos numerados con resultado esperado y ejecución manual.
8. **Qué se construyó**: sub-fases, archivos y criterios de aceptación.
9. **Log de peticiones**: método, ruta, status, latencia, cuerpo y opción de copiar.

La página puede agrupar secciones o esconderlas con `?lab=1`, pero las secciones 1, 2, 4 y 9 son el mínimo para que sea útil.

## Mapa de convergencia embebido

Decisión vigente (2026-10-30): el mapa se dibuja **dentro del HTML de la feature**. La versión global compartida queda como propuesta futura en [`docs/proposals/2026-10-30-global-architecture-map.md`](../proposals/2026-10-30-global-architecture-map.md).

El mapa debe mostrar, como mínimo, estas capas:

```text
┌──────────────── NAVEGADOR ────────────────┐
│ página de la feature                      │
│ Auth · polling · simulador                │
└──────────────────┬────────────────────────┘
                   │ ① HTTP
┌──────────────────▼────────────────────────┐
│ API Express                               │
│ middleware → controller → service         │
│            → repository                   │
└────────┬──────────────────────────┬───────┘
         │ ② SQL                    │ ③ encolado
┌────────▼────────┐        ┌────────▼──────────────┐
│ MySQL           │        │ Redis · BullMQ        │
│ tablas de la    │        │ colas de la fase      │
│ fase            │        └────────┬──────────────┘
└─────────────────┘                 │ ④ consumo
                           ┌────────▼──────────────┐
                           │ workers de la fase    │
                           └────────┬──────────────┘
                                    │ ⑤ efecto
                           ┌────────▼──────────────┐
                           │ servicio externo      │
                           │ (email, búsqueda…)    │
                           └───────────────────────┘
```

Requisitos:

- Nodos con `data-phase` y `data-status` para que el estado sea programable.
- Estados visuales: **verde** (participó), **azul** (disponible, no usado), **gris** (fuera de la fase), **ámbar** (encolado o esperando worker), **rojo** (falló).
- Al ejecutar una acción, se resalta el camino real recorrido y se numeran los pasos.
- Si el flujo es asincrónico y el efecto no aparece en un tiempo razonable, el nodo del worker queda en ámbar con el aviso “posible worker apagado”. Es un caso real y frecuente: la API responde `201` y la notificación no aparece porque nadie consume la cola.
- El email o cualquier canal opcional se muestra apagado cuando la preferencia está en `false`.
- El mapa debe tener un equivalente textual (lista de pasos) para accesibilidad y para el log.

El mapa **no** debe incluir hosts, credenciales, nombres de variables de entorno ni datos de usuarios. Solo componentes y relaciones.

## Guion E2E

El guion E2E del laboratorio es manual y visual; complementa a Jest + Supertest, no los reemplaza.

Cada paso debe tener:

| Campo | Ejemplo |
|-------|---------|
| Número | `③` |
| Origen → destino | `API → Redis` |
| Acción | `POST /movies/1/reviews` |
| Resultado esperado | `201` + `isNew=true` + job `review-published-42` |
| Resultado observado | Status, body y latencia del log |
| Estado | Pendiente / OK / Falló |

Los pasos numerados del mapa deben coincidir con los del guion del documento de la feature. Si el mapa cambia, el guion cambia en el mismo commit.

## Qué le ofrece a QA

| Necesidad de QA | Qué aporta el laboratorio |
|-----------------|---------------------------|
| Reproducir un bug | Log con método, ruta, status, latencia y body; botón para copiar JSON |
| Validar contrato | Botón “Probar” por endpoint con respuesta real |
| Probar negativos | Acciones para `404`, `400`, límites, idempotencia y permisos |
| Verificar asincronía | Estado del job y aviso de worker apagado |
| Evidencia para el ticket | Log exportable y captura del mapa con el camino recorrido |
| Probar sin entorno completo | `?demo=1` para humo visual; `?lab=1` para integración |
| Saber qué probar | Guion E2E con resultado esperado por paso |
| Regresión manual | Checklist de criterios de aceptación ejecutable |
| Onboarding | Recorrido guiado con `?step=N` |

Lo que QA **no** obtiene: ejecución automática en CI, creación de usuarios, reset de base ni datos de otros usuarios.

## Parámetros estándar

| Parámetro | Default | Efecto |
|-----------|---------|--------|
| `?lab=1` | apagado | Muestra el panel de laboratorio |
| `?demo=1` | apagado | Datos mock; implica laboratorio y no usa backend |
| `?autopoll=N` | según feature | Intervalo de polling en segundos; `0` lo desactiva |
| `?step=N` | — | Resalta y desplaza a un paso del guion |
| `?scenario=...` | — | Precarga un escenario de QA |

Los parámetros se documentan en el doc de la feature, no solo en el código.

## Datos, seguridad y producción

- El modo demo usa datos ficticios; nunca datos reales de usuarios.
- El laboratorio no debe permitir leer ni modificar recursos de otra cuenta.
- Las acciones destructivas (borrar, resetear) se limitan a datos propios y se advierten en la UI.
- No se muestran secretos, tokens, hashes ni cadenas de conexión.
- Si el laboratorio se publica en producción, debe decidirse explícitamente: oculto, solo lectura o deshabilitado. La guía no asume que `?lab=1` sea seguro.
- El rate limiting y los permisos siguen aplicando; el laboratorio no los evade.

## Checklist de cierre

Agregar al documento de la feature:

- [ ] Página en `public/` con HTML y JS, sin dependencias nuevas ni build.
- [ ] Modo demo determinista y sin red.
- [ ] Modo laboratorio autenticado y marcado visualmente.
- [ ] Secciones mínimas (flujo, estado, contratos, casos borde, log).
- [ ] Mapa de convergencia embebido con estados y camino animado.
- [ ] Guion E2E numerado y coincidente con el mapa.
- [ ] Al menos un caso negativo ejecutable por cada validación relevante.
- [ ] Log exportable o copiable.
- [ ] Enlace en el menú, si la página es de producto.
- [ ] Sección “Frontend, demo y laboratorio” en el doc de la feature.
- [ ] Decisión registrada sobre `?lab=1` en producción.
- [ ] Verificación manual anotada en el doc (qué se probó y con qué resultado).

## Referencias

- [Laboratorio frontend F4/F5](../features/hu-12-user-profiles-2.0/frontend-lab.md): primer laboratorio del proyecto.
- [Laboratorio frontend F3](../features/hu-13-f3-notifications-lab.md): demo, contratos, casos borde y log.
- [Plantilla de feature](../_template-feature.md): incluye la sección de cierre.
- [Propuesta: mapa global compartido](../proposals/2026-10-30-global-architecture-map.md).

## Deuda

- No hay tests de navegador; la verificación del laboratorio es manual.
- Cada página repite estilos y utilidades (toast, log, auth). La extracción a un kit compartido queda pendiente.
- El mapa embebido por feature duplica topología; la propuesta de mapa global busca eliminarlo.
- `?lab=1` no está protegido del lado del servidor.
