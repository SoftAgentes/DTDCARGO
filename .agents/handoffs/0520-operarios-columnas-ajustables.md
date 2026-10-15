# Handoff · SDD-0520 · Operarios: columnas ajustables y botones compactos

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 (Caracas) |
| Task ID | operarios-columnas-ajustables |
| Owner | subagente Worker del Director (claim `worker-sdd-0520-agent-a200f75a`) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-a200f75a19ea8bdfb` |
| Rama | `codex/operarios-columnas-ajustables` |
| Base | `origin/main` `487971c8`; reserva SDD `666837d1` (fast-forward); merge de `origin/main` `c60cd4fe` (#218) en `11c7339d` |
| SDD | [0520](../../docs/specs/0520-operarios-columnas-ajustables/spec.md) · `in-progress` |
| Migración | ninguna |
| PR | draft contra `main`, abierta desde esta rama después del commit que contiene este documento |
| Estado de tarea | lista-para-revision (PR draft) |

## OBJETIVO ORIGINAL

Pedido de Sam, literal: «Que yo pueda cambiar el tamaño de las columnas para
poder organizarlo. Mira que no se ve qué usuario es. Entonces, hazme un poco más
pequeños los botones de la derecha y también dame la opción de poder mover las
columnas un poquito para ajustarles el tamaño.»

Alcance del Director: (1) el nombre se ve: mínimo legible, `title`, scroll
horizontal; (2) botones `studio-btn-xs`, Acciones más angosta, mismos textos y
`aria-label`; (3) columnas ajustables con asas pointer + captura, estado único,
`role="separator"` con teclado, doble clic, «Restablecer columnas»,
`localStorage` versionado y a prueba de fallos, SSR sin diferencias de
hidratación, lógica pura probada aparte y primitiva reutilizable; sólo la
adopta Operarios. Fuera: DB, migraciones, server actions, RPC, lógica de PIN y
el comportamiento de los botones.

## COMPLETADO

- `app/studio/_components/ui/columns/column-widths.ts` (puro): rango, lectura
  de lo guardado (ignora corrupto, no-objeto, desconocido, fijo, no-número y
  fuera de rango), escritura sólo de lo fijado, reset, teclado (flechas 16 px,
  Home/End) y template con una sola columna que crece.
- `ColumnResize.tsx`: `useColumnWidths` (lectura en microtask cancelable, como
  `useColumnConfig`; escritura en try/catch; no escribe durante el arrastre;
  limpia lo corrupto) y `ColumnResizeHandle` (`role="separator"`, valor/mín/máx,
  pointer capture, doble clic, medición de la celda si la columna está
  creciendo).
- `OperariosClient.tsx`: columnas medidas (tabla en la spec), «Operario» crece
  con piso de 260 px, contenedor con `minWidth` y `overflowX: auto`, `title` en
  nombre, «Entra por …» y warehouse, celdas con `…`, botones xs, `title` del
  lápiz y «Restablecer columnas» visible sólo cuando hay anchos fijados.
- `.studio-col-resize` en `studio.css`; `ColumnResize.tsx` en el inventario del
  contrato de hidratación; sección «Ancho ajustable» en `app/studio/CLAUDE.md`.
- Criterios A1–A14 de la spec cubiertos por pruebas y por el arnés en Chromium.

## VALIDACIÓN

Base del código: commit `1ea22403` (sobre el merge `11c7339d`).

| Comprobación | Alcance | Estado |
|---|---|---|
| `vitest run` de `app/studio/(app)/operarios`, `app/studio/_components/ui/columns` y el contrato de hidratación | 7 archivos, 204 pruebas | PASÓ (0 avisos de `act`) |
| Pruebas existentes de `app/studio/(app)/operarios/**` antes de cambiar nada en ellas | 5 archivos, 125 pruebas | PASÓ |
| Mutantes manuales (8) con control verde antes y después | `column-widths.ts`, `ColumnResize.tsx`, `OperariosClient.tsx` | PASÓ: 8/8 muertos con «N failed» (ver abajo) |
| `corepack pnpm typecheck` | todo el repo | PASÓ (exit 0) |
| ESLint sobre los archivos tocados | 6 archivos | PASÓ (exit 0) |
| `corepack pnpm docs:check` | índice de 506 specs | PASÓ |
| `corepack pnpm sdd:check` | numeración | PASÓ (choques históricos 0342/0394 ya conocidos) |
| `corepack pnpm governance:check` · `components:check` | cápsula y CMP-01 | PASÓ |
| `git diff --check` | diff | PASÓ |
| `/ui-check` | diff visual | PASÓ con observaciones (abajo) |
| Arnés en Chromium (Playwright del repo) | `OperariosClient` real con stubs de actions | PASÓ (abajo) |
| `corepack pnpm verify` | completo, sobre `71c3cceb`, una sola corrida (01:55–02:23Z), sin otra corrida pesada en la máquina | **FALLÓ** por el paso `test` (3 pruebas ajenas al diff, verdes aisladas en el mismo SHA); `migrations-applied` NO EJECUTADO (SKIP); los otros 15 pasos PASARON. Detalle abajo |
| Studio con sesión real | `/studio/operarios` | NO DISPONIBLE: el worktree no tiene credenciales de Supabase (no se copian secretos); la evidencia es de componente y de Chromium con stubs |

### `corepack pnpm verify` paso por paso (SHA `71c3cceb`)

| Paso | Estado |
|---|---|
| harness | PASÓ |
| lint | PASÓ (avisos preexistentes de `react-hooks`, ninguno en archivos de esta tarea) |
| rsc-boundary | PASÓ (1665 módulos) |
| typecheck | PASÓ |
| edge-functions | PASÓ (4 funciones) |
| test | **FALLÓ**: `3 failed | 9661 passed | 1 skipped (9665)` en la corrida y en su reintento |
| docs:check | PASÓ |
| numbering | PASÓ |
| feature-constants | PASÓ |
| components:check | PASÓ |
| governance:check | PASÓ |
| migrations-applied | NO EJECUTADO: `[SKIP]` sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` en el worktree. Esta tarea no tiene migraciones |
| pending-migration-symbols | PASÓ (0 ROJO · 0 AMARILLO) |
| sql-tests | PASÓ |
| schema-rebuild | PASÓ |
| e2e | PASÓ con aviso: 177 passed, 1 flaky (`e2e/auth.spec.ts:81` «Acceso: un token inválido…», `net::ERR_ABORTED` en el primer intento), 20 skipped; salida ≠0 por el worker de WebKit que no cierra en Windows |
| build | PASÓ |

Resumen literal: «16 de 17 pasos corrieron de verdad» · «[FAIL] verify: 1
fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR:
migrations-applied.» · exit 1.

**Las tres pruebas rojas del paso `test`**, sin relación con el diff (ninguno
de sus archivos ni de sus imports cambia en esta rama:
`git diff origin/main HEAD` sobre ellos sale vacío):

| Prueba | En la suite | Aislada, mismo SHA `71c3cceb`, máquina quieta |
|---|---|---|
| `PinViewDialog.test.tsx` · «si la base pide confirmarla (P0022): el error va al campo…» | `toHaveFocus()` falla en 662 ms y 858 ms (el foco queda en «Ver PIN»): rojo rápido, carrera del foco bajo carga | 3 corridas: `12 passed (12)` cada una |
| `__tests__/fuentes-locales.test.ts` · «ningún archivo… importa next/font/google» | timeout de 20 s (35,2 s y 22,8 s) | `14 passed (14)` junto con `session-cookie`, 3,07 s |
| `lib/db/__tests__/session-cookie.test.ts` · «no hay otro archivo que cree clientes de @supabase/ssr» (1.ª corrida) | timeout (30,6 s) | ídem |
| `pin-operarios-endurecer.migration.test.ts` · «el validador es 0037…» (reintento) | timeout (35,2 s; el archivo tardó 284 s) | `83 passed (83)`, 111,95 s |

No se relanzó verify: el turno era de una sola corrida. La carrera de
`PinViewDialog` va en FUERA DE ALCANCE.

### Mutantes

| Mutante | Muere en |
|---|---|
| M1 `setColumnWidth` sin clamp | «recorta lo que escribe el usuario»; «el arrastre respeta el mínimo y el máximo» |
| M2 lo guardado fuera de rango se acepta | «fuera de rango se ignora…» (puro y componente) |
| M3 se guarda en cada movimiento del arrastre | «arrastrar ensancha en vivo… y guarda sólo al soltar» |
| M4 la columna que crece se ajusta desde su piso | «la primera flecha… arranca desde el ancho que se ve»; arrastre |
| M5 las filas no comparten el template | 10 pruebas (`sharedTemplate`) |
| M6 la columna que crece sin piso (`1fr`) | 21 pruebas |
| M7 un botón vuelve a `sm` | 4 pruebas de «botones de la fila» |
| M8 lo corrupto no se limpia | «JSON corrupto se ignora: defaults, y se limpia» |

Control inicial y final: `Tests 77 passed (77)` sobre
`column-widths.test.ts` + `OperariosClient.test.tsx`. Los mutantes se aplicaron
con un script del scratchpad que restaura los archivos en `finally`; después se
comprobó que no quedó texto mutado.

### Arnés en Chromium

`esbuild` empaqueta el `OperariosClient` real con las server actions
sustituidas, `tokens.css`, `studio.css` y las fuentes de `lib/font-files/`;
Playwright lo abre a 343, 700, 900, 1000 y 1232 px útiles, con JetBrains Mono y
con la mono del sistema. Resultados:

- A 1000 px útiles «Operario» mide 314 px y no hay scroll; a 1232, 546 px. A
  900/700/343 queda en 260 px y el contenedor hace scroll (944 px de
  `scrollWidth`). Ningún nombre ni «Entra por …» de la muestra se corta.
- Arrastre real con el mouse: −40 px desde 366 px visibles → 326 px exactos;
  +120 px saliendo del asa (captura) → 446 px; nada se escribe hasta soltar;
  `cursor: col-resize`; línea en hover `rgb(127, 15, 26)`.
- ArrowRight → +16 px; recargar conserva el ancho; doble clic → vuelve a
  `minmax(260px, 1fr)`; End en «Rol» → 200 px con todas las filas iguales;
  «Restablecer columnas» → default y clave borrada. Cero errores de consola al
  recargar con anchos guardados.
- Foco por teclado: `outline` 2 px `rgb(127, 15, 26)` en claro y
  `rgb(216, 154, 164)` en oscuro. Orden de Tab: «+ Nuevo operario» → las 5
  asas → acciones de la primera fila.

### /ui-check (diff)

🎨 UI-CHECK · `OperariosClient.tsx`, `ColumnResize.tsx`, `studio.css`

1. ⭐ [media] `OperariosClient.tsx` (botones de fila) — xs mide 27 px de alto:
   cumple 24 × 24 de WCAG, no el 32 × 32 interno de BTN-01 §7. Es el pedido de
   Sam; queda como excepción por densidad documentada en la spec.
2. [media] `ColumnResize.tsx` — sin alternativa de puntero sin arrastre
   (A11Y-01, punto 8); la de teclado sí está. Propuesta en FUERA DE ALCANCE.
3. [baja] `studio.css` `.studio-col-resize::before` — la línea en reposo usa
   `--border-strong` (decorativa, < 3:1); el estado interactivo usa
   `--wine-text`, que sí pasa.

Lo que está bien: sólo `var(--*)`; Nunito/Sora/mono del sistema por tokens;
anchos medidos con el peor caso y `nowrap` + `…` + `title`; hover/foco/arrastre
visibles; `prefers-reduced-motion`; copy en tuteo; sin AI slop. Veredicto: OK
con ajustes menores (no bloqueante).

## COMMITS

- `666837d1` chore(sdd): reserva SDD-0520 (stub, fast-forward).
- `11c7339d` merge de `origin/main` `c60cd4fe`.
- `1ea22403` feat(studio): SDD-0520 — código, pruebas, CSS, contrato y CLAUDE.md.
- `71c3cceb` docs(sdd): spec, índice y primera versión de este handoff (SHA verificado).
- commit que contiene este documento: sólo este handoff con los resultados de
  verify. La cabeza final y su hash quedan en la PR.

## PR / BRANCH

Base `main`, rama `codex/operarios-columnas-ajustables`, worktree arriba. PR
draft abierta con `gh pr create` después de este commit; el número y la cabeza
final van en la PR y en el reporte al Director.

## PENDIENTES DE ESTA TAREA

- Que el Director decida si el rojo de `test` (ajeno, verde aislado) basta o
  pide otra corrida de verify; con su OK, pasar la PR de draft a lista.
- Smoke de Sam en `dtdcargo.com/studio/operarios` después del merge (guion en
  la PR).

## FUERA DE ALCANCE DETECTADO

1. **Alternativa de puntero sin arrastre (A11Y-01, punto 8 / WCAG 2.5.7).** El
   asa se ajusta arrastrando o con el teclado; falta una vía de un solo toque
   (por ejemplo «Ampliar / Reducir» por columna en un menú). Propuesta para
   una SDD propia antes de adoptar la primitiva en más tablas.
2. **CMP-01.** `ColumnResize` queda como experimental, sin registro en
   `docs/governance/components/`; promoverla a `proposed` pide su ficha y un
   segundo consumidor.
3. **El Studio no carga JetBrains Mono.** `app/studio/tokens.css:173` define
   `--f-mono: 'JetBrains Mono', ui-monospace, …` por nombre de familia, pero
   ningún layout del Studio monta `jetbrainsMono.variable` (`lib/fonts.ts`) ni
   hay `@font-face` con ese nombre: los códigos caen a la mono del sistema
   (Consolas en Windows). Es la misma clase de falla que project-rules describe
   para `/tarifas` y `/shipping-mark`.
4. **Editar un operario de Venezuela exige warehouse.**
   `EditOperarioDrawer.tsx:54` (`canSubmit = !!warehouseId && …`) y
   `actions.ts:370` (`updateOperarioAction`: «Warehouse requerido») piden un
   warehouse de China aunque `warehouse_id` es nulo para Venezuela desde
   SDD-0023: un bodeguero o camionero no se puede editar sin asignarle uno.
5. **La tabla no es una tabla semántica** (A11Y-01, punto 10; TBL-01): es una
   grilla de `div` sin `role="table"`/`columnheader`, como antes de esta tarea.
6. **Carrera del foco en `PinViewDialog.test.tsx`** (SDD-0515). El caso «si la
   base pide confirmarla (P0022)…» falló dos veces seguidas en la suite
   completa en 662 ms y 858 ms con el foco en «Ver PIN» en vez del campo de
   contraseña (`PinViewDialog.tsx:136` enfoca después del render del error), y
   pasa 3/3 aislado. Rojo rápido: carrera, no timeout. Se reproduce retrasando
   el Scheduler; la prueba debería esperar el foco con `waitFor`, o el
   componente enfocar en el mismo commit que pinta el error.

## Impacto documental

- Canónicos actualizados: `app/studio/CLAUDE.md` (sección «Ancho ajustable»),
  la spec 0520 y el índice `docs/specs/README.md`.
- Graphify / Archify / Obsidian: no ejecutados en el worktree; el Director
  publica desde main integrado. Fuentes nuevas para el grafo: los tres
  archivos de `app/studio/_components/ui/columns/`.

## HANDOFF AL DIRECTOR

- **SHA verificado:** `71c3cceb` (verify completo). Después sólo cambia este
  handoff; la cabeza final la reporta la PR.
- **Siguiente acción:** revisar la PR draft; decidir sobre el rojo de `test`
  (tres pruebas ajenas, verdes aisladas en el mismo SHA) y sobre
  `migrations-applied` sin medir (no hay migraciones en la tarea).
- **Cambios compartidos:** primitiva nueva en `app/studio/_components/ui/columns/`
  y una clase nueva en `app/studio/studio.css`; ningún otro módulo la consume.
  Sin DB ni migraciones. Ninguna dependencia con otras PR abiertas conocida.
- **Merge = deploy** a producción por Vercel; el smoke de Sam está en la PR.
- **Ownership:** claim `worker-sdd-0520-agent-a200f75a` liberado al cerrar. No
  se eliminó worktree ni rama; la reserva local
  `codex/sdd-reserve-0520-operarios-columnas-ajustables` queda como está.
