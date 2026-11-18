# Handoff · SDD-0614 S0b-bis — respaldo de KPI del Dashboard (PR 0b-bis de la 6.6)

- **Owner:** Claude Worker «S0 · ocultar Kommo» (el mismo de la #415 y la #419). Encargo del
  Director General (opción 2), traído por el Subdirector de Chatwoot
  (`local_535053f4-40c2-4124-a280-63f4fc882820`) el 2026-11-07. Claim: `s0b-bis-angry-ellis`.
- **Ruta:** `DTD-worktrees/0614-s0b-kpi-respaldo`, con `node_modules` propio.
- **Rama:** `claude/0614-s0b-kpi-respaldo`, desde la cabeza de la #419,
  `e426a272fb3641109dbd023aeef209b4b1245561`. La #419 no se toca.
- **SDD:** [0614](../../docs/specs/0614-crm-reemplazos-kommo/spec.md): S0b-bis en §2.1, §5 (PR 0b-bis y
  allowlist), §8, §9 y §13.
- **Permisos del encargo:**
  - PR en borrador contra `main`, después de que se fusione la #419, trayendo `main` con el driver.
  - Push en un comando aparte. Sin merge.
  - Sin medir `user_dashboard_prefs` en producción.

## OBJETIVO ORIGINAL

El caso salió al medir S0b. Quien tenía guardado «Leads en pipeline» (`newLeads`, oculto en S0b)
como único KPI y algún widget abría el Dashboard sin ningún KPI. La razón: `isEmptyConfig` pide KPI
y widgets vacíos para caer al default.

Opción 2 del Director General:
- Si después de quitar lo oculto no queda ningún KPI, se usan los KPI del default de ese rol.
- Se conservan los widgets.
- Solo lectura y pintado, sin tocar la fila.
- En la misma PR va la corrección (a) de la frase del handoff de S0b.

## COMPLETADO

- **`lib/studio/dashboard/dashboard-types.ts`: `resolverConfigDashboard(raw, canAccess)`**, función
  pura.
  - Normaliza y filtra la config, igual que antes.
  - Si queda vacía del todo (sin KPI ni widgets), usa el default del rol, como siempre.
  - Si la config cruda traía un KPI oculto (`traiaKpiOculto`) y no queda ninguno, toma los KPI
    del default del rol y conserva los widgets y el período guardados.
  - **Límite de la regla:** el respaldo es solo por lo oculto. Quien guardó cero KPI a propósito
    sigue con cero. Una config que perdió sus KPI por permisos de rol, sin ninguno oculto, tampoco
    cambia: se comporta como antes de S0b-bis.
- **`app/studio/(app)/dashboard/page.tsx`:** las tres líneas que validaban y caían al default a mano
  (`:111-113`) pasan a una llamada a `resolverConfigDashboard`. No escribe nada. `DashboardClient`
  solo autosalva cuando el usuario cambia algo después de montar (`DashboardClient.tsx:76-125`),
  así que abrir el Dashboard no toca `user_dashboard_prefs`.
- **(a)** En `.agents/handoffs/0614-s0b-kommo-fuera-de-s0.md`, fila de la config guardada, la frase
  queda escrita para el comportamiento nuevo, con la nota de qué decía antes.
- **Spec:** S0b-bis con su allowlist exacta.

## Rojo previo

Sobre la cabeza de la #419, sin el cambio de producto, `kpi-respaldo.test.ts` dio **2 de 6 en
rojo**:

- admin esperaba `shipmentsActive, onTime, monthRevenue, invoicesDue, cbmInTransit` y abría con `[]`;
- commercial esperaba `shipmentsActive, onTime` y abría con `[]`.

Los cuatro controles ya pasaban:
- el default de cada rol es distinto;
- con otro KPI visible no hay respaldo;
- cero KPI a propósito sigue en cero;
- sin config, se usa el default.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `kpi-respaldo.test.ts` con el cambio | PASÓ: 6 de 6 |
| Mutante 1: sin la línea del respaldo | PASÓ: muere (2 rojos: admin y commercial) |
| Mutante 2: respaldo siempre, sin mirar lo oculto | PASÓ: muere (1 rojo: el control de cero KPI a propósito) |
| Vecinas: `lib/studio/dashboard`, `app/studio/(app)/dashboard`, `fase-c-rename`, `anclas` (la guía) e `invoice-read-boundary` | PASÓ: 8 archivos, 87 pruebas |
| ESLint sobre los 3 archivos de código y prueba | PASÓ: exit 0 |
| `tsc --noEmit` (sobre `54feff3a7`) | PASÓ: exit 0, 253 s |
| `build-docs-index --check`, `check-numbering` y `git diff --check` | PASÓ: 596 specs |
| `/ui-check` | NO APLICA: no cambia ninguna pantalla nueva. Pinta los mismos KPI del default con los mismos componentes |
| `user_dashboard_prefs` en producción | NO EJECUTADO a propósito (instrucción del Director General) |

## COMMITS

- `54feff3a7` fix(studio): S0b-bis, el Dashboard no abre sin KPI por un KPI oculto (código y prueba).
- El commit de docs: spec, frase (a) y este handoff.

## PR / BRANCH

Rama `claude/0614-s0b-kpi-respaldo`. Se publica en borrador contra `main` después de que se fusione la
#419, trayendo `main` con el driver.

## PENDIENTES DE ESTA TAREA

- Esperar la fusión de la #419, traer `main` con el driver, regenerar el índice si hace falta y
  publicar.
- Mandarle al Subdirector el SHA, el numstat y el rojo previo.
- Después de la fusión de esta PR: limpiar su worktree y su rama, con evidencia.

## FUERA DE ALCANCE DETECTADO

- **(b)** El subtítulo de Dirección (`direccion/page.tsx:106-107`, «Finanzas, operación y comercial
  en una vista») y el comentario `{/* Operación + comercial */}` (`:169`) todavía nombran lo
  comercial. Van en la próxima PR que toque Dirección.
- Una config que pierde todos sus KPI por permisos de rol, sin ningún oculto, sigue abriendo sin
  KPI si tiene widgets. Ya pasaba antes de S0b y queda fuera de la opción 2. Si el Director General
  quiere extender el respaldo a ese caso, es una línea en `resolverConfigDashboard`.

## Impacto documental

- Canónico: la spec 0614 (S0b-bis) y la fila corregida del handoff de S0b. El índice no cambia.
- Graphify, Archify y Obsidian: NO EJECUTADO. Los publica el Director General desde `main`.
