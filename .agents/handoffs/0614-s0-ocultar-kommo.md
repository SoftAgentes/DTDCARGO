# Handoff · SDD-0614 S0 — ocultar Kommo del Studio (PR 0 de la 6.6)

- **Owner:** Claude Worker «S0 · ocultar Kommo», encargado por el Subdirector de Chatwoot
  (`local_535053f4-40c2-4124-a280-63f4fc882820`), 2026-11-07. Claim: `angry-ellis-1ec8c1-s0`.
- **Ruta:** `.claude/worktrees/angry-ellis-1ec8c1`
- **Rama:** `claude/0614-s0-ocultar-kommo`, desde `main` `ecadbac91` (2026-11-07).
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md), §2.1 «S0», §5 (allowlist de
  S0), §8, §9 y §10; decisiones D-6.6-1, P-8, P-9 y P-10.
- **Permisos del encargo:** PR nueva desde `main`, en borrador. Push normal de la rama propia, en
  un comando aparte y después de leer las pruebas. **Sin merge** (fusiona el Director General),
  nada en producción y sin migraciones.

## OBJETIVO ORIGINAL

Tramo S0 de la 6.6: ocultar Kommo del Studio sin borrar nada, en su propia PR. Eso abarca las
pestañas de Kommo del CRM (Dirección, Tablero, Asesor y Recuperación, con su configuración), la
tabla de Kommo en Reportes › Por agente con su CSV y el cruce del detalle del estimado con los
contactos de Kommo. La guía «Antes en Kommo → Ahora aquí» se queda (P-10) y S0 no toca ninguno de
sus archivos. `patch_price` y `patch_stage` van en S2, así que no se tocan.

## COMPLETADO

- **CRM** (`app/studio/(app)/crm/`):
  - `_components/kommo-tabs.shared.ts`: agrega `KOMMO_TABS_OCULTAS` (direccion, tablero, asesor,
    recuperacion) y `CRM_TAB_POR_DEFECTO = "embudos"`. `resolveKommoTab` manda a la pestaña por
    defecto cualquier pestaña oculta o valor desconocido. `KOMMO_TABS` (la barra) se deriva de la
    lista completa, que se conserva, y hoy es solo Embudos.
  - `page.tsx`: si la pestaña no es de Kommo, pinta Embudos y vuelve **antes** de leer el espejo
    (sin `getKommoOverview`, la analítica ni las demás lecturas). El camino de las pestañas de
    Kommo queda sin uso, no borrado.
  - `_components/KommoClient.tsx`: `overview` puede ser nulo. Sin `overview`, el encabezado no
    pinta el estado de conexión ni el último sync. El texto pasa a «Leads y clientes, por etapa.
    En Embudos, lo que mueves o guardas queda en Studio.» y el eyebrow a «Comercial» (antes:
    «Comercial · Integración»). `goTab` usa la pestaña por defecto nueva.
  - Recuperación de Kommo se oculta con las demás (H13): hasta R9 el Studio no tiene lista de
    recuperación, como dice la spec.
- **Reportes › Por agente:**
  - `lib/studio/reports/types.ts`: `CommercialByAgent.oculto`.
  - `lib/studio/reports/queries.ts`: `commercialByAgent` ya no lee nada y devuelve
    `oculto: true`. La lectura del espejo sigue como `commercialByAgentKommo`, sin consumidor.
  - `lib/studio/reports/export-csv.ts`: con `oculto` no sale el CSV.
  - `ReportesClient.tsx`, solo `ByAgentView`: muestra el aviso aprobado tal cual (P-9), «El
    desempeño por asesor se está pasando al CRM del Studio.» como título y «Vuelve a aparecer aquí
    cuando esté listo.» como descripción de `EmptyState`. Son las mismas palabras.
  - `reportes/page.tsx` no se toca: sigue llamando a `commercialByAgent(supabase)`.
- **Detalle del estimado:**
  - `cotizador/[code]/page.tsx` ya no llama a `findKommoContactsByPhone`.
  - `QuoteDetailClient.tsx` ya no recibe `kommoMatches` ni pinta «Coincide con el CRM». La sección
    de vincular por Shipping Mark sigue igual.
  - `findKommoContactsByPhone` sigue en `lib/studio/kommo-convert.ts`.
- **Spec:** §5 S0 queda con la allowlist exacta (archivos, pruebas nuevas, lo que no se tocó y lo
  que queda fuera), más una entrada en el historial (§13).

## Rojos previos (pruebas nuevas contra el código de `main` `ecadbac91`, sin cambios)

Corrida: `node node_modules/vitest/vitest.mjs run --pool=threads` con los cuatro archivos nuevos.
Resultado: **4 archivos rojos, 26 pruebas fallidas y 20 pasadas (46)**. Cada rojo salió por
comportamiento, no por un import roto:

| Prueba | Rojo antes del cambio |
|---|---|
| `crm/__tests__/guia-se-queda.test.ts` | `resolveKommoTab(undefined \| null \| "")` daba `direccion` (3). Los mutantes de la guía y el recorrido ya pasaban: son la propiedad que S0 no debe romper |
| `crm/__tests__/kommo-oculto.test.tsx` | `KOMMO_TABS` daba 5 pestañas; `?tab=` viejo, `otra`, `""` y `undefined` no abrían Embudos (7); la página lanzaba `S0: la página del CRM leyó Kommo (getKommoOverview)` con `{}`, cada pestaña de Kommo y `tab=embudos` (6); `?embudo=clientes` (1); encabezado (2). Total: 17 |
| `reportes/__tests__/por-agente-oculto.test.tsx` | `oculto` era `undefined`; el CSV salía con filas; no se veía el aviso; `commercialByAgentKommo` no existía (4) |
| `cotizador/__tests__/sin-cruce-kommo.test.ts` | la página contenía `findKommoContactsByPhone`; el detalle contenía `kommoMatches` (2) |

## VALIDACIÓN

Cierre según el diff, como pidió el encargo:

| Comprobación | Resultado |
|---|---|
| Las 4 pruebas nuevas | PASÓ: 46 de 46 |
| Vecinas: `app/studio/(app)/crm`, `reportes`, `cotizador`, `lib/studio/reports`, `lib/studio/guia`, `app/studio/_components/guia` y `url-filter-state-contract.test.ts` | PASÓ: 31 archivos, 519 pruebas. Incluye `stage-control.test.ts`, `crm-rename.test.ts`, `anclas.test.ts` y las de la guía, sin tocarlas |
| `scripts/__tests__/invoice-read-boundary.test.mjs` (vitest) | PASÓ |
| `tsc --noEmit` (después de `prune-next-types`) | PASÓ: exit 0 |
| ESLint sobre los 13 archivos tocados | PASÓ: 0 errores y 1 aviso de antes (`KommoClient.tsx`, `useEffect` de `LeadsTable`, `react-hooks/set-state-in-effect`; esa línea no cambió) |
| `node scripts/check-numbering.mjs` | PASÓ: sin números repetidos |
| `node scripts/build-docs-index.mjs --check` | PASÓ: índice sincronizado con 595 specs |
| `git diff --check` (con las nuevas en `-N`) | PASÓ |
| Archivos de la guía en `git diff --name-only origin/main` | PASÓ: 0 (`_components/guia/`, `lib/studio/guia/`, `guia-actions.ts`, `lib/i18n/*/guide.ts`, `(app)/layout.tsx`) |
| `/ui-check` | OK para commit, con 3 hallazgos no bloqueantes (abajo) |
| Revisión visual en el navegador | NO EJECUTADO: el Studio pide sesión y Supabase. La evidencia es el render de la página del CRM y de Reportes en las pruebas |
| `pnpm verify` | NO EJECUTADO: lo corre el Director General, según el encargo |

`/ui-check`, en resumen: (1) la barra queda con una sola pestaña hasta S3, a propósito, para que
no salte cuando lleguen Resumen y Sin atender; (2) el aviso de Por agente es un título largo, pero
es texto aprobado tal cual; (3) `aria-label="Tablero CRM"` es el nombre viejo, solo para lectores de
pantalla. Lo de A11Y-01 en las pestañas ya venía de antes y es de S3.

## COMMITS

- `88d479ca2` feat(studio): SDD-0614 — S0 oculta Kommo del Studio sin borrar nada (código y las
  cuatro pruebas).
- `7ce8d20dd` docs(studio): SDD-0614 — allowlist exacta de S0 y handoff del tramo.
- `530fd303e` Merge origin/main `7e75f7708` (#407, oficina y SDD-0615). Ningún archivo en común con
  S0. `docs/specs/README.md` se resolvió con el driver de `main` y se regeneró con
  `build-docs-index`: 596 specs y el árbol quedó limpio. `docs:check` y `sdd:check` dieron verde
  después del merge.
- El commit de este handoff, con los commits y el merge.

Diff contra `main` `7e75f7708`: 15 archivos, los de la allowlist de §5 S0 (13 de producto y
pruebas, la spec y este handoff).

**Después del merge no corrí vitest ni tsc.** El Subdirector le dio a E9 el turno de máquina. `main`
solo trajo archivos de oficina (`infra/oficina/`, `docs/organizacion/`, SDD-0615) y el índice, sin
archivos en común. El `merge-tree` del Subdirector sobre `88d479ca2` salió rc=0. Las pruebas de S0
vuelven a correr en el CI de la PR y en el `pnpm verify` del Director General.

## PR / BRANCH

Rama `claude/0614-s0-ocultar-kommo`, PR en borrador contra `main`. El número y el `headRefOid` se
leen con `gh pr view claude/0614-s0-ocultar-kommo --json number,headRefOid`. La rama no recibe más
commits después de publicar, para que el verde quede sobre el SHA publicado.

**Cruce con E9, resuelto (2026-11-07, Subdirector):** «Deja Embudos por defecto», como dice la spec.
E9 no toca `crm/page.tsx` ni `kommo-tabs.shared.ts`, y el `merge-tree` sobre `88d479ca2` da rc=0.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` del Director General sobre el SHA de la PR.
- La fusión la hace el Director General. Después, este Worker limpia su worktree y su rama, con
  evidencia.
- Casilla S0 de §9: se marca al fusionar, no en esta PR.

## FUERA DE ALCANCE DETECTADO

- `CrmEmbudosSlot.tsx:7-8` dice que Embudos «convive con las pestañas de Kommo durante F2». Desde
  S0 ya no convive. El archivo está en la allowlist de S3, no en la de S0.
- Ya sin consumidor, para 8.7: `DireccionTab`, `KommoBoardView`, `RecoveryTab`, `ConvertLeadDrawer`,
  `StageMapConfig`, `MarkboxFieldConfig`, el worklist de `KommoClient`, `commercialByAgentKommo`,
  `findKommoContactsByPhone` y `convertLeadToClientAction` con su envío del Shipping Mark. La prueba
  `kommo-oculto.test.tsx` fija que sigan en el repo: quitarlas en 8.7 pide actualizar esa prueba.
- El aviso de ESLint de `KommoClient.tsx` (`set-state-in-effect` en `LeadsTable`) ya venía de `main`.

## HANDOFF AL DIRECTOR

- La PR 0 de la 6.6 no tiene migraciones, no toca producción y no toca la guía.
- Sigue lo que dicen la spec y la decisión de Sam: Kommo se oculta, no se borra.
- Para fusionar: `pnpm verify` sobre el SHA que mande el Worker.
- El texto del encabezado del CRM es nuevo y es copy interno del Studio, no un texto aprobado. Si
  el Director General prefiere otro, el único que fija una prueba es «En Embudos, lo que mueves o
  guardas queda en Studio.» (`stage-control.test.ts` y `kommo-oculto.test.tsx`).

## Impacto documental

- Canónico actualizado: la spec 0614 (§5 S0 e historial). El índice `docs/specs/README.md` no cambia
  (`docs:check` en verde).
- Graphify, Archify y Obsidian: NO EJECUTADO. Los publica el Director General desde `main`
  integrado.
- `pnpm knowledge:status`: NO EJECUTADO. Lo lancé a las ~18:00Z y lo detuve a las 18:11Z sin
  salida, porque el Subdirector le dio a E9 el turno de máquina. Queda para el cierre del
  Director General.

## Cruce con E9 (P-13 de la SDD-0589), 2026-11-07

- El Subdirector avisó que el paso P-13 de E9 también toca `crm/page.tsx` y
  `kommo-tabs.shared.ts`, y pidió no cambiar la pestaña por defecto («es de S3, y P-13 cuenta con
  eso»).
- S0 la cambia de Dirección a Embudos porque la spec lo pide: §2.1, líneas 140-141 y 163-165; §8 y
  §9. Le mandé los hunks y el commit `88d479ca2` para el `merge-tree`, con el diff en las notas
  compartidas (`0614-s0-hunks-crm-page-y-tabs.diff`). Le pregunté si queda Embudos por defecto o qué
  tiene que abrir `/studio/crm` en S0.
- Contestó el mismo día: «tienes razón y me equivoqué. **Deja Embudos por defecto**». Lo que va en
  S3 es Resumen por defecto. No comparten archivos.
