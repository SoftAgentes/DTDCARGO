# Cobros y órdenes de pago anulados fuera de los lectores — SDD-0494 — 2026-09-20

- Owner/sesión: Worker `keen-swirles-62b904`, Claude Opus 5.
- Director: pendiente de asignar. Revisa, fija el turno de `verify` e integra; el Worker no mergea.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/keen-swirles-62b904`.
- Rama: `claude/adoring-neumann-bdc596`, desde `main` = `f56e524556656daf6e154177620bde5253ff5389`.
- **Aislamiento**: el encargo pedía `harness-worktree start <slug>`, pero la sesión ya arrancó
  dentro de un worktree vinculado del contenedor `.claude/worktrees` (uno de los dos que el
  propio script reconoce, `CLAUDE_CONTAINER` en `scripts/harness-worktree.mjs:12`), sobre rama
  propia y limpia. `node scripts/harness-worktree.mjs guard` → **Guard OK**, y claim
  `claude-keen-swirles-62b904` adquirido antes de editar. Crear un segundo worktree habría
  dejado un árbol huérfano que después nadie puede borrar sin autorización, así que se trabajó
  acá. **Si el Director prefiere el contenedor Codex, decilo y lo muevo.**
- SDD: **0494**, reservada con `corepack pnpm sdd:next --reserve cobros-pagos-anulados-lectores`.
  Rama de reserva local `codex/sdd-reserve-0494-cobros-pagos-anulados-lectores`
  (commit `57707914`), **sin push**. Spec completa en
  [docs/specs/0494-cobros-pagos-anulados-lectores/spec.md](../../docs/specs/0494-cobros-pagos-anulados-lectores/spec.md).
- Autorización: encargo del Director/Sam en el turno de apertura. Cubre investigar, implementar,
  probar y commitear local. **No** incluye texto literal que autorice push ni abrir PR, ni
  merge, ni escritura en producción. **No se aplicó ninguna migración** (no hace falta ninguna).
  No se leyeron filas de negocio ni PII de producción: toda la evidencia es código, migraciones
  del repo y pruebas locales.
- Estado de tarea: **lista-para-revision**, con `pnpm verify` **NO EJECUTADO** (falta el turno).

## OBJETIVO ORIGINAL

Cuatro hallazgos de leer `main` `f56e5245` al preparar las guías de smoke de Cobranzas y
Tesorería, entregados como **leads a verificar**, no como conclusiones:

1. Un recibo de cobro anulado sigue visible y sigue contando en Cobranzas.
2. Lo mismo con las órdenes de pago a proveedor en Tesorería.
3. Una CxP saldada no se puede abrir, así que su orden no se puede anular.
4. Textos desactualizados y voseo.

Criterio fijado por Sam: **el filtro va en la capa de consulta, no tocando la RLS**; la 0470
está aplicada a producción y no se edita. Si hiciera falta migración, declararla como espera en
`pendingBelowCutoff` y avisar — **no aplicarla**.

## VERIFICACIÓN DE LOS LEADS

Los cuatro se confirmaron en código antes de tocar nada:

- **H1 y H2 — confirmados, y la causa es la que se sospechaba.** Anular NO es un status: ni
  `payment_receipts` ni `supplier_payments` tienen columna de estado, y las RPC
  `void_collection_receipt` (0467) / `void_supplier_payment_order` (0468) marcan `deleted_at`.
  La 0230 sacó ese filtro del `USING` de las policies `FOR ALL` y dejó escrito que lo haría la
  capa de aplicación; la 0470 (`:186-191`) conservó ese criterio. Y la capa de aplicación no lo
  hacía: `grep 'deleted_at' lib/studio/payment-queries.ts` daba **un solo** `.is`, el de
  `receivablesQueue` (SDD-0465), y `lib/studio/treasury/bill-queries.ts` **ninguno**.
- **Dato que refuerza que es un defecto y no un criterio**: Reportes, Fiscal, Partner-finance y
  los recibos elegibles de rendiciones **sí** piden `.is("deleted_at", null)`. Cobranzas y
  Tesorería eran las dos excepciones.
- **H3 — confirmado.** `buildPayablesQueue` descarta `balance <= 0`, el drawer sale solo de
  `payables.find(...)` (`TesoreriaClient.tsx:79`) y las filas del tab «Pagos» no tenían
  `onClick`. El «Anular» de una orden vive solo en ese drawer (`BillDrawer.tsx:634`).
- **H4 — confirmado**, y había **más voseo del listado**: un segundo «Sembrá» en el mismo
  `BillDrawer.tsx:453` y otro en `facturacion/_components/InvoiceDetailClient.tsx:526`.

## COMPLETADO

- **H1** · `lib/studio/payment-queries.ts`: `listReceipts`, `searchReceipts`,
  `getReceiptByCode`, `listUnidentifiedReceipts` y `fundsSeparationSummary` piden
  `deleted_at is null`. Se corrigieron los comentarios que decían «vivos» y el que afirmaba que
  «RLS … excluye anulados», que era falso.
- **H2** · `lib/studio/treasury/bill-queries.ts`: `listPayments` pide `deleted_at is null` — lo
  que arregla de una vez el tab «Pagos», el historial del drawer y el KPI de pagado, porque los
  tres salen del mismo lector.
- **H3** · `payableForBill` (nueva, `bill-queries.ts`) + `getPayableForBill` (server action) +
  la fila del tab «Pagos» abre la CxP de su orden, con clic, teclado, estado de carga y la
  columna «CxP origen» convertida en afordancia («Ver CxP»). Se extrajo `buildPayable` pura para
  que la cola y la consulta no deriven el `stage` distinto. **No se relajó la cola**: sigue
  mostrando solo CxP con saldo, que es lo correcto para una cola de pagos.
- **H4** · voseo → tuteo en `CobranzaDrawer.tsx`, `BillDrawer.tsx` (×2) e
  `InvoiceDetailClient.tsx`. El texto «(los anulados no se muestran)» de
  `cobranzas/recibo/[code]/page.tsx:110` **se conserva sin cambios porque el arreglo lo hizo
  verdadero**: era falso y ahora describe el comportamiento.
- **Hallazgo lateral reparado**: `listBills` tampoco pedía `deleted_at is null`, así que una CxP
  borrada entraba a la cola y sumaba en el KPI «Por pagar». Lo destapó el fixture de regresión
  de esta tarea. Está **fuera del encargo** y se reparó acá porque es el mismo defecto de una
  línea, en el mismo archivo y en la misma ruta de dinero. **Era latente, no observable**: hoy
  ningún camino de la app pone `deleted_at` en una CxP (anular una CxP es `status = 'anulada'`,
  0294). Justificado en la spec § Alcance.

### Migración: NO hace falta, y NO se declaró ninguna espera

Se evaluó explícitamente. La marca ya existe, los índices parciales ya la contemplan
(`sp_tenant_bill_idx ... where deleted_at is null`, 0088) y las RPC ya la respetan.
`supabase/migrations-baseline.json` **no se tocó** y **no se agregó nada a `pendingBelowCutoff`**.

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `tsc --noEmit` | **PASÓ** (exit 0; `PIPESTATUS[0]` leído aparte, no el de `head`) |
| `pnpm lint` | **PASÓ** — 0 errores. 15 warnings, **ninguno en archivos de esta tarea** (son de `DocumentCalculator.tsx` y `knowledge-vault.mjs`, preexistentes) |
| Pruebas nuevas (20 casos) | **PASÓ** — `lib/studio/__tests__/documentos-anulados-cobros-pagos.test.ts` |
| **Mutante** (quitar los 9 `.is("deleted_at", null)`) | **PASÓ** — 11 de 20 casos fallan. Los 9 verdes son los «control del doble» (que afirman el comportamiento SIN filtro) y los de `stage`/id vacío. Archivos restaurados desde copia y reverificados |
| Suites vecinas (7 archivos, 152 casos) | **PASÓ** — `receivables-queue`, `treasury/__tests__`, `collections-identify`, `global-search` |
| `rbac-actions-guard` + `rbac-view-guard` (112 casos) | **PASÓ** |
| `pnpm docs:check` | **PASÓ** — índice sincronizado, 481 specs |
| `pnpm sdd:check` | **PASÓ** — sin números repetidos |
| `pnpm verify` | **NO EJECUTADO** — falta el turno del Director (regla: una corrida pesada a la vez) |
| Pruebas de DB efímera / Docker | **NO APLICA** — esta tarea no agrega ni cambia SQL |

El fixture de regresión es **infeliz a propósito**: la fila anulada es siempre la más reciente
(encabeza los `order by ... desc`) y la de monto más grande (domina cualquier suma). El doble
**aplica** los filtros como PostgREST y devuelve **copias**. Cada bloque lleva su caso «control
del doble» con el mismo fixture pero todo vivo: sin filtro, la separación de fondos da 17.500 en
vez de 1.500, el KPI de pagado 6.400 en vez de 400 y «Por pagar» 6.000 en vez de 1.000.

## COMMITS

Ver `git log main..claude/adoring-neumann-bdc596`.

## PR / BRANCH

- Rama `claude/adoring-neumann-bdc596`, **sin publicar**.
- **PR no abierta**: el encargo no trae texto que autorice publicar. Con el OK del Director hago
  un solo push de esta rama a sí misma y abro la PR contra `main`.

## PENDIENTES DE ESTA TAREA

1. **`pnpm verify`** — pedirle el turno al Director y correrlo. Es el único cierre canónico que
   falta.
2. **Smoke en pantalla**, que ninguna prueba unitaria sustituye:
   - `/studio/tesoreria` → tab «Pagos» → clic en una fila cuya CxP esté saldada → debe abrir el
     drawer de la CxP con su historial y el botón «Anular» de la orden; «Registrar pago» y
     «Anular CxP» deben estar ocultos (saldo 0 y pagado > 0).
   - Anular esa orden → la CxP recupera saldo y vuelve a la cola; la orden desaparece del tab.
   - `/studio/cobranzas` → con un recibo anulado en el tenant: no debe salir en el historial del
     drawer, ni en el detalle de la factura, ni en la bandeja amarilla, ni en el ⌘K; su URL
     `/studio/cobranzas/recibo/<code>` debe dar «No existe ese recibo»; y «Separación de fondos»
     no debe sumarlo.
   - Roles: hacerlo con `accounting` **y** con un rol operativo, para confirmar que el gate de
     vista del módulo sigue igual.
3. **Conocimiento**: `pnpm knowledge:status` y los derivados de Graphify/Archify **no se
   corrieron** (son corridas pesadas y el turno no está dado). El impacto documental de esta
   tarea es la spec 0494 y este handoff. Queda para el cierre con el Director.

## FUERA DE ALCANCE DETECTADO

1. **El espejo del H3 en Cobranzas existe y es PEOR. Es lo más importante de esta lista.**
   Verificado con archivo:línea:
   - `receivablesQueue` también descarta las facturas sin saldo (`payment-queries.ts:522-524`),
     el `CobranzaDrawer` solo se abre desde esa cola (`CobranzasClient.tsx:98-101`, `:263-269`),
     y el «Anular» de un recibo vive **solo** ahí (`CobranzaDrawer.tsx:1035-1042`).
     → **Si un cobro salda la factura, ese recibo no se puede anular desde ninguna pantalla.**
   - Un recibo `recibido_sin_ref` **no se puede anular nunca**: la bandeja amarilla solo ofrece
     «Identificar» y «Ver recibo» (`CobranzasClient.tsx:528-542`), y no puede aparecer en el
     historial de ningún drawer porque no tiene factura. `voidReceiptFor` **sí** lo soporta
     (`collections-actions.ts:470-476`): es un hueco puramente de UI.
   - El filtro «Pagado» de `STAGE_FILTERS` (`CobranzasClient.tsx:58-65`) es **código muerto**:
     `derivedStage` solo devuelve `"pagado"` con `balance <= 0` (`payment-queries.ts:445`), y
     esas facturas ya salieron de la cola. La UI promete un camino que no existe.
   - **Por qué no lo arreglé acá**: en Tesorería el tab «Pagos» ya existía y solo faltaba hacerlo
     clicable. En Cobranzas no hay superficie equivalente, así que abrir ese camino es una
     **decisión de producto** de Sam (¿un tab de recibos? ¿«Anular» en el detalle de factura?
     ¿en la bandeja amarilla?), no una reparación mecánica.
2. **`getBill` es código muerto.** `bill-queries.ts:130`, sin ningún consumidor en el repo (grep
   `getBill(` sobre `.ts`/`.tsx`: solo su propia definición). Tampoco filtra `deleted_at`.
   Borrarlo o usarlo es otra tarea.
3. **`p.bill_id ? "vinculada" : "—"`** era una rama inalcanzable: `supplier_payments.bill_id` es
   `uuid not null` (0088:105) y `coercePayment` hace `String(row.bill_id)`, que nunca da falsy.
   Esta tarea reemplazó ese texto por la afordancia del clic, así que el punto queda resuelto de
   hecho; se anota por si aparece el mismo patrón en otra tabla.
4. **Voseo en otros módulos**, no tocado por no ser de esta tarea:
   `costing/_components/CostingClient.tsx:303` («Identificá») y
   `conversaciones/conversations-types.ts:358` («Abrí tu caso») — este último es una plantilla de
   mensaje **al cliente**, así que su tono puede ser deliberado: preguntar antes de cambiarlo.
   También hay voseo en mensajes de aserción de varios tests, que son para quien programa.
5. **`ADVISORY` de `sdd:next`**: colisiones históricas de números entre fuentes (specs 0068,
   0172, 0435; migraciones 0020, 0057, 0058, 0124, 0243, 0247, 0261, 0268, 0277, 0297, 0336,
   0342, 0362, 0363, 0394). `sdd:check` las marca «choque histórico ya aplicado en prod, NO se
   renumera». Se reporta como estado conocido, no como algo a tocar.

## HANDOFF AL DIRECTOR

Lo que necesito de vos, en orden:

1. **Turno para `pnpm verify`.** Es el único cierre canónico pendiente.
2. **Autorización para publicar**: push de `claude/adoring-neumann-bdc596` a sí misma y abrir la
   PR contra `main`. Con el texto literal, lo hago sin volver a preguntar.
3. **Decisión sobre el worktree**: se trabajó en el contenedor `.claude/worktrees` en vez de
   crear uno nuevo con `harness-worktree start` (razón arriba). Si querés el contenedor Codex,
   lo muevo antes de publicar.
4. **Escalar a Sam el punto 1 de FUERA DE ALCANCE.** Un cobro que salda su factura y un pago
   sin identificar son, hoy, **irreversibles desde la UI**. Es el mismo agujero que esta tarea
   cerró en Tesorería, y ahí sí necesita una decisión de producto.

No requiere OK nominal de Sam para migraciones ni para producción: esta tarea **no genera SQL ni
toca la base**.
