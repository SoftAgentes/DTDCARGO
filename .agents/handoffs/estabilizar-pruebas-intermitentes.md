# Handoff — las pruebas intermitentes de la suite dejan de dar rojos falsos (SDD-0486)

Fecha: 2026-09-18 (UTC 2026-09-19). Task ID: `estabilizar-pruebas-intermitentes`.
Owner / sesión escritora: `claude-05073579`, Worker Claude Code, sesión «Estabilizar las 4 pruebas intermitentes de la suite» [a0371b]. Director: sesión `dtdcargo-18`. No hubo subagentes.

Estado: lista-para-revision.

- Las correcciones, la evidencia, la suite «antes» y `pnpm verify` están cerrados.
- El Director autorizó publicar. Sam había encargado abrir la PR con esa autorización.
- Se publica con un solo push de este commit, y la PR contra `main` se abre lista para revisión.
- El número de la PR, el SHA y el resultado del CI alojado van al Director por mensaje.
- Nada está integrado.

Datos de la rama:

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/estabilizar-pruebas-intermitentes`.
  - Lo creé con `git fetch origin` y `node scripts/harness-worktree.mjs start estabilizar-pruebas-intermitentes`.
  - `guard` y `claim --owner claude-05073579` pasaron sobre el árbol limpio.
  - `guard --owner` se revalidó antes de cada commit.
  - Instalé dependencias con `corepack pnpm install --frozen-lockfile` y no copié ningún `.env`.
- **Rama:** `codex/estabilizar-pruebas-intermitentes`, sin upstream, desde `origin/main` `1d80c18a`.
  - Traje con cherry-pick la reserva de SDD del Director: `f7e32411` quedó como `4fe29aa6` y `ff0a01a9` como `295c67a6`.
  - main se integró cuatro veces, siempre con merge y con el driver de main:
    - `b981d6dc` en `4f41ef2e`;
    - `26983062` en `d3440dfe`;
    - `a90c242b` en `a1886e41`, antes del primer push, por pedido del Director;
    - `e9e8240e`, con la #159, en `a83473ce`, en el turno de integración que dio el Director.
  - En los cuatro merges, `docs:index` regeneró el índice sin diff, así que el driver acertó.
  - Después del último merge, el índice lista 475 specs.
  - El diff de la rama contra la base común son 7 archivos: 4 pruebas, la spec, el índice y este handoff.
- **SDD:** `docs/specs/0486-estabilizar-pruebas-intermitentes/spec.md`, en `done`, porque se cumplen sus cinco criterios. La PR y el merge se registran aparte. El número lo asignó el Director.
- **Permisos:**
  - commits locales;
  - reportar al Director antes de abrir la PR;
  - push de la rama propia y PR contra `main`, cuando el Director lo autorice (Sam);
  - sin merge a main, sin migraciones y sin tocar producción.

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

Cada prueba tenía una causa distinta. Ningún tope subió, ninguna aserción se relajó, el producto no cambió y `vitest.config.ts` no se tocó.

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
4. **La spec SDD-0486** tiene el diagnóstico, las decisiones, la evidencia con contención real y el fuera de alcance. El índice de specs quedó regenerado.
5. **`vitest.config.ts` no se tocó.** Por la regla del Director, el experimento con `maxWorkers=11` solo corría si alguna de las cuatro fallaba en el verify. El paso `test` del verify pasó sin fallos al primer intento.

## EVIDENCIA

### Diagnóstico

- **Máquina.** Intel Core Ultra 7 155H: 6 núcleos P con HT, 8 E y 2 LP-E, 22 hilos. 31 GB de RAM, con 6 a 12 GB libres según la hora. vitest 4.1.7 levanta `availableParallelism() - 1` = 21 workers. En el CI (`ubuntu-24.04`, 4 vCPU) son 3.
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

### Aisladas con la máquina quieta: primera medición contra head final

| Prueba | Antes (`1d80c18a`, primera medición, carga 29-43 %) | Después (`a1886e41`, 01:20Z, carga 5 %, sin vitest ajenos) |
|---|---|---|
| PackingListProductsStep | 9/9 · 29,1 s de pruebas · máximo 8,8 s | 9/9 · 10,0 s · máximo 2,0 s |
| supplier-flow | 23/23 · 77,9 s · máximo 9,7 s | 23/23 · 20,0 s · máximo 3,4 s |
| ClientDrawer.confirm-delete | 9/9 · 1,9 s | 9/9 · 4,4 s (su arreglo no es de costo) |
| invoice-read-boundary | 3/3 · 30,4 s en frío (6,4 s en tibio) | 4/4 · 1,5 s |

### Suite completa

| Corrida | Condiciones | Resultado |
|---|---|---|
| `base1` (antes, `1d80c18a`) | Contaminada: otra suite completa de `respaldo-bateria-15` corrió en paralelo, con 8-26 procesos de prueba ajenos. CPU media 91 %, memoria libre mínima 0,6 GB. | FALLÓ, 4 de 604 archivos: invoice-read-boundary (92,4 s, tope 60 s), norte-bake (27,6 s, tope 20 s), PackingList «adds another group» (23,2 s, tope 20 s) y ClientDrawer (la carrera, 1,1 s). Duración: 622 s. |
| **antes**, con la máquina quieta: las 4 pruebas de main (idénticas en `b981d6dc` y `3f810366`) sobre HEAD `4cdcbcfd` | Turno del Director, de 00:45:05Z a 00:50:39Z. CPU media 82 % (la propia suite), máxima 92 %; memoria libre mínima 8,7 GB. Ajeno y liviano: un vitest de un archivo de `portal-cliente-edita-datos-directo` (`profile-direct-edit.migration.test.ts`, `--pool=threads`) de 00:46:45Z a 00:48:00Z, y un eslint de un archivo de `carrera-cobro-factura` a las 00:49:59Z. | **FALLÓ**, 1 de 605 archivos: PackingList «adds another group», 21,2 s contra un tope de 20 s. Pasaron, cerca de su tope: invoice-read-boundary en 48,4 s (80 % de 60 s) y la prueba más lenta de supplier-flow en 17,1 s (85 % de 20 s; el archivo, 138 s). ClientDrawer pasó: la carrera es intermitente. Duración: 330 s. Árbol restaurado sin diff contra HEAD. |
| **después** = paso `test` de `pnpm verify` sobre `d3440dfe` | Turno del Director, de 01:01:32Z a 01:06:41Z, **sin ningún proceso ajeno**. Lo ajeno de todo el verify (focal y liviano) cayó fuera de este paso: `anon-privilegios-residuales` de 00:56:15Z a 00:57:44Z, `carrera-cobro-factura` de 00:57:44Z a 00:58:44Z y `portal-cliente-edita-datos-directo` de 01:15:44Z a 01:16:14Z. El monitor contó como ajenos los procesos de verify con ruta relativa (vitest, playwright, next dev, tsc, eslint); por su cadena de padres, son pasos de mi propio `verify.mjs`. | **PASÓ al primer intento, sin reintento**: 605 archivos y 1 omitido; 7.938 pruebas, 1 omitida y 0 fallos. Duración: 293 s. Límite: sin la terminal, vitest solo imprime el resumen, así que esta corrida no tiene tiempos por prueba. Los tiempos después de estas pruebas salen de los A/B focales. |

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| Las 4 pruebas aisladas | `7f8aca61`, y después del merge `4f41ef2e` | PASÓ: 9/9, 23/23, 9/9 y 4/4 |
| invoice-read-boundary después del merge con `26983062` | `d3440dfe` | PASÓ: 4/4 |
| Reproducción determinista de ClientDrawer | árbol de trabajo sobre `2d7a119f` | PASÓ: la original falla y la corregida pasa |
| Mutantes (3) | árbol de trabajo | PASÓ: los 3 quedan atrapados |
| A/B focal intercalado, incluida la contención real | `94d95ab6`, `7f8aca61` | PASÓ: antes falló 3 de 8 y después pasó 8 de 8 |
| Suite completa «antes», con la máquina quieta | pruebas de main sobre `4cdcbcfd` | FALLÓ, como se esperaba: reproduce el problema |
| `pnpm verify`, 20,4 min, exit 0 | `d3440dfe` | CIERRE INCOMPLETO según su propio veredicto: 16 de 17 pasos PASARON y 1 NO EJECUTADO (abajo) |
| · harness, lint, rsc-boundary, typecheck, edge-functions (4 funciones) | `d3440dfe` | PASÓ |
| · test | `d3440dfe` | PASÓ: 605 archivos, 7.938 pruebas, 0 fallos, al primer intento |
| · docs:check (471 specs), numbering, feature-constants, components:check, governance:check | `d3440dfe` | PASÓ |
| · pending-migration-symbols (0 rojo · 0 amarillo), sql-tests, schema-rebuild | `d3440dfe` | PASÓ |
| · e2e | `d3440dfe` | PASÓ: 166 pasaron y 18 omitidas, en 5,5 min |
| · build (Next.js 16.2.11) | `d3440dfe` | PASÓ |
| · migrations-applied | `d3440dfe` | NO EJECUTADO: el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`, y no copio credenciales a worktrees. Esta tarea no agrega migraciones, así que no aplica a su contenido. Aun así, el cierre de verify queda INCOMPLETO en ese crítico. |
| Merge de main `a90c242b`: `docs:check` (471 specs), `sdd:check` y las 4 pruebas en foco con `--pool=threads` | `a1886e41` | PASÓ: 9/9, 23/23, 9/9 y 4/4. El Director pidió no repetir el verify: el merge es trivial y no toca estos archivos. |
| Merge de main `e9e8240e` (turno de integración): `docs:check` (475 specs), `sdd:check` e invoice-read-boundary más las 3 pruebas tocadas, sueltas con `--pool=threads` y la máquina a 22 % | `a83473ce` | PASÓ: 4/4, 9/9, 23/23 y 9/9. El inventario que main exige ahora es de 19 archivos y 44 llamadas, cambiado por la #157 y la #159; el BASELINE y las aserciones quedaron como en main, porque esta rama no los toca. Sobre el código nuevo (1.651 archivos), el prefiltro y el parseo completo dan las mismas 44 llamadas. |
| ESLint de los 4 archivos | `7f8aca61` | PASÓ |
| `docs:check` / `sdd:check` después de cada merge | `4f41ef2e`, `d3440dfe` | PASÓ |
| CI alojado («Calidad local sin secretos») | — | NO DISPONIBLE hasta publicar la PR. Va por mensaje al Director. |

## COMMITS

- `4fe29aa6`, `295c67a6`: reserva de SDD-0486, del Director, traída con cherry-pick.
- `2d7a119f`: `test(studio): SDD-0486 — ClientDrawer espera el botón de confirmar antes de reintentar`.
- `98ae6f89`: `test(web): SDD-0486 — el flujo del proveedor acota sus consultas a la región que prueba`.
- `94d95ab6`: `test(studio): SDD-0486 — el inventario de invoices lee en paralelo y parsea solo lo que puede sumar`.
- `0137ca8b`: `test(web): SDD-0486 — los campos del paso 1 se buscan en la tarjeta del paso`.
- `7f8aca61`: `test(web): SDD-0486 — PackingListProductsStep espera el campo de empresa en la tarjeta del paso`.
- `bf15908f`: spec, índice y primera versión de este handoff.
- `4f41ef2e`: merge de main `b981d6dc`.
- `645ad47e`: la spec registra el A/B con contención real.
- `4cdcbcfd`: `register-error-summary` queda fuera de alcance, con su medición.
- `bca849e9`: el handoff registra la suite «antes».
- `d3440dfe`: merge de main `26983062`.
- `ad682960`: el cierre, con el verify y la spec en `done`.
- `a1886e41`: merge de main `a90c242b`.
- `b70706af`: el handoff del primer push. CI verde: «Calidad local sin secretos» en 17 min 23 s, run 35412460649.
- `a83473ce`: merge de main `e9e8240e`, en el turno de integración.
- El commit que contiene este documento: el registro de ese merge y de su validación, en el mismo push.

## PR / BRANCH

Rama `codex/estabilizar-pruebas-intermitentes`, que se publica en `origin` con este push. La PR va contra `main`, lista para revisión. El número, el SHA publicado y el resultado del CI alojado van al Director por mensaje, sin volver a empujar: la rama queda congelada hasta que él integre.

## PENDIENTES DE ESTA TAREA

1. Mandarle al Director el resultado del CI alojado: «Calidad local sin secretos», comprobado por nombre.

## FUERA DE ALCANCE DETECTADO

- **`scripts/__tests__/norte-bake.test.mjs`.** Falló en `base1`: 27,6 s contra el tope global de 20 s. Lanza `node scripts/norte.mjs` como subproceso. Solo, el script tarda 1,4-2,4 s. En la suite saturada, el subproceso compite con los workers. Es contención, no costo propio, y no se arregla aquí (instrucción del Director).
- **`app/registro/__tests__/register-error-summary.test.tsx`.** Me la pasó el Director: en el verify del Worker de pagos (`3167e240`), 2 de sus 3 pruebas pasaron del tope de 20 s en la primera corrida. **Otra causa, no la de estas cuatro.**
  - Aislada: 1,6-2,1 s por prueba y 5,4-5,5 s el archivo, con 1-59 % de carga.
  - Perfil de CPU (4,0 s muestreados): el 40 % inclusivo es React re-renderizando `RegisterForm.tsx` (1.820 líneas) en cada tecla que despacha user-event (`keyboardAction` → `commitInput` → `flushSyncWork`), y ~19 % es espera ociosa. `getByRole` con `name` casi no aparece.
  - La prueba escribe 64 caracteres con `userEvent.setup()`. Con `delay: 0`, user-event espera un `setTimeout` entre teclas, unas 70 veces por prueba. Bajo contención, cada espera depende de cuándo el sistema vuelve a darle CPU al hilo. Por eso la inflación pasa de 10×, cuando en PackingList fue de 2,6×.
  - Probé `userEvent.setup({ delay: null })` en una copia temporal, con la carga fluctuando: 3,4 / 1,9 / 2,4 s contra 7,3 / 4,3 / 4,3 s de la original en una ronda, y 6,2 / 2,7 / 3,4 s contra 4,5 / 3,7 / 4,0 s en la otra. **No es concluyente.** Queda como hipótesis para una tarea aparte, que tiene que medirla con la máquina quieta y mostrar que la prueba sigue afirmando lo mismo.
  - En la suite «antes» pasó en 6,3 s su prueba más lenta.
- **Las pruebas que recorren el repo con topes propios.** En `base1`:
  - `env-example-contract`, 90,4 s;
  - `copy-sin-casco-central`, 33,2 s;
  - `vis-02-font-tokens`, 31,6 s;
  - `json-ld-escape-contract`, 30,3 s.

  Pasaron, pero son de las que más CPU y E/S ponen sobre la suite. Leer en paralelo, como en invoice-read-boundary, podría ayudarlas.
- **El entorno `jsdom` global.** Todo archivo lo monta, aunque sea Node puro (`scripts/__tests__/*.mjs`, buena parte de `lib/`). Pasar esos archivos a `node` bajaría mucho la CPU de la suite. Es un cambio amplio, para una spec aparte.

  | Corrida | Montar jsdom (sumado) | Pruebas (sumado) |
  |---|---:|---:|
  | `base1` | 6.863 s | 1.205 s |
  | «antes» | 3.880 s | 700 s |
  | «después» | 3.312 s | 839 s |

- **El antivirus escanea cada lectura de fuente en los worktrees.** Es configuración de seguridad del equipo: la decide Sam, no esta tarea.
- **`migrations-applied` da SKIP en todo worktree sin credenciales.** Por eso ningún `verify` de Worker cierra completo. Es una condición conocida del harness, fuera de esta tarea.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR e integrarla cuando el CI esté verde. Todo lo escribible está en este commit; lo único que llega después es el CI, por mensaje.
- **Revisión sugerida:**
  - que las consultas acotadas afirman lo mismo que antes;
  - que las negativas siguen sobre toda la página;
  - que el prefiltro de invoices es exacto, con su prueba y su mutante;
  - que la carrera de ClientDrawer está bien descrita.
- **Sin cambios compartidos:** ni producto, ni `vitest.config.ts`, ni migraciones, ni base de datos.
- **Ownership:** el claim de `claude-05073579` se libera después de publicar y de enviar el resultado del CI. Si la revisión pide cambios, se vuelve a reclamar.

## Impacto documental y conocimiento

- **Documento canónico nuevo:** la spec SDD-0486. El índice `docs/specs/README.md` se regeneró con `pnpm docs:index` después de cada merge. Van 471 specs.
- **`knowledge:status`** en este worktree nuevo: estructural INVALID (4.233 pendientes, 3.124 faltantes) y semántica INVALID (1.109 pendientes). Es lo esperable: los derivados de Graphify no se versionan y nunca se construyeron aquí. **Ninguna fuente de `semanticPilot` cambió**, así que no hace falta recibo semántico. La spec y el handoff nuevos quedan como pendientes globales visibles.
- **Graphify estructural (`graphify update .`) y vista previa de Obsidian:** NO EJECUTADOS. En un worktree nuevo, construir Graphify desde cero ocupa un turno de máquina compartida, y el runbook ya pone esa actualización en manos del Director, desde main integrado. Queda como pendiente de integración.
- **Archify:** NO EJECUTADO. Sus fuentes (`docs/architecture/knowledge-lifecycle.archify.json` y su evidencia) no cambiaron. Además, construirlo requiere descargar un ZIP de GitHub, y esa descarga no está autorizada.
