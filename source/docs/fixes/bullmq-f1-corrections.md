# Fix: Correcciones de la infraestructura BullMQ (F1)

> **Tipo:** Fix · **Alcance:** Infra · **Estado:** Implementado · **Revisión:** 2026-10-28

Como desarrollador de la API,
quiero que la infraestructura de colas de F1 tenga un contrato de prioridades correcto, un script
de tests utilizable y el soporte de build necesario para los templates de F2,
para no arrastrar errores silenciosos hacia las fases siguientes.

---

## Contexto y problema

F1 (`feature/bullmq-infra`) quedó integrada en `develop`. Al revisar el resultado contra el
contrato de [`hu-13-bullmq-job-queue.md`](../features/hu-13-bullmq-job-queue.md) aparecieron
cinco defectos reales y una decisión de producto que sigue abierta:

| # | Defecto | Impacto |
|---|---------|---------|
| 1 | `npm run test:queues` usaba `--testPathPattern`, opción que **ya no existe** en Jest 30 | El script fallaba con error de opción: no se podían correr los tests de colas |
| 2 | Las prioridades de `config/bullmq.ts` estaban **invertidas** | El correo `critical` se habría procesado **después** del `marketing` |
| 3 | `tsconfig.json` sin `jsx` y sin incluir `.tsx` | Los templates de React Email de F2 no compilaban |
| 4 | Los índices de documentación decían "F1 en curso" | Estado real incorrecto en `docs/README.md` y `docs/features/README.md` |
| 5 | El doc declaraba `bull-board ^6.x` | Lo instalado es `@bull-board/* ^9.10.5`: tres paquetes, no uno |
| 6 | F2 CA-1 (`202`) vs. fix de registro atómico | Decisión de producto pendiente, sin código afectado todavía |

El defecto 2 era el más silencioso: no rompía nada hasta que existiera un worker real
consumiendo las colas de email (F2).

---

## Alcance

* `source/package.json` — script `test:queues` con el flag vigente de Jest 30 y un patrón que
  sí matchea los dos archivos de test de colas.
* `source/config/bullmq.ts` — prioridades corregidas al sentido real de BullMQ, con el criterio
  documentado en el archivo para que no vuelva a invertirse.
* `source/__tests__/unit/queueFactory.test.ts` — cobertura del orden de prioridad.
* `source/tsconfig.json` — `jsx: react-jsx` y `include` con `*.tsx`.
* `source/package.json` + `source/package-lock.json` — `react`, `react-dom`, `@types/react` y
  `@types/react-dom`, para que el soporte `.tsx` compile de verdad.
* `source/docs/features/hu-13-bullmq-job-queue.md` — prioridades, dependencias, comandos de
  verificación, criterios de F1 marcados y decisión pendiente de F2.
* `source/docs/README.md`, `source/docs/features/README.md` — estado real de F1.

### No alcance

* No se implementa la fase F2 (colas de email, Resend, templates).
* No se implementa el fix de registro atómico: su spec sigue en
  [`register-atomicity.md`](./register-atomicity.md) y el solapamiento con F2 se documentó como
  decisión abierta.
* No se cambia el contrato HTTP de ningún endpoint.
* No se toca la estrategia de reintentos ni el apagado graceful, que ya estaban correctos.

---

## Criterios de aceptación

* **CA-01 — `test:queues` ejecutable.** `npm run test:queues` corre los tests de colas y
  termina en verde, con Jest 30.
* **CA-02 — Prioridades coherentes.** Todas las colas tienen prioridad explícita `> 0`, y el
  orden por urgencia es `critical` → `transactional` → `marketing`,
  `fanout` → `inapp`, `recompute-user` → `recompute-all`.
* **CA-03 — Cobertura del orden.** El test unitario falla si alguien invierte una prioridad.
* **CA-04 — `.tsx` compilable.** Un componente `.tsx` en el árbol de `source/` pasa
  `tsc --noEmit` sin errores.
* **CA-05 — Documentación al día.** Los dos índices reflejan "F1 implementada" y el doc de
  HU-13 describe las prioridades, las dependencias y los comandos reales.
* **CA-06 — Sin regresiones.** `npm run build` y `npm test` en verde.

---

## Casos

### Happy path

| # | Escenario | Comportamiento |
|---|-----------|----------------|
| H1 | `npm run test:queues` | Ejecuta `queueFactory.test.ts` y `bullmq.integration.test.ts` |
| H2 | Un job en `email-critical` y otro en `email-marketing` | El crítico se procesa primero |
| H3 | Un componente React Email en `.tsx` | Compila con `tsc --noEmit` |
| H4 | Un `.tsx` que usa JSX sin `import React` | Compila (`jsx: react-jsx` usa el runtime automático) |

### Boundary / Corner / Edge Cases

| # | Caso | Resultado esperado |
|---|------|--------------------|
| B1 | Job encolado sin `priority` explícita | Hereda la prioridad de la cola |
| C1 | Job con `priority: 0` | Significa "sin prioridad explícita": se procesa antes que los priorizados de la cola |
| C2 | `priority` negativo o mayor que `2^21 - 1` | BullMQ lo rechaza; el proyecto solo usa `1`, `3`, `5` y `10` |
| E1 | `npm test -- --testPathPatterns=emailQueue` (F2) | El flag acepta varios valores separados por espacios y también repetido |

---

## Notas de implementación

1. **El flag de Jest cambió de nombre.** En Jest 30, `--testPathPattern` se renombró a
   `--testPathPatterns` y dejó de ser aceptable: el script fallaba con
   `Option "testPathPattern" was replaced by "--testPathPatterns"`. El valor es una regex contra
   la ruta completa del test.

2. **El patrón anterior tampoco matcheaba nada.** `queues` no aparece en ninguna ruta: los
   archivos son `__tests__/unit/queueFactory.test.ts` y
   `__tests__/integration/bullmq.integration.test.ts`. Por eso el script ahora repite el flag:

   ```json
   "test:queues": "jest --testPathPatterns=bullmq --testPathPatterns=queue"
   ```

   Se prefirió repetir flags a escribir `bullmq|queue`: en Windows el script corre bajo `cmd.exe`,
   donde un `|` sin comillas se interpreta como pipe y rompe la invocación.

3. **Sentido real de la prioridad en BullMQ.** El propio `bullmq` lo documenta en
   `Job#priority`:

   > Ranges from 0 to 2 097 151. `0` means no explicit priority, and jobs with no explicit
   > priority are processed before prioritized jobs. For prioritized jobs, **lower numbers are
   > processed before higher numbers**.

   Los valores originales (`critical: 10`, `marketing: 1`) dejaban el correo de marketing por
   delante del de verificación. La tabla de contrato de HU-13 ya describía el orden correcto
   (`critical` > `transactional` > `marketing`): lo que estaba mal eran los números.

   Valores finales:

   | Cola | Antes | Ahora |
   |------|-------|-------|
   | `email-critical` | 10 | **1** |
   | `email-transactional` | 5 | **5** |
   | `email-marketing` | 1 | **10** |
   | `notification-fanout` | 5 | **1** |
   | `notification-inapp` | 3 | **3** |
   | `recs-recompute-user` | 5 | **1** |
   | `recs-recompute-all` | 1 | **10** |

   Ninguna cola usa `0`: ese valor significa "sin prioridad explícita" y esos jobs se procesan
   antes que cualquier priorizado de la cola.

4. **El test que protege el orden.** `queueFactory.test.ts` verifica que toda prioridad sea
   `> 0`, que el orden relativo sea el esperado en los tres pares y que `createQueue` propague
   la prioridad a `defaultJobOptions`.

5. **Soporte `.tsx`.** `tsconfig.json` gana `"jsx": "react-jsx"` y `include` pasa a
   `["./**/*.ts", "./**/*.tsx"]`. `react-jsx` usa el runtime automático: los componentes no
   necesitan `import React`.

6. **React como dependencia.** `@react-email/components` declara `react` como peer dependency
   (`^18 || ^19`), así que sin `react` instalado el `.tsx` no resuelve `react/jsx-runtime` y
   `tsc` falla. Se instalaron `react@^19.3.1`, `react-dom@^19.3.1`, `@types/react@^19.3.0` y
   `@types/react-dom@^19.3.0` (par atómico `package.json` + `package-lock.json`).

7. **Bull Board 9.** No existe un paquete `bull-board` unificado en la v9: se instalan
   `@bull-board/api`, `@bull-board/express` y `@bull-board/ui`. El adapter se importa como
   `BullMQAdapter` desde `@bull-board/api/bullMQAdapter` y el router desde
   `@bull-board/express`. El doc de HU-13 declaraba `bull-board ^6.x`.

8. **Decisión de producto pendiente (F2).** El CA-1 de F2 pide `POST /auth/register` → `202` con
   el email encolado, mientras que el fix de registro atómico mantiene el `201` con el notificador
   fuera de la transacción y su fallo no fatal. Se documentaron dos opciones (A: encolar
   best-effort y aplicar el atomicidad aparte; B: F2 absorbe el fix) en la sección "Decisión
   pendiente para F2" del doc de HU-13. **No se implementó ninguna**: es una decisión de
   producto.

---

## Archivos (creados ✧ / modificados ✎)

```text
source/
├── package.json                              ✎ script test:queues + react/react-dom
├── package-lock.json                         ✎ pair atómico con package.json
├── tsconfig.json                             ✎ jsx: react-jsx + include *.tsx
├── config/
│   └── bullmq.ts                             ✎ prioridades corregidas + criterio documentado
├── __tests__/unit/
│   └── queueFactory.test.ts                  ✎ cobertura del orden de prioridad
└── docs/
    ├── README.md                             ✎ estado de HU-13 + índice de fixes
    ├── features/
    │   ├── README.md                         ✎ estado de HU-13
    │   └── hu-13-bullmq-job-queue.md         ✎ prioridades, deps, verificación, decisión F2
    └── fixes/
        └── bullmq-f1-corrections.md          ✧ este documento
```

---

## Verificación

```powershell
cd source
npm run build          # sin errores
npm run typecheck      # sin errores
npm run test:queues    # 9 unit (queueFactory) + 7 integración (bullmq)
npm test               # suite completa
```

Resultado en la rama `fix/bullmq-f1-corrections`:

| Comando | Resultado |
|---------|-----------|
| `npm run build` | Sin errores |
| `npm run typecheck` | Sin errores |
| `npm run test:queues` | **2 suites / 16 tests** en verde (9 unit + 7 integración, 18.9 s) |
| `npm test` | **84 suites / 842 tests** en verde (162.9 s) |

La suite completa pasó de 837 a 842 tests: los 5 nuevos son los de orden de prioridad.

El soporte `.tsx` se comprobó con un componente de prueba temporal en `source/services/`,
validado con `tsc --noEmit` (sin errores) y eliminado después.

---

## Limitaciones / deuda

* **Bull Board sin protección en producción.** `/admin/queues` se monta siempre. El doc de
  HU-13 dice "solo en desarrollo", pero el código no lo restringe por entorno: queda pendiente
  para F2 o para un hotfix.
* **La suite de integración depende de Redis real.** Sin `REDIS_URL_TEST` ni Docker, la suite de
  BullMQ se salta (`describe.skip`) en vez de fallar.
* **`workers/index.ts` sigue con el `TestWorker` de prueba.** El worker real de email llega con
  F2.
* **Las prioridades no tienen prueba de integración.** El orden se cubre a nivel de
  configuración; un test end-to-end con dos colas reales quedaría para F2, cuando exista un
  worker consumiendo.
* **La decisión de producto de F2 sigue abierta** (ver punto 8).
