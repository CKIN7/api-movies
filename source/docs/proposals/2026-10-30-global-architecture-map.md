# Propuesta: mapa global de arquitectura con overlay por feature

> **Tipo:** Propuesta · **Estado:** Propuesta (no implementada) · **Fecha:** 2026-10-30

## Contexto

Hoy cada laboratorio frontend dibuja su propio mapa de convergencia dentro de su HTML:

- `public/preferences.html` muestra el flujo de preferencias, onboarding y feedback.
- `public/notifications.html` muestra `review.published → fan-out → in-app/email`.

La [guía de demo y laboratorio](../cross-cutting/frontend-lab-guideline.md) fija el mapa embebido como decisión vigente para no frenar el cierre de features. Esta propuesta documenta la evolución natural: un catálogo único de arquitectura y una vista por feature que lo reutiliza.

## Problema

- La topología (navegador, API, MySQL, Redis, workers, servicios externos) se repite en cada página.
- Un cambio de arquitectura obliga a editar N HTML y N JS.
- Las páginas se desincronizan: una muestra un worker que ya no existe y otra no muestra una cola nueva.
- No hay una vista completa para onboarding ni para explicar el sistema fuera de una fase.

## Propuesta

Separar dos responsabilidades:

| Pieza | Dónde vive | Cambia cuando |
|-------|------------|---------------|
| Topología: nodos, capas, aristas, fase a la que pertenecen | Catálogo global | Cambia la arquitectura |
| Recorrido E2E: pasos, acciones, resultados esperados | Config de la feature | Cambia el flujo de la fase |

La feature sigue siendo dueña de su guion E2E. El catálogo solo aporta el dibujo y el estado de los nodos.

## Diseño

```text
public/lab/
  architecture-map.js    # nodos, aristas, capas, fases
  map-renderer.js        # render, estados, animación, fallback textual
public/architecture.html  # vista completa (opcional, fase 3)
public/notifications.html # <div data-map="hu13-f3"></div>
public/preferences.html   # <div data-map="hu12-f4-f5"></div>
```

Sin dependencias nuevas, sin build y sin llamadas de red: los módulos se sirven desde `public/` con `express.static`.

### Modelo de datos

```js
export const nodes = [
  { id: 'browser',    layer: 'client',  label: 'Navegador',        phases: ['hu13-f3', 'hu12-f4-f5'] },
  { id: 'api',        layer: 'api',     label: 'API Express',      phases: ['*'] },
  { id: 'mysql',      layer: 'data',    label: 'MySQL',            phases: ['*'] },
  { id: 'redis',      layer: 'async',   label: 'Redis · BullMQ',   phases: ['hu13-f3'] },
  { id: 'fanout',     layer: 'worker',  label: 'notification-fanout', phases: ['hu13-f3'] },
  { id: 'inapp',      layer: 'worker',  label: 'notification-inapp',  phases: ['hu13-f3'] },
  { id: 'email',      layer: 'externo', label: 'Resend',           phases: ['hu13-f3'] },
  { id: 'meili',      layer: 'externo', label: 'Meilisearch',      phases: ['hu12-f4-f5'] },
];

export const edges = [
  { from: 'browser', to: 'api',  step: 1, label: 'HTTP' },
  { from: 'api',     to: 'mysql', step: 2, label: 'SQL' },
  { from: 'api',     to: 'redis', step: 3, label: 'encola' },
  { from: 'redis',   to: 'fanout', step: 4, label: 'consume' },
  { from: 'fanout',  to: 'inapp', step: 5, label: 'encola' },
  { from: 'fanout',  to: 'email', step: 6, label: 'opcional' },
];
```

### API del renderer

```js
renderMap({
  mount: document.querySelector('[data-map="hu13-f3"]'),
  feature: 'hu13-f3',
  steps: [
    { n: 1, from: 'browser', to: 'api', action: 'POST /movies/1/reviews', expect: '201' },
    { n: 2, from: 'api', to: 'mysql', expect: 'review persistida' },
    { n: 3, from: 'api', to: 'redis', expect: 'job encolado' },
    { n: 4, from: 'redis', to: 'fanout', expect: 'job consumido' },
    { n: 5, from: 'fanout', to: 'inapp', expect: 'notificación insertada' },
  ],
});
```

El renderer:

- Filtra nodos por `feature` y atenúa el resto.
- Pinta estados: `idle`, `active`, `ok`, `off`, `waiting`, `error`.
- Numera los pasos sobre las aristas.
- Expone `setNodeStatus(id, status)` y `reset()` para que el JS de la feature lo controle.
- Genera una lista textual equivalente para accesibilidad y para el log.
- No conoce endpoints ni hace `fetch`: todo lo maneja la feature.

### Vista global

`public/architecture.html` usa el mismo catálogo sin filtro de fase y permite `?feature=hu13-f3` para resaltar una. Es útil para onboarding, no obligatoria para el cierre de una feature.

## Migración incremental

1. Crear `public/lab/architecture-map.js` solo con los nodos de F3 más los ancla (`browser`, `api`, `mysql`).
2. Crear `map-renderer.js` y reemplazar la sección 1 de `notifications.html` por el mapa embebido.
3. Validar que `?demo=1` siga funcionando sin red.
4. Repetir con `preferences.html` (F4/F5), agregando sus nodos al catálogo.
5. Recién entonces crear `architecture.html` como vista completa.
6. Opcional: un test de Node que verifique que todos los `id` referenciados por una feature existen en el catálogo.

## Criterios de aceptación

- [ ] CA-1: el catálogo es la única fuente de nodos y aristas.
- [ ] CA-2: una feature declara solo su subconjunto y sus pasos E2E.
- [ ] CA-3: el mapa embebido funciona sin red y sin build.
- [ ] CA-4: los estados se actualizan desde el JS de la feature.
- [ ] CA-5: el mapa tiene fallback textual.
- [ ] CA-6: agregar una feature no requiere tocar el renderer.
- [ ] CA-7: la vista global reutiliza el mismo catálogo y renderer.
- [ ] CA-8: no se exponen secretos, hosts ni datos de usuarios.

## Riesgos

| Riesgo | Mitigación |
|--------|------------|
| El catálogo se vuelve un inventario enorme y desactualizado | Solo se agregan nodos que alguna feature ejercita |
| El overlay generaliza de más y no sirve para probar | Los pasos E2E siguen en la feature |
| Acoplamiento entre labs y un módulo compartido | El renderer no conoce la API; recibe todo por parámetro |
| El modo demo depende de cargar el módulo por red | Se sirve local desde `public/`; no hay CDN ni fetch |
| Cambios de arquitectura rompen features viejas | Un test valida ids referenciados y el catálogo se versiona |

## Fuera de alcance

- Generar el mapa desde el código o desde OpenAPI.
- Medir latencias reales por nodo.
- Reemplazar Bull Board o las métricas.
- Convertir el laboratorio en una herramienta de administración.

## Alternativas consideradas

1. **Mantener el mapa embebido para siempre**: simple, pero multiplica mantenimiento.
2. **Solo un diagrama en la documentación**: no es interactivo ni refleja el estado de una corrida.
3. **Herramienta externa (Mermaid, draw.io)**: agrega dependencia o trabajo manual y no se integra con el log.

## Decisión pendiente

Se implementa cuando exista una tercera feature con laboratorio o cuando el costo de actualizar los mapas embebidos supere el de extraer el catálogo. Hasta entonces, la decisión vigente es el mapa embebido por feature.
