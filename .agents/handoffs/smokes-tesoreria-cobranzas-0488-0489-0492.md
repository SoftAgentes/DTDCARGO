# Bloques 5 y 6 del guion de smokes: Tesorería y Cobranzas — 2026-09-20

- Owner del claim: `claude-smokes-tesoreria-cobranzas-20260920` (sesión Worker, Claude Code).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/alibaba-guide-registration-services-d3f97c`.
- Rama: `claude/trusting-hodgkin-40181c`, desde `main` `f56e5245`.
- Encargo: agregar al guion de Sam los dos módulos que entraron a producción el 19 y el 20 de
  septiembre (UTC), con el mismo formato de los bloques 1 a 4, y corregir la nota de la PR #114.
- SDD: **no aplica**. Es un entregable documental de coordinación y no cambia comportamiento de
  producto ([AGENT-BRIEF](../../docs/governance/AGENT-BRIEF.md), paso 3 de la secuencia mínima: el
  SDD con allowlist lo exige el cambio de comportamiento, y acá no lo hay).
- Migración: **no aplica**. Las tres que cubren estos bloques ya están aplicadas por el Director.
- Permisos: commits selectivos en esta rama. Sin merge, sin producción y sin lectura de filas.
  Publicación de la rama y apertura de la PR autorizadas por el encargo; el merge lo decide el
  Director.

## OBJETIVO ORIGINAL

`.agents/handoffs/smokes-app-l14-0454-0472-guion.md` cubría los bloques 1 a 4 (clientes por rol,
factura de prueba, reportes de pago de L14, borrado de cliente). Faltaban Tesorería y Cobranzas,
cuyas migraciones ya están en producción y cuyo smoke es el último paso pendiente del release de
SDD-0489 y de SDD-0488.

## COMPLETADO

Un solo archivo tocado: `.agents/handoffs/smokes-app-l14-0454-0472-guion.md`.

- **Bloque 5 · Tesorería** (11 pasos): reconocer la pantalla, crear proveedor y CxP, pago parcial,
  anulación de la orden con su motivo obligatorio, reintento sobre la orden anulada, pago que salda,
  lectura de los totales, carrera de dos pestañas (opcional) y control de permisos por rol.
- **Bloque 6 · Cobranzas** (12 pasos): preparar cliente y factura propios, cobro parcial, anular el
  recibo, reintento, alta de un pago sin referencia, identificación contra la factura, cobro que
  salda, carrera (opcional), búsqueda por ⌘K y control de permisos por rol.
- **Tabla «Qué destraba cada bloque»**: dos filas nuevas con la fecha real de aplicación de cada
  migración en hora de Caracas, más una nota de que los bloques 5 y 6 son independientes entre sí y
  de los bloques 1 a 4.
- **«Antes de empezar»**: subsección propia para los bloques 5 y 6 con el rol exigido, el plan de
  cuentas que hace falta (caja/banco y costo/gasto, con el criterio exacto de cada uno), que no hace
  falta el Portal ni avisar al equipo, y la advertencia sobre las cabeceras de las migraciones.
- **«Qué queda en producción después de las pruebas»**: dos listas nuevas, con el proveedor que no
  se puede borrar, la CxP pagada, las dos órdenes de pago, los asientos que hay que anular aparte,
  los recibos y el pago identificado.
- **Nota de la PR #114**: corregida con la medición de hoy (ver más abajo).
- **Encabezado**: ahora dice qué sesión verificó cada mitad y contra qué `main`.

## EVIDENCIA VERIFICADA (`archivo:línea` contra `main` `f56e5245`)

Todo se leyó del código. **No se entró a producción ni se leyó ninguna fila.**

### Estado real de las tres migraciones

Las cabeceras de los tres `.sql` siguen diciendo «⚠️ NO APLICADA A PRODUCCIÓN» y declarándose
esperas: `0467_cobro_factura_atomico.sql:5-11`, `0468_pago_proveedor_atomico.sql:5-11`,
`0470_rls_escritura_cobros_proveedores.sql:5-13`. **Es texto viejo que no se edita por política**
(el ledger guarda el texto exacto; editarlo rompe la identidad por md5). El estado real:

| Migración | Commit que retira la espera | Ledger | Aplicada (Caracas) |
|---|---|---|---|
| 0467 (SDD-0488) | `1ad4a187` | `20260919021949` | 2026-09-18 22:19 |
| 0468 (SDD-0489) | `ef5b0d5d` | `20260920000508` | 2026-09-19 20:05 |
| 0470 (SDD-0492) | `98d0c548` | `20260920021300` | 2026-09-19 22:13 |

- `supabase/migrations-baseline.json` › `pendingBelowCutoff` tiene **solo** `0422` y `0423`
  (`cutoff: 238`), leído con `node -e` porque el archivo es UTF-8 y Python lo decodifica en cp1252.
- Los tres commits son ancestros de `f56e5245` (`git merge-base --is-ancestor`), igual que los
  merges de la app: `038cf894` (PR #157, Cobranzas), `b995b64d` (PR #169, Tesorería), `8d0f45d1`
  (PR #172, 0492).
- Las horas de Caracas salen de las specs, que las escriben así:
  `docs/specs/0488-carrera-cobro-factura/spec.md:296`, `docs/specs/0489-carrera-pago-proveedor/spec.md:331`,
  y `docs/specs/0492-rls-recibos-proveedores/spec.md:182-183` (esta en UTC; 02:13 UTC = 22:13 Caracas).
- El smoke que pide cada spec es exactamente el que cubren los bloques: «registrar un pago parcial y
  otro que salde una CxP, y anular una orden de pago» (`0489/spec.md:328-330`) y «cobrar,
  identificar un pago sin referencia y anular un recibo» (`0488/spec.md:293-294`).

### Rutas, roles y gates

- Tesorería es **una sola pantalla** sin subrutas: `Tab = "payables" | "payments" | "suppliers"` con
  los rótulos «Cuentas por pagar», «Pagos», «Proveedores» en
  `app/studio/(app)/tesoreria/_components/TesoreriaClient.tsx:50-56`; el tab es `useState` (`:73`) y
  los paneles también (`:74-77`). Por eso recargar vuelve al primer tab.
- Cobranzas sí tiene una subruta: `/studio/cobranzas/recibo/[code]`, el detalle imprimible de **un**
  recibo (`app/studio/(app)/cobranzas/recibo/[code]/page.tsx:78-79,100-103`; botón «Imprimir» en
  `recibo/[code]/PrintButton.tsx:18`). **No existe lista general de recibos**: `listReceipts` sólo se
  llama con `invoiceId` (`app/studio/(app)/cobranzas/actions.ts:217`,
  `app/studio/(app)/facturacion/[code]/page.tsx:66`) y la página carga cinco cosas, ninguna una lista
  de recibos (`app/studio/(app)/cobranzas/page.tsx:32-39`).
- Roles: `collections: ["accounting"]` y `treasury: ["accounting"]` en `lib/studio/rbac.ts:117,119`
  (admin es implícito). Los dos están en `MONEY_MODULES` (`rbac.ts:161-170`) y por tanto en
  `LOCKED_MODULES`, el candado inmutable (`rbac.ts:184-188`).
- Gates de vista: `app/studio/(app)/tesoreria/layout.tsx:13` y
  `app/studio/(app)/cobranzas/layout.tsx:12`. `requireModuleView` **redirige** a
  `/studio/dashboard?denied=<id>` (`lib/studio/rbac-guard.ts:117-119`) y el aviso que sale es «No
  tienes acceso a ese módulo. Si lo necesitas, pídele acceso a un administrador.»
  (`app/studio/(app)/_components/DeniedToast.tsx:28`).
- Gate de escritura en cada server action: `moduleEditDenial` → «No tienes permiso para realizar
  esta acción.» (`lib/studio/rbac-guard.ts:182,185`).

### Plan de cuentas que exigen los dos bloques

- Caja/banco: postable con `qbo_type === "Bank"` o código que empieza en `1.1.1`
  (`lib/studio/payment-queries.ts:631`).
- Costo/gasto: postable de tipo COGS/Expense/Other Expense o código que empieza en `5.` o `6.`
  (`lib/studio/treasury/bill-queries.ts:357-369`).

### Tesorería — comportamiento comprobado

- RPC: `register_supplier_payment_order` (`lib/studio/treasury/treasury-actions.ts:318-326`) y
  `void_supplier_payment_order` (`:378-381`).
- Mapeo de errores a texto visible: `treasury-actions.ts:80-90`. Los que usa el guion:
  `PAYMENT_ORDER_VOIDED` → «Esta orden ya está anulada.» (`:89`), `PAYMENT_BILL_PAID` → «La CxP ya
  está pagada: otro pago la saldó. Actualiza la página.» (`:86`), `PAYMENT_EXCEEDS_BALANCE` → «El
  monto supera el saldo vigente de la CxP: otro pago lo cambió. Actualiza la página.» (`:87-88`).
- Reglas de saldo y estado: al registrar, `paid + amount` y `>= total ⇒ pagada`, si no `parcial`
  (`supabase/migrations/0468_pago_proveedor_atomico.sql:225-227`); al anular,
  `greatest(0, paid - amount)` y `anulada` se conserva, `<= 0 ⇒ pendiente`, si no `parcial`
  (`:287-293`). La regla estricta de saldo (`PAYMENT_EXCEEDS_BALANCE` sin la tolerancia de 0,01) la
  eligió Sam al autorizar: `0468:42-46` y `:204-206`.
- Formulario de pago: «Monto a pagar ({moneda})» (`BillDrawer.tsx:413-415`), «Cuenta de caja / banco
  que paga» (`:442-444`), «Método» (`:474-476`), «Fecha» (`:491-493`), «Referencia (opcional)»
  (`:505-513`), botón «Confirmar pago» (`:529-531`). Ayuda «Pago total · salda la CxP.» / «Abono
  parcial · quedan $X pendientes.» (`:434-436`). **No hay campo de nota** pese a que el modelo lo
  admite (`:537-543` vs `lib/studio/treasury/types.ts:429`).
- Diálogo de anular: «Anular orden de pago», «La orden OP-… se anulará y se revertirá su saldo.
  Indica el motivo.», botón «Confirmar anulación», con `reason reasonRequired`
  (`BillDrawer.tsx:314-330`). **No pasa `reasonLabel`**, así que se pinta el default «Motivo
  (opcional)» (`ConfirmDialog.tsx:42`) aunque sea obligatorio; con menos de 4 caracteres el error
  llega del servidor: «Indica un motivo de al menos 4 caracteres.» (`lib/studio/audit/reason.ts:20`).
- Toasts: «Pago {total|parcial} registrado en {CxP} · orden {OP}» (`BillDrawer.tsx:220`), «Orden
  {OP} anulada · se revirtió el saldo» (`:348`), «CxP {código} creada · asiento de causación»
  (`:822`), «Proveedor {código} creado» (`SupplierDrawer.tsx:95`).
- **La CxP saldada desaparece y el panel se cierra solo**: la cola excluye `balance <= 0` y
  `status === "anulada"` (`lib/studio/treasury/bill-queries.ts:238-240`), y el panel se deriva de la
  cola con `payables.find(...)` (`TesoreriaClient.tsx:78-81`). Al refrescar tras un pago total, el
  `find` no encuentra nada y el panel se desmonta. **No hay reapertura de CxP desde la pantalla**:
  las únicas server actions son crear/editar proveedor, crear/anular CxP, registrar/anular pago y
  leer historial (`app/studio/(app)/tesoreria/actions.ts:67,129,174,194,210,240,255`).
- **Orden anulada sigue listada, sumando y con su botón «Anular»**: `listPayments` no filtra
  `deleted_at` (`bill-queries.ts:134-149`), la fila del historial pinta «Anular» sin guarda
  (`BillDrawer.tsx:628-637`), y los totales suman todo: «Pagado en el mes» en
  `bill-queries.ts:319-325` y «Pagado (histórico)» / «Remesas a China» en
  `TesoreriaClient.tsx:499-524`. «Por pagar» y «Vencido» sí quedan bien porque salen del saldo de la
  CxP.
- «Anular CxP» sólo aparece con `paid_amount === 0` (`BillDrawer.tsx:291`), por eso el guion no lo
  usa para limpiar.

### Cobranzas — comportamiento comprobado

- RPC: `register_collection_receipt` (`lib/studio/collections-actions.ts:184-196`),
  `identify_collection_receipt` (`:425-428`), `void_collection_receipt` (`:487-490`). Server
  actions: `app/studio/(app)/cobranzas/actions.ts:52,85,112,189`.
- Mapeo de errores: `collections-actions.ts:109-122`. Los que usa el guion:
  `PAYMENT_RECEIPT_VOIDED` → «Este recibo ya está anulado.» (`:121`), `PAYMENT_INVOICE_PAID` → «La
  factura ya está pagada: otro cobro o reporte la saldó. Actualiza la página.» (`:115-116`),
  `PAYMENT_EXCEEDS_BALANCE` → «El monto supera el saldo vigente de la factura: otro cobro o reporte
  lo cambió. Actualiza la página.» (`:117-118`).
- Reglas de saldo y estado: cobrar e identificar usan la misma fórmula, `paid + amount` y
  `>= total ⇒ pagada`, si no `parcial`
  (`supabase/migrations/0467_cobro_factura_atomico.sql:237-241` y `:317-321`); anular deja
  `greatest(0, paid - amount)` y **`emitida`** si el pagado llega a 0, conservando `borrador` y
  `anulada` (`:381-390`). Identificar no toca `received_at`: la imputación es retroactiva (`:310`).
- Numeración `R-AAAA-NNNN`: `'R-' || extract(year from current_date) || '-' || lpad(n, 4, '0')`
  (`supabase/migrations/0079_cobranzas.sql:97,107-108`), serializada por el lock consultivo
  `pg_advisory_xact_lock(488, hashtext(tenant))` de `0467:221-222`. **El año sale de la fecha del
  servidor, no del campo «Fecha»**, y los anulados no reciclan su número.
- Formulario de cobro: «Monto a cobrar ({moneda})» (`CobranzaDrawer.tsx:502-504`), «Cuenta de caja /
  banco» (`:531-533`), «Método» (`:563-565`), «Fecha» (`:580-589`), «Referencia (opcional)»
  (`:594-604`), «¿Quién realizó el pago?» con «Yo mismo (el cliente)» / «Un tercero» (`:609-651`),
  botón «Confirmar cobro» (`:743-746`).
- Diálogo de anular recibo: «Anular recibo», «El recibo R-… se anulará y se revertirá su saldo.
  Indica el motivo.», botón «Anular recibo» (`CobranzaDrawer.tsx:412-420`), con el mismo defecto del
  label «Motivo (opcional)». Toast «Recibo {código} anulado · se revirtió el saldo» (`:436`).
- Pago sin referencia: botón «Pago sin identificar» (`CobranzasClient.tsx:161`), drawer con «Monto
  recibido», «Moneda», «Cuenta de caja / banco», «Canal», «Fecha de recepción», «Referencia bancaria
  (opcional)» y «Notas (opcional)» (`UnidentifiedPaymentDrawer.tsx:117-251`). La bandeja «Sin
  identificar · N» sólo se renderiza si hay alguno (`CobranzasClient.tsx:205,471`).
- Identificar: botón «Identificar» (`CobranzasClient.tsx:535-541`) y drawer con «Cliente» y «Factura
  (saldo ≥ monto del pago)», que **sólo ofrece facturas de la misma moneda y con saldo suficiente**
  (`IdentifyPaymentDrawer.tsx:50-58,156-188`), con el resumen de imputación retroactiva (`:211-215`)
  y el botón «Identificar y aplicar» (`:232`).
- **La factura saldada desaparece y el panel se cierra solo**, igual que en Tesorería: la cola
  excluye `anulada` y `balance <= 0` (`lib/studio/payment-queries.ts:459-461`) y el panel se deriva
  con `receivables.find(...)` (`CobranzasClient.tsx:98-101`).
- ⌘K: faceta `payments` con rótulo «Pagos» (`lib/studio/global-search/facets.ts:56`,
  `lib/i18n/es-VE/chrome.ts:141`), que enlaza a `/studio/cobranzas/recibo/<código>`
  (`lib/studio/global-search/search-action.ts:202-210`). Es faceta de dinero, así que a un rol sin el
  módulo le sale con candado (`facets.ts:60-62`).

### Hallazgo de la revisión: la 0470 cambió qué se ve de un recibo anulado

Esto **no estaba en el encargo** y conviene que quede escrito, porque cambia lo que Sam va a ver.

- Antes, la policy `"payment_receipts by tenant"` filtraba `deleted_at is null`
  (`supabase/migrations/0079_cobranzas.sql:145-149`), y ningún lector de recibos filtra por código:
  ni `listReceipts` (`lib/studio/payment-queries.ts:125-140`), ni `getReceiptByCode` (`:206-223`),
  ni `listUnidentifiedReceipts` (`:228-240`), ni `fundsSeparationSummary` (`:307-322`), cuyo
  docstring todavía dice «Lee los recibos vivos del tenant (RLS)» (`:303-305`).
- La 0470 sustituyó esa policy por `payment_receipts_team_select`, **sin** `deleted_at is null`
  (`supabase/migrations/0470_rls_escritura_cobros_proveedores.sql:185-191`).
- Consecuencia, desde el 19-sep a las 22:13: un recibo anulado **vuelve a listarse** con su botón
  «Anular» visible, **sigue sumando** en «Separación de fondos · mandato», y su página
  `/studio/cobranzas/recibo/<código>` **abre** en vez de mostrar el vacío «No existe ese recibo.»,
  cuya descripción —«(los anulados no se muestran)»— quedó desactualizada
  (`app/studio/(app)/cobranzas/recibo/[code]/page.tsx:105-113`).

Es el mismo hueco que Tesorería ya tenía, y **hay otra sesión trabajándolo**: «Ocultar cobros y
órdenes anuladas en Cobranzas y Tesorería». Por eso el guion lo marca como «no es falla» en los dos
bloques, en vez de pedirle a Sam que lo reporte.

### PR #114 — la nota vieja se corrigió

El guion decía «va cuatro días atrás» y que había que traerse `main` y volver a validarla. Medido
hoy contra `main` `f56e5245`:

- `git merge-tree --write-tree --name-only origin/main b071a90f` sale **exit 0 y sólo el SHA del
  árbol**, sin lista de conflictos: **el merge es limpio**.
- La base es `b07ad98b`; desde ahí entraron **565 commits** a `main`.
- La PR toca **11 archivos, no 8** (lo dice `gh pr view 114 --json files` y lo confirma
  `git diff --name-only b07ad98b b071a90f`), y **ninguno** de los 11 tiene commits en `main` desde la
  base (`git rev-list --count b07ad98b..origin/main -- <archivo>` da 0 en los once).
- `gh pr view` la marca `mergeable: MERGEABLE` y `mergeStateStatus: BEHIND`. «BEHIND» sólo dice que
  la rama no tiene los commits nuevos de `main`, no que haya conflicto.

La nota del guion se reescribió con esto y **conserva** que fusionarla despliega a producción y que
necesita OK aparte de Sam.

## PRUEBAS

`pnpm verify` completo **no corresponde**: es el cierre canónico de producto y esta tarea no toca
código de producto. El diff es un solo archivo Markdown en `.agents/handoffs/`, que no entra en
ningún bundle, no tiene consumidores en tiempo de ejecución y no cambia comportamiento. Además,
lanzar un verify completo exige pedirle el turno al Director, y consumiría ~50 min de una máquina
compartida sin cubrir nada de este cambio.

Lo que sí se corrió, en este worktree, sobre el árbol con el cambio:

| Comprobación | Resultado |
|---|---|
| `corepack pnpm docs:check` | **PASÓ** — «índice sincronizado con 480 specs» |
| `corepack pnpm sdd:check` | **PASÓ** — «numbering: sin números repetidos» (los ⏸ son choques históricos ya conocidos) |
| `corepack pnpm governance:check` | **PASÓ** — «28 política(s) aprobada(s) · cápsula vigente» |
| `corepack pnpm components:check` | **PASÓ** — «CMP-01 válido: 5 fuente(s), agregado reproducible y cero rutas rotas» |
| `corepack pnpm skills:check` | **PASÓ** — manifiesto de skills íntegro |
| `node scripts/tests/knowledge-state.node.mjs --test-reporter=tap` | **PASÓ** — 9 de 9, 0 fallos |
| `node scripts/tests/knowledge-vault.node.mjs --test-reporter=tap` | **PASÓ** — 22 de 22, 0 fallos |

Por qué las pruebas de producto no aplican, una por una:

- **`typecheck` / `lint` / `build`**: no hay TypeScript, TSX ni configuración en el diff.
- **Vitest (unidad e integración)**: no hay módulo bajo prueba. Ningún test importa este archivo.
- **`test:e2e`**: no hay pantalla ni flujo nuevo; el documento describe pantallas que ya existen.
- **Contratos SQL en PGlite**: no hay migración nueva. Las tres que cubren los bloques ya tienen su
  `*.migration.test.ts` y sus pruebas de carrera, escritas en sus propias tareas.
- **`migrations-applied`**: da SKIP en todo worktree; el estado de las migraciones se verificó por
  los commits del ledger, no por ese gate.

Los dos scripts de conocimiento son los únicos que leen `.agents/handoffs/`
(`scripts/lib/knowledge-projection.mjs`, vía `scripts/tests/knowledge-state.node.mjs` y
`knowledge-vault.node.mjs`), así que son los únicos que este cambio podía romper. Se lanzaron con
`--test-reporter=tap` **con el handoff nuevo ya en disco**, y se leyó el conteo de casos, no sólo el
exit 0: 9 de 9 y 22 de 22.

## PENDIENTES DE ESTA TAREA

- Publicar la rama y abrir la PR contra `main`. **No fusionar**: integra el Director.
- El Director decide si este handoff entra al grafo de conocimiento y si toca revisar Graphify y la
  publicación en Obsidian al cierre.

## FUERA DE ALCANCE DETECTADO

Nada de esto se tocó. Todo está verificado `archivo:línea`.

1. **Recibos y órdenes anuladas siguen visibles y sumando.** Detalle arriba. **Ya hay una sesión
   trabajándolo** («Ocultar cobros y órdenes anuladas en Cobranzas y Tesorería»), así que esto es
   sólo corroboración: el hueco de recibos lo abrió la 0470 el 19-sep
   (`0470:185-191` contra `0079:145-149`) y el de órdenes ya existía
   (`bill-queries.ts:134-149,319-325`).
2. **Una CxP o una factura saldada no se puede reabrir desde la pantalla.** Al quedar sin saldo sale
   de la cola (`bill-queries.ts:240`, `payment-queries.ts:461`) y el panel se deriva de la cola
   (`TesoreriaClient.tsx:78-81`, `CobranzasClient.tsx:98-101`), así que no hay forma de llegar a su
   orden o recibo para anularlo. La RPC sí sabría revertirlo (`0468:287-293`, `0467:381-390`): falta
   el camino en la UI. Un error de monto en el pago que salda hoy sólo se arregla por base de datos.
3. **El diálogo de anular dice «Motivo (opcional)» y el motivo es obligatorio**, en los dos módulos:
   ninguno pasa `reasonLabel` (`BillDrawer.tsx:316-319`, `CobranzaDrawer.tsx:414-417`) y el default
   es «Motivo (opcional)» (`ConfirmDialog.tsx:42`). Con el campo vacío el diálogo sólo re-enfoca, sin
   mensaje (`ConfirmDialog.tsx:204-211`).
4. **Voseo contra la regla de tuteo del Studio**, en dos mensajes: «Sembrá el plan en Contabilidad
   para registrar pagos con asiento.» (`BillDrawer.tsx:453-455`), «Sembrá el plan en Contabilidad.»
   (`BillDrawer.tsx:799-800`) y «Sembrá el plan en Contabilidad para registrar cobros con asiento.»
   (`CobranzaDrawer.tsx:542-543`). El drawer gemelo lo dice bien: «Siembra el plan…»
   (`UnidentifiedPaymentDrawer.tsx:177-179`).
5. **Texto desactualizado por la 0470**: el vacío de la página de recibo dice «(los anulados no se
   muestran)» (`recibo/[code]/page.tsx:110`) y el docstring de `fundsSeparationSummary` dice «Lee
   los recibos vivos del tenant (RLS)» (`payment-queries.ts:303-305`). Las dos cosas dejaron de ser
   ciertas. Probablemente caigan con el punto 1.
6. **El alta de un pago sin referencia no toma el lock de numeración.** Inserta directo y llama
   `next_receipt_code` sin el `pg_advisory_xact_lock(488, …)` que sí usa la RPC
   (`collections-actions.ts:266-297` contra `0467:221-222`), y la tabla tiene
   `unique (tenant_id, receipt_code)` (`0079:43`): dos altas simultáneas pueden chocar y devolver
   «No se pudo registrar el pago: …». Es angosto —sólo el camino sin-ref— pero es la misma carrera
   que la 0467 cerró para el cobro.
7. **El asiento contable es best-effort en Tesorería**: si falla, sólo se hace `console.error` y el
   pago igual queda `ok` (`treasury-actions.ts:345-361`, y lo mismo al anular en `:388-396`). En la
   pantalla se ve como la columna «Asiento» en «—», sin ningún aviso.
8. **El formulario de pago y el de cobro no tienen campo de nota** aunque la RPC acepta `p_notes`
   (`0468:163`, `0467:172`) y el modelo lo declara (`lib/studio/treasury/types.ts:429`). Ver
   `BillDrawer.tsx:537-543` y `CobranzaDrawer.tsx:751-762`.

## Cómo retomar

El guion vive en `.agents/handoffs/smokes-app-l14-0454-0472-guion.md`; extiéndelo ahí en vez de
escribir uno nuevo. Los bloques 1 a 4 tienen su evidencia en `smokes-app-l14-0454-0472.md` y los
bloques 5 y 6 en este archivo.
