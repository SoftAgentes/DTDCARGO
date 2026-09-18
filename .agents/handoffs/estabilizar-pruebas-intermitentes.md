# Handoff — las pruebas intermitentes de la suite dejan de dar rojos falsos (SDD-0486)

Fecha: 2026-09-18. Task ID: `estabilizar-pruebas-intermitentes`.
Owner / sesión escritora: `claude-05073579`, Worker Claude Code, sesión «Estabilizar las 4 pruebas intermitentes de la suite» [a0371b]. Director: sesión `dtdcargo-18`. No hubo subagentes.

Estado: en-progreso. Las correcciones y la evidencia focal están listas. Falta la suite completa antes/después, en el turno de máquina que asigna el Director.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/estabilizar-pruebas-intermitentes`.
  - Lo creé con `git fetch origin` y `node scripts/harness-worktree.mjs start estabilizar-pruebas-intermitentes`.
  - `guard` y `claim --owner claude-05073579` pasaron sobre el árbol limpio.
  - `guard --owner` se revalidó antes de cada commit.
  - Instalé dependencias con `corepack pnpm install --frozen-lockfile` y no copié ningún `.env`.
- **Rama:** `codex/estabilizar-pruebas-intermitentes`, sin upstream, desde `origin/main` `1d80c18a`.
  - Traje la reserva de SDD del Director con cherry-pick: `f7e32411` quedó como `4fe29aa6` y `ff0a01a9` como `295c67a6`.
  - main avanzó a `cc15e48c` mientras tanto. Aún no lo integré (ver pendientes).
- **SDD:** `docs/specs/0486-estabilizar-pruebas-intermitentes/spec.md`, en `in-progress`. El número lo asignó el Director.
- **Permisos del encargo:** commits locales. Antes de abrir la PR hay que reportar al Director, que revisa e integra. Sin merge a main, sin migraciones y sin tocar producción.

## OBJETIVO ORIGINAL

Encontrar la causa raíz de cuatro pruebas que fallaban de forma intermitente en la suite completa local, aun con la máquina libre, y que pasaban en el CI de GitHub:

- `app/p/[token]/PackingListProductsStep.test.tsx` (~20 s contra un tope de 20 s);
- `app/p/[token]/supplier-flow.test.tsx`;
- `app/studio/(app)/clientes/_components/ClientDrawer.confirm-delete.test.tsx`;
- `scripts/__tests__/invoice-read-boundary.test.mjs` (~60 s).

Reglas del encargo:

- No subir timeouts a ciegas ni debilitar aserciones. Si subir un timeout fuera lo correcto, justificarlo con mediciones.
- Medir cada prueba aislada y en la suite completa, antes y después, registrando la carga.
- Condiciones del Director:
  - nada de `hidden: true`;
  - `within(...)` y reutilizar referencias sí valen;
  - si se tocan los workers, que no se alargue el CI;
  - antes de medir la suite completa, preguntarle si hay otra suite corriendo.

## COMPLETADO

Cada prueba tenía una causa distinta. Ningún tope subió, ninguna aserción se relajó y el producto no cambió.

1. **ClientDrawer: una carrera, no lentitud** (`2d7a119f`).
   - **Síntoma.** El volcado de la falla muestra la alerta ya presente y el botón en «Procesando…», deshabilitado.
   - **Causa.** Después del `await`, `setDeleteError(error)` y el fin de la transición llegan a React en commits distintos. RTL cierra cada `findBy*` con `setTimeout(0)`, y el Scheduler de React 19 avanza con `setImmediate`. En Node, el orden entre ambos depende de la carga.
   - **Arreglo.** La prueba espera el botón de confirmar con `findByRole` antes de cada reintento.
2. **PackingListProductsStep y supplier-flow: la copia imprimible oculta** (`98ae6f89`, `0137ca8b`, `7f8aca61`).
   - **Causa.** getByRole calcula el nombre accesible de 283 a más de 330 nodos ocultos en cada consulta: en `@testing-library/dom` 10.4.1 el filtro `name` corre antes que el de ocultos. jsdom 29 rehace la cascada CSS de cada nodo después de cada render.
   - **Arreglo.** Las consultas se acotan con `within`:
     - los pasos, dentro del `<nav>`;
     - los botones y campos de producto, dentro de su grupo o del editor;
     - los campos del paso 1, dentro de la tarjeta de su título.

     Además, `start()` devuelve el campo de empresa para reutilizarlo.
   - **Sin tocar.** Las aserciones negativas y las de etiquetas en chino e inglés siguen sobre toda la página.
3. **invoice-read-boundary: E/S secuencial y parseo completo** (`94d95ab6`).
   - **Lectura** paralela con tope de 32.
   - **Parseo** sin `setParentNodes`.
   - **Prefiltro exacto** `invoices || \`: un literal cuyo valor cocido es «invoices» aparece tal cual o lleva una barra invertida. Tiene prueba propia con tres escapes que esconden la palabra.
   - **Inventario** idéntico: 18 archivos y 46 llamadas.
4. **La spec SDD-0486** está escrita, con el diagnóstico y las decisiones, y el índice de specs quedó regenerado. Van en el commit que contiene este documento.
5. **`vitest.config.ts` no se tocó.** Por decisión del Director, el experimento con `maxWorkers=11` solo corre si alguna de las cuatro sigue fallando en la suite «después».

## EVIDENCIA

### Diagnóstico

- **Máquina.** Intel Core Ultra 7 155H: 6 núcleos P con HT, 8 E y 2 LP-E, 22 hilos. 31 GB de RAM, con unos 6 GB libres. vitest 4.1.7 levanta `availableParallelism() - 1` = 21 workers. En el CI (`ubuntu-24.04`, 4 vCPU) son 3.
- **Perfil de CPU de supplier-flow** (setup temporal con `node:inspector`, 84,5 s muestreados):
  - `queryAllByRole`: 74,6 % inclusivo;
  - `computeAccessibleName`: 72,5 %;
  - `isHidden`: 68,1 %;
  - `prepareComputedStyleDeclaration` de jsdom: 66,9 %;
  - `_borderSetter`: 25,7 %.
- **Censo del DOM** en el paso 2: 503 nodos, de los cuales 283 están en `.pl-print-only` (con `hidden`), con 9 de 28 botones y 17 de 29 campos.
- **Costo por consulta.** Mediana de 3, con la misma carga (99 %), borrador mixto y etiquetas:

  | Consulta | En toda la página | Sin la copia o acotada |
  |---|---:|---:|
  | textbox «Empresa / Persona» | 510 ms | 111 ms sin la copia · 138 ms en la tarjeta del paso |
  | botón `/^4 /` | 381 ms | 34 ms en el `<nav>` |
  | textbox «Unidades del grupo · 2» | 405 ms | 82 ms en el editor |
  | botón «Editar Tapas» | 244 ms | 108 ms en el grupo |
  | botón «Enviar documento a DTD» | 303 ms | 141 ms sin la copia |

- **Instrumentación de las pruebas originales** (Proxy sobre `screen`, `within` y `fireEvent`):
  - PackingList: `screen.getByRole` de textbox, 53 × 363 ms; de botón, 64 × 163 ms. Suman ~30 de los 37 s.
  - supplier-flow: «Empresa / Persona», 29 llamadas y 49 s de 98 s de consultas.
- **ClientDrawer, reproducción determinista.** Retrasé el `setImmediate` del Scheduler con `vi.hoisted`, antes de cargar React:

  | Retraso | 0 ms | 1 ms | 5 ms | 15 ms | 40 ms | 100 ms |
  |---|---|---|---|---|---|---|
  | Original (2 corridas c/u) | 2/2 | 2/2 | 1/2 | 0/2 | 0/2 | 0/2 |
  | Corregida (2 corridas c/u) | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 | 2/2 |

  La corrida suelta con 15 ms también falló 3 de 3 con la original, con el mismo error de la suite.
- **invoice-read-boundary, fuera de vitest.** 1.638 archivos y 13,6 MB:
  - lectura secuencial: 1,9-2,5 s con carga ~47 %, y 18,8-37,4 s al 100 %;
  - lectura paralela con tope de 32: 0,56-0,62 s;
  - parseo con padre: 16,6-19,2 s; sin padre: 9,3 s; con prefiltro: 3,7-4,6 s, todo al 100 % de carga;
  - las tres variantes dan 46 llamadas.
- **Antivirus.** La protección en tiempo real está activa, con 1 exclusión que no puedo ver. No la toqué.

### Mutantes (control rojo)

| Mutante | Resultado |
|---|---|
| `ClientDrawer.tsx` sin `setDeleteError(undefined)` en `onConfirm` (candado del reintento muerto) | la prueba corregida FALLA ✔ |
| archivo nuevo `lib/zz-mutante.tmp.ts` con `db.from("invo\x69ces")`, sin la palabra tal cual | el inventario FALLA con `"lib/zz-mutante.tmp.ts": 1` ✔ |
| `mayCallInvoices` sin la rama de la barra invertida | la prueba del prefiltro FALLA ✔ |

Los mutantes se aplicaron sobre el árbol de trabajo y se revirtieron. El estado limpio se verificó con `git status`.

### Tiempos aislados antes/después

Corridas focales intercaladas, `--pool=threads`, versión de `1d80c18a` contra la rama. Formato: suma de pruebas / máximo; entre paréntesis, la carga al empezar.

| Prueba | Ronda | Antes | Después |
|---|---|---|---|
| PackingListProductsStep | 1 | 57,4 s / 16,8 s (83 %) | 29,0 s / 5,7 s (63 %) |
| PackingListProductsStep | 2 | 38,9 s / 11,1 s (47 %) | 20,0 s / 3,8 s (42 %) |
| supplier-flow | 1 | 92,7 s / 11,5 s (45 %) | 73,0 s / 19,7 s (54 %)* |
| supplier-flow | 2 | 85,3 s / 15,1 s (39 %) | 47,2 s / 4,8 s (23 %) |
| ClientDrawer.confirm-delete | 1 | 2,4 s / 0,6 s | 2,4 s / 0,6 s |
| ClientDrawer.confirm-delete | 2 | 2,5 s / 0,5 s | 3,0 s / 0,6 s |
| invoice-read-boundary | 1 | 7,0 s | 2,1 s |
| invoice-read-boundary | 2 | 10,8 s (57 %) | 2,3 s (95 %) |

\* El pico de 19,7 s cayó en «supports correction» (7,8 s → 4,7 s en la ronda 2). Instrumentada, esa prueba gastaba 4,6 s en dos búsquedas de «Empresa / Persona» sobre toda la página. Eso llevó a `0137ca8b` y `7f8aca61`. Después de esos commits:

- supplier-flow: 31,4 s / 4,0 s (74 %);
- PackingListProductsStep: 16,0 s / 3,2 s (80 %) y 14,2 s con la máquina a 1 %.

### A/B focal final (versiones de `7f8aca61`), con contención real

Durante estas rondas arrancaron dos suites completas de otras sesiones: de 22 a 45 procesos vitest ajenos, con la carga al 100 %. Fue la disposición infeliz real del problema. Formato: pasaron / suma / máximo; entre paréntesis, la carga y los procesos vitest ajenos.

| Prueba | Ronda | Antes (`1d80c18a`) | Después (`7f8aca61`) |
|---|---|---|---|
| PackingListProductsStep | 1 | 9/9 · 28,0 s · 9,4 s (59 %, 0) | 9/9 · 16,7 s · 4,0 s (41 %, 0) |
| PackingListProductsStep | 2 | **8/9** · 76,4 s · 21,6 s (100 %, 25) | 9/9 · 35,6 s · 7,4 s (100 %, 45) |
| supplier-flow | 1 | 23/23 · 112,1 s · 17,0 s (8 %→, 22) | 23/23 · 71,3 s · 8,7 s (100 %, 44) |
| supplier-flow | 2 | 23/23 · 137,1 s · 16,6 s (100 %, 44) | 23/23 · 84,5 s · 9,6 s (100 %, 45) |
| ClientDrawer.confirm-delete | 1 | **8/9** · 6,6 s (100 %, 44) | 9/9 · 4,3 s (100 %, 44) |
| ClientDrawer.confirm-delete | 2 | 9/9 · 4,9 s (100 %, 23) | 9/9 · 2,4 s (100 %, 22) |
| invoice-read-boundary | 1 | **2/3** · 156,4 s, tope 60 s (100 %, 44) | 4/4 · 4,8 s (100 %, 45) |
| invoice-read-boundary | 2 | 3/3 · 5,9 s (48 %, 0) | 4/4 · 1,8 s (46 %, 0) |

Con la contención real, las versiones de antes fallaron en 3 de 8 corridas, igual que en el problema. Las de después pasaron 8 de 8. La prueba más lenta de después fue de 9,6 s, contra un tope de 20 s.

### Suite completa

| Corrida | Condiciones | Resultado |
|---|---|---|
| `base1` (antes, `1d80c18a`) | Contaminada: otra suite completa de `respaldo-bateria-15` corrió en paralelo, con 8-26 procesos de prueba ajenos. CPU media 91 %, memoria libre mínima 0,6 GB. | FALLÓ, 4 de 604 archivos: invoice-read-boundary (92,4 s, tope 60 s), norte-bake (27,6 s, tope 20 s), PackingList «adds another group» (23,2 s, tope 20 s) y ClientDrawer (la carrera, 1,1 s). Duración: 622 s. |
| antes, con la máquina quieta | Turno de máquina del Director | PENDIENTE |
| después, con la máquina quieta | Turno de máquina del Director | PENDIENTE |

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| Las 4 pruebas aisladas | `7f8aca61` | PASÓ: 9/9, 23/23, 9/9 y 4/4 |
| Reproducción determinista de ClientDrawer | árbol de trabajo sobre `2d7a119f` | PASÓ: la original falla y la corregida pasa |
| Mutantes (3) | árbol de trabajo | PASÓ: los 3 quedan atrapados |
| A/B focal intercalado | `94d95ab6`, `7f8aca61` | PASÓ, ver tablas |
| `docs:check` | árbol de trabajo con la spec | PASÓ: índice sincronizado, 468 specs |
| `sdd:check` | `295c67a6` | PASÓ: sin números repetidos |
| Suite completa antes/después, con la máquina quieta | — | PENDIENTE (turno de máquina) |
| `pnpm verify` | — | PENDIENTE |

## COMMITS

- `4fe29aa6`, `295c67a6`: reserva de SDD-0486, del Director, traída con cherry-pick.
- `2d7a119f`: `test(studio): SDD-0486 — ClientDrawer espera el botón de confirmar antes de reintentar`.
- `98ae6f89`: `test(web): SDD-0486 — el flujo del proveedor acota sus consultas a la región que prueba`.
- `94d95ab6`: `test(studio): SDD-0486 — el inventario de invoices lee en paralelo y parsea solo lo que puede sumar`.
- `0137ca8b`: `test(web): SDD-0486 — los campos del paso 1 se buscan en la tarjeta del paso`.
- `7f8aca61`: `test(web): SDD-0486 — PackingListProductsStep espera el campo de empresa en la tarjeta del paso`.
- El commit que contiene este documento: la spec y el índice.

## PR / BRANCH

Sin PR todavía. Rama local `codex/estabilizar-pruebas-intermitentes`, base `main`. Se reporta al Director antes de abrirla.

## PENDIENTES DE ESTA TAREA

1. Suite completa antes/después con la máquina quieta, en el turno que asigne el Director, con monitor de carga.
2. Si en «después» sigue fallando alguna de las cuatro: el experimento con `maxWorkers=11`, que dependería del entorno para no alargar el CI. Si no falla, `vitest.config.ts` no se toca y así queda en la spec.
3. Traer `origin/main` (`cc15e48c` o posterior) con merge en la rama y regenerar el índice de specs con su script.
4. `pnpm verify` completo sobre el head final, con cada paso clasificado.
5. Cierre documental: `knowledge:status`, Graphify estructural y Archify. Luego reportar al Director y abrir la PR si autoriza.

## FUERA DE ALCANCE DETECTADO

- **`scripts/__tests__/norte-bake.test.mjs`.** Falló en `base1`: 27,6 s contra el tope global de 20 s. Lanza `node scripts/norte.mjs` como subproceso. Solo, el script tarda 1,4-2,4 s. En la suite saturada, el subproceso compite con los workers. Es contención, no costo propio, y no se arregla aquí (instrucción del Director).
- **Las pruebas que recorren el repo con topes propios.** En `base1`:
  - `env-example-contract`, 90,4 s;
  - `copy-sin-casco-central`, 33,2 s;
  - `vis-02-font-tokens`, 31,6 s;
  - `json-ld-escape-contract`, 30,3 s.

  Pasaron, pero son de las que más CPU y E/S ponen sobre la suite. Leer en paralelo, como en invoice-read-boundary, podría ayudarlas.
- **El entorno `jsdom` global.** En `base1`, montar jsdom sumó 6.863 s sobre los 604 archivos, contra 1.205 s de pruebas. Todo archivo lo monta, aunque sea Node puro (`scripts/__tests__/*.mjs`, buena parte de `lib/`). Pasar esos archivos a `node` bajaría mucho la CPU de la suite. Es un cambio amplio, para una spec aparte.
- **El antivirus escanea cada lectura de fuente en los worktrees.** Es configuración de seguridad del equipo: la decide Sam, no esta tarea.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** el turno de máquina para la suite antes/después (pendiente 1). Después, integrar main, correr `verify` y reportar antes de la PR.
- **Revisión sugerida:**
  - que las consultas acotadas afirman lo mismo que antes;
  - que las negativas siguen sobre toda la página;
  - que el prefiltro de invoices es exacto, con su prueba y su mutante.
- **Sin cambios compartidos:** ni producto, ni `vitest.config.ts`, ni migraciones, ni base de datos.
- **Ownership:** sigue tomado por `claude-05073579` hasta cerrar los pendientes.

## Impacto documental y conocimiento

- Documento canónico nuevo: la spec SDD-0486. El índice `docs/specs/README.md` se regeneró con `pnpm docs:index`.
- `knowledge:status`, Graphify y Archify quedan pendientes para el cierre (pendiente 5).
