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
| PR | pendiente de abrir |
| Estado de tarea | en-progreso |

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
| `corepack pnpm verify` | completo | EN CURSO (se completa en el commit siguiente) |
| Studio con sesión real | `/studio/operarios` | NO DISPONIBLE: el worktree no tiene credenciales de Supabase (no se copian secretos); la evidencia es de componente y de Chromium con stubs |

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
- commit que contiene este documento: spec, índice y handoff.

## PR / BRANCH

Base `main`, rama `codex/operarios-columnas-ajustables`, worktree arriba. PR
pendiente de abrir.

## PENDIENTES DE ESTA TAREA

- `corepack pnpm verify` completo y su registro paso por paso.
- Push y PR contra `main`.
- Smoke de Sam en `dtdcargo.com/studio/operarios` después del merge.

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

## Impacto documental

- Canónicos actualizados: `app/studio/CLAUDE.md` (sección «Ancho ajustable»),
  la spec 0520 y el índice `docs/specs/README.md`.
- Graphify / Archify / Obsidian: no ejecutados en el worktree; el Director
  publica desde main integrado. Fuentes nuevas para el grafo: los tres
  archivos de `app/studio/_components/ui/columns/`.

## HANDOFF AL DIRECTOR

Pendiente de completar al cerrar: verify, PR, SHA verificado y cabeza final.
