# Handoff · SDD-0542 · Dashboard: los enlaces internos llevan a una pantalla que existe

| Campo | Valor |
|---|---|
| Fecha | 2026-10-16, Caracas 03:55 a 04:30 aprox. (UTC 07:55 a 08:30) |
| Task ID / owner | `dashboard-enlace-cobranza` / sesión Worker del worktree `sharp-euclid-839548` |
| Claim del harness | `claude-sharp-euclid-839548` (se libera al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\sharp-euclid-839548` |
| Rama | `claude/sharp-euclid-839548` |
| Base | `origin/main` `6da8aebc` (merge de la #244); el 2026-10-16 se mergeó `origin/main` `8761618d` (#247, SDD-0539) en la rama (`eca1977b`), ver «Merge de main» |
| SDD | [0542](../../docs/specs/0542-dashboard-enlace-cobranza/spec.md), `in-progress`. `sdd:next` propuso la 0542, fuera de las tomadas (0539–0541). Reserva local `codex/sdd-reserve-0542-dashboard-enlace-cobranza` (`fe5b407e`), sin push; entró a esta rama por cherry-pick (`c2aa45c9`) |
| Estado de la tarea | lista para revisión; PR en borrador porque main está congelado durante el corte del servidor |
| Permisos | commits selectivos, push de la rama propia y PR contra `main` en borrador, sin fusionar. Sin producción ni base de datos. `pnpm verify` no ejecutado: requiere turno del Director |

## OBJETIVO ORIGINAL

El Director encontró el 2026-10-16 en producción, con la sesión de admin de Sam,
que la alerta «N factura(s) vencida(s) · Gestionar cobranza» del Dashboard
(`app/studio/(app)/dashboard/page.tsx:258`) enlaza a `/studio/invoices`, que
responde 404. Pedido:

1. decidir el destino correcto leyendo Cobranzas, Facturación y sus gates;
2. corregir el enlace;
3. buscar otros `href` del Studio a rutas inexistentes y anotarlos o corregirlos
   si son triviales;
4. una prueba de contrato que falle si un `href` interno del Dashboard apunta a
   una ruta sin `page.tsx`, con control rojo del enlace viejo.

## COMPLETADO

- **Destino: `/studio/cobranzas`, sin query.** Es la cola de cobranza (registrar
  cobro, promesas, gestión); toma las facturas con saldo y las ordena por
  vencimiento, así que las vencidas que cuenta el KPI quedan arriba. El gate no
  cambia quién llega: la alerta exige `invoices` y Cobranzas `collections`,
  ambos `["accounting"]` (+admin) y fijados así por `MONEY_MODULES`. Cobranzas
  no tiene filtro por URL (su filtro de etapa es estado del cliente), así que no
  había un filtro existente que usar. Descartado
  `/studio/facturacion?tab=overdue`: el filtro existe y coincide con el conteo,
  pero es la pantalla de emitir y la alerta dice «Gestionar cobranza».
  Razonamiento con citas en la spec.
- **Otros dos enlaces rotos en el propio Dashboard, corregidos** (sin ellos la
  prueba de contrato no puede quedar verde):
  - «Calendario →» (`DashboardWidgets.tsx:227`): `/studio/calendar` →
    `/studio/calendario`. Los roles de `tracking` (módulo del widget) están todos
    en `calendar`.
  - «Nuevo estimado» (`:317`, antes `:315`): `/studio/quotes/nuevo` →
    `/studio/cotizador`. El cotizador abre el alta con un botón, no por URL: el
    enlace lleva al listado, donde está «+ Nueva cotización».
- **Prueba de contrato**
  `app/studio/(app)/dashboard/__tests__/dashboard-enlaces-existen.test.ts`
  (entorno node, 9 pruebas): lee los `href` con `/studio…` de
  `app/studio/(app)/dashboard/` (sin pruebas), `lib/studio/dashboard/` y
  `lib/studio/dashboard-queries.ts`, y los resuelve contra las carpetas de
  `app/studio/` con `page.*` con las reglas del App Router (grupos y slots
  transparentes, privadas fuera, `[x]`, `[...x]`, `[[...x]]`, sin query ni
  hash). Un `${…}` sólo casa con un segmento dinámico. Un inventario mínimo
  impide que pase en vacío. Trae el control con el texto viejo de la alerta y
  los dos otros enlaces viejos.
- **Barrido de todo el Studio**: script temporal en el scratchpad (no entra al
  repo) sobre los literales `"/studio/…"` de `app/`, `lib/`, `components/`,
  `hooks/` y `proxy.ts`. Lo que encontró fuera del Dashboard está abajo.

## VALIDACIÓN

Todo sobre el worktree de arriba, base `6da8aebc`.

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run "app/studio/(app)/dashboard/__tests__/dashboard-enlaces-existen.test.ts" --reporter=verbose` | la prueba nueva | PASÓ: `Tests 9 passed (9)`, exit 0 |
| Mutantes sobre el código real (script `mutantes.mjs` del scratchpad; restaura en `finally`) | 4 mutantes, uno por vez, con la ruta entre comillas para el shell | los 4 MUERTOS con exit 1, línea `Tests … failed` y el `href` nombrado: `page.tsx:260 → /studio/invoices`, `DashboardWidgets.tsx:227 → /studio/calendar`, `:317 → /studio/quotes/nuevo` y `:187 → /studio/naviera/${s.id}` (interpolado bajo una ruta sin segmento dinámico). `git status` después: sólo los cambios de la tarea |
| `vitest run "app/studio/(app)/dashboard" "lib/studio/dashboard"` | lo tocado y las pruebas vecinas del Dashboard | PASÓ: `Test Files 4 passed (4)`, `Tests 46 passed (46)`, exit 0 |
| `eslint --max-warnings=0` | los tres archivos de código | PASÓ (exit 0, sin salida) |
| `corepack pnpm typecheck` | repo completo | PASÓ (exit 0; `[tipos-de-ruta] sanos`) |
| `corepack pnpm docs:check` | índice de specs | PASÓ tras `docs:index` (525 specs) |
| `corepack pnpm sdd:check` | numeración | PASÓ («sin números repetidos»; choques históricos de migraciones ya conocidos) |
| `corepack pnpm governance:check` | cápsula | PASÓ (28 políticas, cápsula vigente) |
| `corepack pnpm components:check` | registro CMP | PASÓ |
| `git diff --check` | diff de la tarea | PASÓ |
| `/ui-check` | — | NO APLICA: cambia el destino de tres enlaces, no texto, estilo ni estructura |
| Comprobación en el navegador | — | NO EJECUTADA: requiere sesión del Studio con datos; la prueba de contrato cubre la existencia de la ruta, no el render |
| `pnpm verify` | completo | NO EJECUTADO: requiere turno del Director (una corrida pesada a la vez) |

## Impacto documental y conocimiento

- Canónicos actualizados: spec 0542 y `docs/specs/README.md` (índice).
- Sin cambios de arquitectura, RBAC ni datos: Graphify y Archify no cambian de
  forma. `knowledge:status` (exit 0, `ok: false`): estructural `INVALID`, semántico `INVALID`, `mainRevision` y `origin/main` en `6da8aebc`. Es el estado de un worktree sin derivados de Graphify, no lo causa esta tarea. No se reconstruyeron derivados
  aquí; los publica el Director desde main integrado.
- Obsidian: sin cambios.

## Merge de main

Auto-fix avisó que la PR quedó en conflicto con `main` tras fusionarse la #247
(SDD-0539, transportistas y migración 0491). Se mergeó `origin/main` `8761618d`
con el driver de `scripts/merge-generated-records.mjs` tomado de main, sin
rebase ni force push. El único choque era `docs/specs/README.md` y lo resolvió
el driver: después de `docs:index` el árbol quedó limpio. Lo que trajo main no
toca el Dashboard ni agrega carpetas con `page.tsx` bajo `app/studio/`.

| Comprobación tras el merge | Resultado |
|---|---|
| `corepack pnpm docs:check` | PASÓ (526 specs) |
| `corepack pnpm sdd:check` | PASÓ |
| `vitest run "app/studio/(app)/dashboard"` | PASÓ: 9/9 |
| `corepack pnpm typecheck` | PASÓ (exit 0) |

## COMMITS

| Hash | Propósito |
|---|---|
| `c2aa45c9` | reserva SDD-0542 (cherry-pick del commit de reserva `fe5b407e`) |
| `46b50c48` | `fix(studio)`: los tres enlaces y la prueba de contrato |
| `182d74e9` | `docs(sdd)`: spec e índice |
| `d6d920d0` | handoff |
| `eca1977b` | merge de `origin/main` `8761618d` (#247), índice resuelto por el driver |
| commit que contiene este cambio | handoff: merge de main y revalidación |

## PR / BRANCH

Rama `claude/sharp-euclid-839548`, base `main`, PR en **borrador** (main
congelado durante el corte del servidor). Sin fusionar.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` completo, con turno del Director.
- Pasar la PR de borrador a lista cuando se descongele main.
- Estado SDD a `done` al integrar, si la revisión acepta.

## FUERA DE ALCANCE DETECTADO

Del barrido de todo el Studio (detalle en la spec):

1. **CN · `app/studio/(app)/cn/_components/NewReceiptDrawer.tsx:178` y `:186`**
   → `/studio/cn/${code}`: no hay `cn/[…]/page.tsx`. «Abrir recibo» del aviso y
   «registrar y abrir» llevan a 404. Destino por decidir en el módulo
   (candidato: `/studio/cn?q=${code}`, que el listado ya lee).
2. **Mis bugs · `app/studio/(app)/mis-bugs/page.tsx:109`** →
   `/studio/mis-bugs/${bug.id}`: no hay `mis-bugs/[id]/page.tsx` desde la
   SDD-0036. Tocar una tarjeta lleva a 404.
3. **Acciones rápidas sin gate**: `quickActions` es `module: null`, pero sus
   destinos tienen gate (p. ej. `accounting` ve «Recepción CN» y no puede entrar
   a `cn`). No es 404; es un enlace a una pantalla denegada.
4. **Comentario vencido en `proxy.ts:130`**: nombra `/studio/reset/confirmar`,
   retirada en `d793c01d`. Sólo el comentario.

Falsos positivos del barrido, ya resueltos: `/studio/kommo` y `/studio/leads`
(redirecciones en `next.config`), los literales de pruebas y la documentación de
`lib/studio/rbac.ts` y `lib/studio/modules.ts`.

Los puntos 1 y 2 son defectos visibles al usuario. La prueba de esta SDD cubre
el Dashboard; extenderla a todo el Studio los encontraría hoy.

## HANDOFF AL DIRECTOR

1. Revisar la PR: destino de la alerta (`/studio/cobranzas` y no
   `/studio/facturacion?tab=overdue`) y los otros dos enlaces del Dashboard.
2. Dar turno para `pnpm verify` o correrlo al integrar.
3. Integrar con autorización cuando se descongele main. Si entra otra spec
   antes, el índice choca en GitHub y lo resuelve el driver de merge del índice
   (o `docs:index` tras el merge).
4. Decidir si los puntos 1 y 2 de FUERA DE ALCANCE van en una tarea propia
   (arreglo de los dos destinos + extender esta prueba al Studio entero).
5. Al integrar: estado SDD `done`; la reserva local
   `codex/sdd-reserve-0542-dashboard-enlace-cobranza` se puede borrar una vez la
   spec esté en main.

Sesiones consumidoras: ninguna. Ownership liberado al cerrar esta sesión.
