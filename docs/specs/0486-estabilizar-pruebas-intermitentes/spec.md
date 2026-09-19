---
sdd: "0486"
title: "Las pruebas intermitentes de la suite dejan de dar rojos falsos"
status: in-progress
author: "Claude Code (Worker) para Sam"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0479", "0357", "0469"]
confidencialidad: interno
---

# SDD-0486 — Las pruebas intermitentes de la suite dejan de dar rojos falsos

> Cuatro pruebas fallaban de forma intermitente en la suite completa local y
> pasaban aisladas y en el CI de GitHub. Cada una tenía su propia causa. Esta spec
> corrige cada causa sin subir topes ni debilitar aserciones.

## Contexto

- El 2026-09-18 el paso `test` de `pnpm verify` falló varias veces en esta máquina
  por pruebas ajenas al cambio que se verificaba. Pasó también con la máquina
  libre de suites ajenas. Aisladas, esas pruebas pasaban. Cada rojo falso costaba
  otra corrida de `verify` y confundía la revisión de PRs.
- **Pruebas afectadas:**
  - `app/p/[token]/PackingListProductsStep.test.tsx`;
  - `app/p/[token]/supplier-flow.test.tsx`;
  - `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`;
  - `scripts/__tests__/invoice-read-boundary.test.mjs`.
- **CI:** corre en `ubuntu-24.04`, con 4 vCPU. vitest 4 usa
  `availableParallelism() - 1` workers, o sea 3.
- **Esta máquina:** Intel Core Ultra 7 155H, con 6 núcleos P con hyperthreading,
  8 E y 2 LP-E, 22 hilos lógicos en total, y 31 GB de RAM. vitest levanta 21
  workers. El antivirus tiene la protección en tiempo real activa.

## Diagnóstico

Medido con perfiles de CPU (`node:inspector` en el worker), pruebas instrumentadas
y micro-benchmarks. Los números completos están en el handoff
`.agents/handoffs/estabilizar-pruebas-intermitentes.md`.

### 1. `ClientDrawer.confirm-delete`: una carrera, no lentitud

- **El síntoma.** La prueba del reintento falló en 1,1 s con «Unable to find ...
  role "button" and name "Eliminar cliente"». En el volcado del DOM, la alerta ya
  está y el botón sigue en «Procesando…», deshabilitado.
- **La causa.** `onConfirm` limpia el error y abre una transición asíncrona.
  Después del `await`, `setDeleteError(error)` y el fin de la transición
  (`isDeleting = false`) llegan a React en commits distintos.
- **La carrera.** `findByRole("alert")` resuelve con el primer commit. RTL cierra
  cada `findBy*` con un `setTimeout(0)`, y el Scheduler de React 19 avanza con
  `setImmediate` en tramos de 5 ms. En Node, el orden entre ambos depende de la
  carga. Si gana el `setTimeout`, la prueba busca el botón antes del segundo
  commit.
- **Reproducción determinista.** Con `vi.hoisted`, antes de cargar React, se
  retrasa el `setImmediate` del Scheduler:
  - la versión original pasa con 0-1 ms de retraso, falla 1 de 2 con 5 ms y falla
    6 de 6 con 15-100 ms;
  - la versión corregida pasa 12 de 12 con 0-100 ms.

### 2. `PackingListProductsStep` y `supplier-flow`: getByRole recorre la copia imprimible oculta

- **Costo aislado.** Aislada y con la máquina libre, `supplier-flow` tardaba
  78-93 s y `PackingListProductsStep` 29-34 s. La prueba más lenta de cada archivo
  rondaba los 9-10 s. Bajo la contención de la suite, eso pasa de los 20 s.
- **Dónde se va la CPU.** El perfil de CPU ubica el 75 % en `queryAllByRole`, y
  casi todo dentro de `computeAccessibleName`. Ahí, `isHidden` (68 % inclusivo)
  llama a `getComputedStyle` de jsdom 29.
- **Por qué jsdom es caro.** jsdom rehace la cascada completa (la hoja por
  defecto más las ~110 reglas de los `<style>` del componente) por cada nodo y
  cada propiedad heredada. Además vacía su caché de estilos con cada mutación del
  DOM, o sea después de cada render.
- **La copia oculta.** La página monta una copia imprimible del documento
  (`.pl-print-only`, con el atributo `hidden`) de 283 a más de 330 nodos, más de
  la mitad del DOM. En `@testing-library/dom` 10.4.1 el filtro `name` corre antes
  que el de ocultos. getByRole nunca devuelve esos nodos, pero calcula el nombre
  accesible de cada uno antes de descartarlos.
- **Medido con la misma carga:**

  | Consulta | En toda la página | Acotada / sin la copia |
  |---|---:|---:|
  | textbox «Empresa / Persona» (paso 1) | 510 ms | 111 ms sin la copia |
  | botón `/^4 /` | 381 ms | 34 ms dentro del `<nav>` |
  | textbox «Unidades del grupo · 2» | 405 ms | 82 ms dentro del editor |
  | botón «Editar Tapas» | 244 ms | 108 ms dentro del grupo |

- **Instrumentación.** Con cada consulta cronometrada, `screen.getByRole` de
  textbox y botón suma ~30 de los 37 s de `PackingListProductsStep`. En
  `supplier-flow`, «Empresa / Persona» se buscó 29 veces, 49 s de 98 s de
  consultas.

### 3. `invoice-read-boundary`: E/S secuencial y parseo completo

- **Qué hace.** La prueba lee y parsea con TypeScript unos 1.600 archivos
  (13,6 MB).
- **Tiempos antes del cambio.** Aislada tardaba ~6 s en tibio y ~30 s en frío. En
  la línea base con contención llegó a 92 s, contra su tope de 60 s.
- **La lectura.** Uno por uno, `readFileSync` acumula la latencia de cada
  apertura: 1,9-2,5 s con la máquina a media carga y 19-37 s al 100 %.
- **El parseo.** Con punteros al padre, que el recorrido no usa, cuesta el doble.

### 4. El multiplicador de la suite

- **Los números.** Los 21 workers comparten 22 hilos: 12 de núcleos P, y el resto
  de núcleos E y LP-E, más lentos. La memoria libre bajó a 0,6 GB en la línea base
  con otra suite al lado. En la suite completa, la prueba más lenta de
  `PackingListProductsStep` pasó de 8,8 s aislada a 23,2 s.
- **El entorno jsdom.** Sumado sobre los 604 archivos, montar jsdom costó 6.863 s
  en esa corrida, contra 1.205 s de pruebas. Todos los archivos lo montan, aunque
  sean pruebas de Node puro. El detalle está en «Fuera de alcance».

## Evidencia con contención real

El A/B focal final intercaló la versión de `1d80c18a` (igual a main en estas
pruebas) con la de la rama (`7f8aca61`), aislando cada archivo. Mientras corría,
arrancaron dos suites completas de otras sesiones: de 22 a 45 procesos vitest
ajenos, con la CPU al 100 %. Es la disposición del problema original.

| Prueba | Antes | Después |
|---|---|---|
| PackingListProductsStep, ronda 2 (100 %, 25 y 45 procesos ajenos) | **8/9**, máximo 21,6 s contra 20 s | 9/9, máximo 7,4 s |
| supplier-flow, rondas 1 y 2 (100 %, 22-45 ajenos) | 23/23, máximo 17,0 s y 16,6 s | 23/23, máximo 8,7 s y 9,6 s |
| ClientDrawer.confirm-delete, ronda 1 (100 %, 44 ajenos) | **8/9**, la carrera | 9/9 |
| invoice-read-boundary, ronda 1 (100 %, 44-45 ajenos) | **2/3**, 156,4 s contra 60 s | 4/4, 4,8 s |

Antes falló en 3 de 8 corridas y después pasó 8 de 8. El detalle de las rondas,
con la carga de cada corrida, está en el handoff.

## Decisiones

- **Ningún tope sube.** Ninguna consulta pasa a `hidden: true` ni se toca
  `configure({ defaultHidden })`.
- **Acotar y reutilizar.** Se acota con `within(...)` y se reutilizan referencias,
  criterio del Director del 2026-09-18: no cambia lo que la prueba afirma. Las
  aserciones negativas (`queryBy… .not.toBeInTheDocument()`) siguen sobre toda la
  página, porque acotarlas sí las debilitaría.
- **Sin cambio de producto ni migraciones.**
- **`vitest.config.ts`:** pendiente de la medición de la suite completa con la
  máquina quieta. Si se cambia el número de workers, el cambio depende del entorno
  para no alargar el CI.

## Alcance

- **`ClientDrawer.confirm-delete.test.tsx`.** Antes de cada clic de reintento, la
  prueba espera el botón de confirmar con `findByRole`.
- **`PackingListProductsStep.test.tsx`:**
  - pasos dentro del `<nav>`;
  - campos y botones de producto dentro de su grupo (`inGroup`, `field`) o del
    editor (`product`, `save`);
  - la comprobación inicial de «Empresa / Persona» dentro de la tarjeta del paso 1.
- **`supplier-flow.test.tsx`:**
  - pasos dentro del único `<nav>` de la página, que no depende del idioma;
  - botones de grupo dentro de su región;
  - los campos del paso 1 en español dentro de la tarjeta del paso: `contact` y
    `findContact`. La tarjeta se ubica por su título (`h2` «Datos del proveedor»)
    y deja afuera la copia imprimible;
  - `start()` devuelve el campo de empresa para reutilizarlo mientras siga
    montado.
- **Sin tocar en ambos archivos:** las aserciones negativas y las que comprueban
  etiquetas en chino o inglés siguen sobre toda la página.
- **`invoice-read-boundary.test.mjs`:**
  - lectura con `fs.promises` y 32 lecturas a la vez;
  - `createSourceFile` sin `setParentNodes`;
  - prefiltro exacto `invoices || \`, con prueba propia.

  El prefiltro se sostiene porque un literal cuyo valor cocido es "invoices"
  aparece tal cual en el fuente o lleva una barra invertida (escape o continuación
  de línea).

## Criterios de aceptación

1. **ClientDrawer.** La reproducción determinista falla con la versión anterior y
   pasa con la nueva. El mutante que deja muerto el reintento (sin
   `setDeleteError(undefined)`) sigue fallando.
2. **PackingList y supplier-flow.** Conservan todas sus aserciones y pasan, más
   rápido en corridas intercaladas antes/después con la misma carga.
3. **invoice-read-boundary.** El inventario exigido no cambia (18 archivos, 46
   llamadas). El prefiltro tiene prueba propia con escapes que esconden la palabra.
   Dos mutantes quedan atrapados: un llamador escapado en un archivo nuevo, y
   quitar la rama de la barra invertida.
4. **Suite completa.** Con la máquina quieta, ninguna de las cuatro da rojo en la
   suite completa local. Se registran la carga y los procesos ajenos de cada
   corrida.
5. **CI.** Si se toca `vitest.config.ts`, el CI no se alarga.

## Fuera de alcance

Se registra en el handoff como FUERA DE ALCANCE DETECTADO:

- `norte-bake.test.mjs`, que también falló en la línea base con contención
  (27,6 s contra 20 s). Su subproceso tarda 1,4-2,4 s solo.
- `app/registro/__tests__/register-error-summary.test.tsx`: 2 pruebas pasaron de
  20 s en un verify ajeno. La causa es otra:
  - aislada tarda 1,6-2,1 s por prueba;
  - su CPU se va en re-renderizar `RegisterForm` en cada una de las 64 teclas
    que escribe user-event;
  - con `delay: 0`, user-event espera un `setTimeout` entre teclas (~70 por
    prueba).

  No la afecta la copia imprimible ni el costo de `getByRole`. El detalle está en
  el handoff.
- Las pruebas que recorren el repo y ya tienen topes propios:
  `env-example-contract` (90 s en la línea base), `copy-sin-casco-central`,
  `vis-02-font-tokens` y `json-ld-escape-contract`.
- El entorno `jsdom` global para archivos que no usan el DOM.
- La exclusión de antivirus de los worktrees. Es configuración de seguridad del
  equipo y la decide Sam.
