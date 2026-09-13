# L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta (0407, 0411–0413 → 0414)

Fecha: 2026-09-12. Task ID: `c-l07-fidelizacion-conversations`.
Owner / sesión escritora: `c-l07-fidelizacion-conversations-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras).
Rondas: dos, en la misma sesión. La 1 importa el lote y publica la PR #106 en `0d247073`. La 2 aplica la revisión del Director sobre ese head: sección de cambios visibles y frontera del Portal en la PR, test de inventario, esperas y notas, y vuelta atrás probada de 0407 y 0414. La ronda 2 no cambia código de producto ni SQL de migraciones desde `961ec85e`.
Estado de tarea: lista-para-revision. PR #106 en borrador. **MIGRATE-FIRST: no fusionar antes de aplicar y verificar 0407, 0411, 0412 y 0413.** 0414 va después del despliegue de esta PR y del smoke por roles. Release y aplicación de migraciones quedan fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`.
Rama: `codex/c-l07-fidelizacion-conversations`. Base: `origin/main` `bca98147672a6255192b62b247ab3f5c44061bb2`; comprobado sin cambios antes del verify, antes del push de la ronda 1 y al empezar la ronda 2.
Origen de solo lectura: `refs/dtd/pr/21` = `origin/codex/saneamiento-integral` = `ea9952a47f4adf14c48c91e6d0147597beb94aa7`. Base común con `main`: `2a2e81bf554dbe7bd4f05170847e8f02e988d320`. Commits de origen del lote: `ff3b4fa1` (SDD-0350), `a5d9c897` y `219f9400` (SDD-0354), `8b112b5a` (SDD-0355), `3ca9a79d` (SDD-0356) y `702de3f4` (SDD-0357).
SDD: `docs/specs/0350-invoices-write-rbac`, `0354-client-annual-billing-facade`, `0355-conversation-outstanding-facade`, `0356-sales-order-invoice-facade` y `0357-invoices-read-rbac`, con el frontmatter de origen (`status: done`) y nota de importación. Migraciones `0407_invoices_write_rbac`, `0411_client_annual_billing_facade`, `0412_conversation_outstanding_facade`, `0413_sales_order_invoice_facade` y `0414_invoices_read_rbac`, declaradas pendientes. Sin reserva de número: se conserva la numeración de origen; ninguna ref local o remota fuera de la PR #21 tiene esas migraciones ni esas carpetas de spec.
Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main`, autorizados por Sam. Prohibidos: merge, sacar la PR de borrador, deploy, aplicar migraciones, tocar el ruleset, borrar ramas o worktrees y leer filas de negocio.
Aceptación:
- L07 extraído desde la PR #21 con SQL, contratos, specs, código y pruebas, conservando lo que `main` agregó.
- Una espera por migración con orden obligatorio, locks medidos y párrafo literal de autorización, sin tocar `cutoff`.
- Declaración migrate-first de las tres RPC e índice de specs regenerado con el script.
- Cinco análisis antes de publicar: migrate-first por facade, inventario de lectores y escritores de `invoices`, paridad con controles rojos, datos personales y financieros, y locks con timeouts.
- `lock_timeout` y `statement_timeout` pre-autorizados en las migraciones con ACCESS EXCLUSIVE sobre `invoices`, con aserción estática.
- `corepack pnpm verify` completo sobre el head de código, con veredicto por paso y archivo meta.
- **Ronda 2:**
  - Sección «Cambios de comportamiento visibles al desplegar» en la PR.
  - Frontera del Portal de 0414 explícita en su espera y en la PR, con la ausencia de mensaje de error.
  - `invoice-read-boundary.test.mjs` importado si pasa contra el código real sin requerir código ausente, con control rojo.
  - Vuelta atrás de 0407 y 0414 escrita, probada con comparación de catálogo y citada desde las esperas.
  - Validación proporcional sin verify completo, con `git diff --stat 961ec85e..HEAD` limitado al test, las notas, las esperas y el handoff.

## OBJETIVO ORIGINAL

Extraer el lote L07 del bloque C desde la PR #21: el RBAC de escritura y lectura de `invoices` (0407 y 0414) y las tres facades que lo preparan, que son la facturación anual de Fidelización, CRM y Reportes (0411), el saldo de Conversaciones (0412) y las referencias de facturas de Órdenes de venta (0413). Traer su SQL, specs, código y pruebas, listo para revisión en una PR borrador contra `main`, sin aplicar nada a producción ni leer filas de negocio. Es el lote de mayor riesgo del bloque: restringe quién lee y escribe facturas.

Ronda 2, revisión del Director sobre `0d247073`. Acepta la PR en lo sustancial y decide seis puntos:
1. Acepta las divergencias de paridad y pide listarlas en lenguaje llano en la PR.
2. Acepta como intencional la frontera del Portal de 0414 y pide declararla, con la ausencia de mensaje de error, en la espera y en la PR.
3. Deja sin cambios la fuga del Portal mientras dimensiona su exposición con Sam.
4. Confirma fuera de alcance la página de Órdenes de venta.
5. Pide importar el test de inventario si pasa contra el código real.
6. Pide la vuelta atrás de 0407 y 0414, probada con comparación de catálogo.

## COMPLETADO

### Archivos y relación con el origen

Diff contra `origin/main` `bca98147`: 29 archivos más este handoff, 28 de la ronda 1 y el test de inventario de la ronda 2.

| Archivo | Relación con el origen |
|---|---|
| `supabase/migrations/0407_invoices_write_rbac.sql` | origen `fd09c451` más la cabecera de importación `:24-30` y los timeouts `:32-33`; preflight, DDL, ACL, comentario y postflight idénticos |
| `supabase/migrations/0411_client_annual_billing_facade.sql` | idéntico (`7d44ed29`) |
| `supabase/migrations/0412_conversation_outstanding_facade.sql` | idéntico (`e2c519ac`) |
| `supabase/migrations/0413_sales_order_invoice_facade.sql` | idéntico (`4d927a53`) |
| `supabase/migrations/0414_invoices_read_rbac.sql` | origen `2d10396e` más la cabecera `:4-10` y los timeouts `:12-13`; resto idéntico |
| `supabase/tests/0407_invoices_write_rbac.test.sql` | origen `3077b0dd` más la aserción estática y la comprobación en transacción `:92-119` |
| `supabase/tests/0411…`, `0412…` y `0413…test.sql` | idénticos (`fde20368`, `0e724c0f`, `4f72b295`) |
| `supabase/tests/0414_invoices_read_rbac.test.sql` | origen `f6a2f59d` más la anulación de los topes de 0407 `:130-133` y la aserción estática y comprobación `:136-163` |
| `lib/studio/fidelizacion/queries.ts` | idéntico (`2fe1bfe2`); `main` tenía el blob de la base común |
| `lib/studio/fidelizacion/__tests__/queries.test.ts` | idéntico (`bd5511d5`) |
| `lib/studio/reports/__tests__/queries.test.ts` | idéntico (`02541fde`) |
| `app/api/studio/conversaciones/[id]/route.ts` | idéntico (`964ac7d4`) |
| `lib/studio/conversaciones/conversations-queries.ts` | idéntico (`be3f333b`) |
| `lib/studio/conversaciones/conversations-types.ts` | `main` más sólo el comentario del saldo del origen (`:108`); conserva `STATUS_TONES.abierto = "info"` de `main` |
| `lib/studio/conversaciones/__tests__/conversaciones.test.ts` | `main` menos el import y el bloque de `aggregateOutstanding`; conserva la expectativa `info` de `main` |
| `lib/studio/conversaciones/__tests__/client-context.test.ts` | nuevo, idéntico (`c82f3013`) |
| `lib/studio/sales-orders/queries.ts` | `main` más sólo los trozos de SDD-0356: import de `fetchAllByIds` (`:16`), `SalesOrderInvoiceRef` sin fechas (`:207-212`) y `listInvoicesForSalesOrder` sobre `listInvoicesBySalesOrder` (`:218-262`) |
| `lib/studio/__tests__/orders-relations-batch.test.ts` | nuevo, recortado: el origen `e813f645` mezclaba SDD-0322 y SDD-0356 |
| `scripts/__tests__/invoice-read-boundary.test.mjs` | ronda 2: nuevo, idéntico (`97c82149`), sin ajustar su lista de lectores |
| las cinco `docs/specs/…/spec.md` | origen más la nota de importación; frontmatter intacto. En la ronda 2, las notas de 0350 y 0357 suman la vuelta atrás, la frontera del Portal y el test |
| `docs/specs/README.md` | regenerado con `node scripts/build-docs-index.mjs`: 444 specs; 0350 y 0354–0357 salen de la lista de huecos. La ronda 2 no lo cambia |
| `supabase/migrations-baseline.json` | cinco esperas; `cutoff 238`, `$doc` y la espera de 0451 idénticos a `main`, comprobado por valor. En la ronda 2 cambian sólo las esperas de 0407 y 0414 |
| `supabase/pending-migration-symbol-declarations.json` | tres declaraciones AMARILLO; `schemaVersion` y `$doc` idénticos a `main` |

La identidad se comprobó con `git hash-object` al importar y con `git rev-parse HEAD:<ruta>` contra `refs/dtd/pr/21:<ruta>`: el primer commit (`6330cb46`) guarda los diez SQL idénticos al origen y la desviación queda sola en el segundo (`b6fdf92f`). El test de la ronda 2 se comprobó igual en `e952e4bd`. Los SQL van byte a byte (`-text` en `.gitattributes`) y se comprobó con Node que ningún archivo tocado tiene CR.

### Solapamientos con `main` y resolución

- Desde la base común, `main` sólo tocó dos líneas del alcance: `STATUS_TONES.abierto` pasó de `warning` a `info` y su expectativa en el test. Se conservan; de esos dos archivos sólo entra lo de L07.
- En el origen, `lib/studio/sales-orders/queries.ts` y `orders-relations-batch.test.ts` mezclan SDD-0322 (commit `1faff60b`: `listPrealertasBySalesOrder`, columna `sales_order_id` de prealertas, ítems de compra y lectura de las páginas) con SDD-0356 (`3ca9a79d`). Entra sólo 0356. La spec 0322 está en `main` sin ese código. El test recortado conserva los casos de facturas (agrupación por RPC sin consulta por orden, error que no se vuelve vacío y lote vacío) y agrega uno: el helper de una orden delega en la misma RPC. En el cliente falso, `from` lanza para probar que no hay lectura directa.
- `digest-extract.ts` y `monthly-digest.ts`, que la PR #21 cambió en la misma carpeta por observabilidad, no entran.
- `scripts/__tests__/invoice-read-boundary.test.mjs`, de la allowlist de SDD-0357, quedó fuera en la ronda 1 y entró en la ronda 2 por decisión del Director (ver «Ronda 2»).
- No hubo merge ni conflicto textual: `origin/main` no se movió durante la tarea.

### Esperas y declaración

- `supabase/migrations-baseline.json`: una espera por migración, en el estilo de las PR #104 y #105. Cada una lleva lo que hace la migración, el orden obligatorio de L07, las lecturas de catálogo previas (0407), la condición transaccional literal de `set local` (0407 y 0414), locks y contención medidos, qué rompe en silencio (0414) y el párrafo literal de autorización. En la ronda 2, las de 0407 y 0414 remiten a la vuelta atrás probada, y la de 0414 declara la frontera del Portal.
- `supabase/pending-migration-symbol-declarations.json`: `studio_client_annual_billing`, `conversation_client_outstanding` y `sales_order_invoice_refs` quedan AMARILLO con su sitio de llamada y la evidencia del degradado. El gate da `0 ROJO · 3 AMARILLO`.

### Specs importadas

Las cinco conservan el frontmatter de origen. Cada nota de importación, con el patrón de `0352-bank-reconciliation-rbac`, registra el origen y sus commits, los cortes, la paridad medida, el estado real **pendiente de aplicar** y los archivos que entran fuera de su allowlist: los registros de pendientes y este handoff. Las notas de 0350 y 0357 registran además la desviación de timeouts y, desde la ronda 2, la vuelta atrás; la de 0357 suma la frontera del Portal aceptada y el test de inventario. Cada archivo del diff queda cubierto por la allowlist de alguna spec o por esas notas. El test de la ronda 2 ya estaba en la allowlist de 0357.

### Ronda 2

**Decisiones del Director aplicadas:**
1. **Divergencias de paridad, aceptadas.** El cuerpo de la PR #106 tiene «Cambios de comportamiento visibles al desplegar», con los siete cambios en lenguaje llano y lo que no tiene efecto visible.
2. **Frontera del Portal con 0414, aceptada.** La espera de 0414, la nota de 0357 y la PR la declaran explícita, sin mensaje de error, con la medición de abajo.
3. **Fuga del Portal.** Sin cambios en esta ronda; queda en manos del Director con Sam y 0414 conserva su lugar.
4. **Órdenes de venta y SDD-0322.** Fuera de alcance, en «FUERA DE ALCANCE DETECTADO» 3.
5. **Test de inventario.** Importado sin ajustes.
6. **Vuelta atrás de 0407 y 0414.** Escrita y probada, en la sección «VUELTA ATRÁS DE 0407 Y 0414».

**Test de inventario.**
- **Qué entra.** Entra idéntico al origen: blob `97c82149` en `e952e4bd`. Congela 45 llamadas directas `from("invoices")` en 18 archivos de `app/`, `lib/` y `supabase/functions/`, sin contar tests, comentarios ni ejemplos. Además comprueba que los widgets `monthRevenue`, `invoicesDue`, `pendingCollect` y `avgTicket` siguen en el módulo `invoices`, cerrado a overrides para los cinco roles no financieros.
- **Sin ajustes.** Su lista coincide archivo por archivo con el inventario AST de esta rama (`inventory-l07-head.txt`). Sus imports existen en `main`: `canAccessModule` (`lib/studio/rbac.ts:318`) y `KPI_CATALOG` (`lib/studio/dashboard/dashboard-catalog.ts:51`). No requiere SDD-0322, SDD-0390 ni otro código ausente.
- **Vitest lo descubre.** `vitest.config.ts` no restringe `include` y sólo excluye `node_modules`, `.next`, `.claude` y `e2e` (`:31`), igual que con los demás `scripts/__tests__/*.test.mjs`.
- **Focal.** PASÓ, 3/3 (`round2/test-invoice-read-boundary-focal.log`).
- **Control rojo.** `lib/studio/__l07_control_rojo_lector_facturas.ts`, con un `db.from("invoices")`, hizo fallar la primera prueba con `expected { …(19) } to deeply equal { …(18) }` (`round2/test-invoice-read-boundary-redcontrol.log`). El archivo se borró en el mismo comando y la prueba volvió a pasar 3/3 (`round2/test-invoice-read-boundary-after-revert.log`).
- **PR #104 y #105.** El conteo AST de los 14 y 1 archivos de producción que tocan da 0 cambios (`results/branch-inventory-delta.txt`).

**Frontera del Portal, medida.** Sonda en PostgreSQL 17.11 efímero (`results/portal-pdf-probe.txt`):
- Reproduce la lectura exacta de `getMyInvoice`: código, Shipping Mark resuelto por `get_portal_client_markbox()` y sin borradores ni borradas.
- Corre como `authenticated`, en `main` y tras 0407, 0411–0413 y 0414, dentro de una transacción revertida.

| Identidad | Factura | Shipping Mark resuelto | En `main` | Tras 0414 |
|---|---|---|---|---|
| vínculo activo con cliente borrado | X01 (de su cliente) | DEAD | visible | no visible |
| vínculo coherente de T1, Shipping Mark repetido en T2 | D01 (de T1) | DUP | visible | visible |
| vínculo coherente de T1, Shipping Mark repetido en T2 | D2-01 (de T2) | DUP | visible | no visible |
| vínculo incoherente (vínculo en T1, cliente de T2) | D01 | DUP | visible | no visible |
| vínculo incoherente (vínculo en T1, cliente de T2) | D2-01 | DUP | visible | no visible |

Cómo se ve en la app:
- **Páginas.** El layout del Portal resuelve el principal con `getPortalClient`, que ya rechaza cliente borrado y tenant incoherente (`lib/portal/portal-queries.ts:80-87`), y manda a `/entrar` (`app/portal/(app)/layout.tsx:39-40`). En las páginas no cambia nada.
- **PDF por URL.** La ruta del PDF es un route handler: no pasa por el layout y llama `getMyInvoice` antes de cualquier guard (`app/portal/(app)/facturas/[code]/pdf/route.ts:41-44`). Sin fila responde `noEncontrado("Factura")`, un 404 con «Factura no encontrado.» (`lib/studio/pdf/pdf-response.ts:59-63`).
- **Mensajes.** Ningún caso emite un mensaje de error propio.

**Esperas y notas.**
- `supabase/migrations-baseline.json`: sólo cambian las esperas de 0407 y 0414. `cutoff`, `$doc`, 0451, 0411, 0412, 0413 y el párrafo literal de autorización quedan idénticos, comprobado por valor. La de 0407 remite a la vuelta atrás; la de 0414 declara la frontera del Portal y remite a la vuelta atrás.
- Notas: 0350 suma la referencia a la vuelta atrás. 0357 suma la frontera aceptada, la importación del test con su control rojo y la referencia a la vuelta atrás. Las otras tres specs y el índice no cambian.

**PR #106.** Cuerpo actualizado y sigue en borrador. Suma:
- «Cambios de comportamiento visibles al desplegar»;
- «Frontera del Portal al aplicar 0414»;
- «Vuelta atrás de 0407 y 0414, probada»;
- la validación de la ronda 2;
- las decisiones del Director.

**Sin producto.** `git diff --stat 961ec85e..HEAD` (en «VALIDACIÓN») sólo muestra el test, dos notas de specs, el baseline y este handoff.

## ANÁLISIS 1 — MIGRATE-FIRST POR FACADE

**Veredicto: las tres facades son MIGRATE-FIRST.** 0411 y 0413 fallan ruidosamente; 0412 degrada en silencio. 0407 es requisito de 0411: su preflight exige `invoices_team_select` (`0411:30-39`).

Método. Se usó postgrest-js 2.106.1, el cliente que usa supabase-js en la app, contra PostgREST v16.1 con `db-max-rows` 1.000. Debajo corría el esquema de `main` reconstruido en `postgres:17` (17.11) con 419 migraciones, sin las 18 sólo-ledger ni las cinco de L07. Cada rol entró con su propio JWT HS256 y datos sintéticos. Se ejecutaron lado a lado las funciones reales de esta rama y las de `main` (`bca98147`, copiadas fuera del repo con `git show`).

| Facade | Sin la RPC, medido | Consumidores y efecto |
|---|---|---|
| 0411 `studio_client_annual_billing` | PGRST202 «Could not find the function public.studio_client_annual_billing(p_as_of) in the schema cache»; `clientAnnualBilling` lanza por `fetchAllPaged` (`lib/db/paginate.ts:131`) | `clientsWithTier` y `tierCounts` lanzan: Fidelización cae al error del segmento (`app/studio/(app)/fidelizacion/page.tsx:33-41`). `getKommoAnalytics` lanza (`lib/studio/kommo-analytics.ts:497`) y el CRM falla completo, porque su analítica corre en todas las pestañas (`app/studio/(app)/crm/page.tsx:82-87`). `commercialByClient` lanza (`lib/studio/reports/queries.ts:529`) y Reportes → Comercial falla (`app/studio/(app)/reportes/page.tsx:74-79`). `commercialByAgent` traga el error (`:619`) y dejaría ingresos por asesor en cero, pero comparte la carga con `commercialByClient` |
| 0412 `conversation_client_outstanding` | PGRST202; `getClientContext` devuelve null (`lib/studio/conversaciones/conversations-queries.ts:326`) | La API responde 200 con `context: null` (`app/api/studio/conversaciones/[id]/route.ts:57`). El panel muestra sólo el nombre del cliente, «Sin envíos en curso» (`app/studio/(app)/conversaciones/_components/ConversationThread.tsx:618`) y saldo «—» (`:653`) en todos los hilos, sin error |
| 0413 `sales_order_invoice_refs` | PGRST202 «Could not find the function public.sales_order_invoice_refs(p_sales_order_ids) in the schema cache»; `listInvoicesBySalesOrder` y `listInvoicesForSalesOrder` lanzan | La página de Órdenes de venta espera las referencias de cada orden en un `Promise.all` (`app/studio/(app)/ordenes-venta/page.tsx:49-57`) y cae al error del segmento en cuanto hay una orden |

Con las RPC aplicadas, cada rol autorizado recibe lo mismo que deja pasar el gate de su página. Los defaults son los de `lib/studio/rbac.ts:91`, `:96`, `:99` y `:104`, y los overrides vienen de `studio_role_module_overrides`, que la RPC lee igual que `getRoleModuleOverrides` (`lib/studio/role-module-overrides-queries.ts:28-35`). Medido:
- 0411: operations, warehouse, marketing y un accounting desactivado reciben 42501; sus páginas ya no los dejan entrar por defecto.
- 0413: support recibe 42501; el layout exige `sales-orders` (`app/studio/(app)/ordenes-venta/layout.tsx:12`).
- 0412: accounting recibe null; la ruta ya lo rechaza con 403 (`route.ts:36-37`).

Consecuencias:
- La primera línea de la PR dice «No fusionar antes de aplicar y verificar 0407, 0411, 0412 y 0413».
- Las tres declaraciones quedan AMARILLO en el gate de símbolos.
- Las esperas de 0411, 0412 y 0413 llevan el texto MIGRATE-FIRST.

Las tres son aditivas. Tras aplicarlas, el código de `main` devuelve lo mismo que antes: se midieron idénticas la facturación, el contexto y las referencias de `main` en las etapas «main» y «tras 0413». Aplicarlas antes de fusionar no cambia el comportamiento vigente.

## ANÁLISIS 2 — LECTORES Y ESCRITORES DE `invoices` EN `main` `bca98147`

Método:
- **Inventario AST propio.** Recorre con TypeScript cada `from("invoices")`, con su cadena de métodos y su receptor, en `app/`, `lib/`, `components/`, `scripts/` y `supabase/functions/`. Da 48 llamadas de producción en 21 archivos y ninguna `.delete()`. Con L07 quedan 45 en 18, el mismo inventario que congela el test de la ronda 2.
- **Embeds.** Se buscaron `invoices(`, `invoices!` e `invoice_id(`: no hay ninguno.
- **SQL.** Las funciones que leen o escriben `invoices` se sacaron por `grep` sobre las 419 migraciones, con su modo `SECURITY`.
- **Vistas y Realtime.** No hay vistas ni publicación Realtime sobre `invoices`. Los helpers de documentos y comentarios que la consultan son definer.
- **Matriz por rol.** La lectura (PostgREST, `count exact`) y la escritura (SQL como `authenticated`, con rollback) se midieron en tres etapas: en `main`, tras 0407 y tras 0414.

Hecho previo verificado en el catálogo: la policy efectiva `invoices by tenant` es `tenant_id = get_user_tenant_id()`, sin `deleted_at is null`. Ese filtro lo retiró `0230_fix_rls_soft_delete_blocked.sql:36`. Por eso los fixtures de 0407 y 0414 la reproducen fielmente, y ni 0407 ni 0414 cambian la visibilidad de las facturas borradas.

### Escritores

| Escritor | Cliente | Quién llega | Hoy | Tras 0407 | Tras 0414 |
|---|---|---|---|---|---|
| `createInvoice`, `updateInvoice`, `emitInvoice`, `softDeleteInvoice` y `duplicateInvoice` (`app/studio/(app)/facturacion/actions.ts:350`, `:434`, `:535`, `:722` y `:789`) | sesión | `moduleEditDenial("invoices")`: accounting y admin | escriben | igual (medido) | igual; el UPDATE necesita leer su WHERE y `accounting_select` lo permite (medido «actualiza 1») |
| `voidInvoice` → `void_invoice_with_audit_reason`, invoker (`facturacion/actions.ts:683`; `0294:143-170`) | sesión | invoices edit | anula | igual (medido) | igual (medido) |
| `registerPayment` (`facturacion/actions.ts:627`) y `registerCollection`, `identifyPayment` y `voidReceipt` (`app/studio/(app)/cobranzas/actions.ts:52-196`), vía `lib/studio/collections-actions.ts:178`, `:432` y `:537` | sesión | invoices edit o collections edit: accounting y admin | actualizan saldo y estado | igual | igual |
| `applyReferralCredit` (`app/studio/(app)/fidelizacion/actions.ts:507`, gate `:356`) | sesión | `moduleEditDenial("accounting")` | actualiza con `.select()` | igual | igual |
| `revertReferralCreditsForInvoice` (`lib/studio/accounting/referral-credit-posting.ts:360`) | service_role | proceso | escribe | igual | igual |
| `sales_order_claim_and_invoice` (`0128:134`, definer; EXECUTE sólo service_role; `lib/studio/sales-orders/actions.ts:553` con admin) | service_role | proceso | inserta | igual | igual |
| `confirm_payment_report` (`0359:44`), `rename_client_markbox` (`0371:110`), `rename_legacy_markboxes` y los triggers `audit_d2_invoices` e `invoices_accredit_referral` | definer | según su propio gate | escriben | igual | igual |
| Comandos de reportes de pago de la PR #104: `payment_private.run_report_command`, definer; sus envoltorios públicos son invoker y sólo lo llaman | definer | según su gate | escriben | igual | igual |
| commercial, operations, warehouse, support y marketing por PostgREST directo | sesión | — | **INSERT, UPDATE, soft-delete, anulación y DELETE** (medido) | INSERT 42501; UPDATE, soft-delete y anulación **0 filas sin error**; DELETE 42501 | igual que tras 0407 |

**Veredicto 0407: puede aplicarse antes del despliegue.** Ningún escritor legítimo pierde permisos. Todos los que escriben por sesión exigen un módulo de dinero, que es exactamente accounting y admin: los overrides no lo abren (`rbac.ts:161-190` y `:318-331`). Ningún código de producción borra facturas, así que revocar DELETE no rompe nada. La lectura por rol queda idéntica: 1.355 filas del tenant en `main` y tras 0407. La falla silenciosa de 0407 (UPDATE a 0 filas) sólo alcanza a quien escribe por PostgREST sin pasar por la app.

### Lectores

| Lector | Cliente | Quién llega | Hoy | Tras 0407 | Tras 0414 |
|---|---|---|---|---|---|
| Facturación: `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts:72`, `:130` y `:166`). Estado de cuenta y su PDF (`app/studio/(app)/clientes/[markbox]/estado-de-cuenta/page.tsx:77-86`). Export comercial `tipo=facturas` (`app/api/studio/comercial/export/route.ts:89-100`) | sesión | módulo `invoices`: accounting y admin | tenant completo | igual | igual |
| Cobranzas: `receivablesQueue` (`lib/studio/payment-queries.ts:502`), que usan la página, los recordatorios y el export operativo con gate `collections` (`app/api/studio/operativo/export/route.ts:72-75`). También `logActivity` (`cobranzas/actions.ts:163`) y el recibo (`cobranzas/recibo/[code]/page.tsx:118`) | sesión | `collections`: accounting y admin | igual | igual | igual |
| Créditos de referidos: `applicableInvoicesForReferrer` (`lib/studio/fidelizacion/referral-credit-queries.ts:131`), por `listApplicableInvoices` y `applyReferralCredit` (`fidelizacion/actions.ts:297-302` y `:387`) | sesión | accounting edit | igual | igual | igual |
| Tablero: `financeInvoiceKpis` (`lib/studio/dashboard/dashboard-kpi-queries.ts:49`), sólo con KPI de módulo `invoices` (`app/studio/(app)/dashboard/page.tsx:124`; `dashboard-catalog.ts:60-68`) | sesión | accounting y admin | igual | igual | igual |
| Costeo (`lib/studio/costing/queries.ts:152` y `:509`), Fiscal (`lib/studio/fiscal/queries.ts:217`), Rendiciones (`lib/studio/renditions/queries.ts:120`, `:307` y `:478`) y Reportes contables (`lib/studio/reports/queries.ts:230`, `:786`, `:892` y `:1063`) | sesión | módulos de dinero o sólo admin | igual | igual | igual |
| Búsqueda global, faceta `invoices` bloqueada por la matriz (`lib/studio/global-search/search-action.ts:256-262`) | sesión | accounting y admin | igual | igual | igual |
| **Fidelización, CRM y Reportes → Comercial**: `clientAnnualBilling` de `main` (`lib/studio/fidelizacion/queries.ts:71`) | sesión | fidelizacion (commercial, support), kommo (commercial) y reports (accounting) | tenant completo | igual | **código de `main`: cero filas sin error y todos los clientes en Bronze** (medido); código L07: RPC definer, igual para los autorizados |
| **Conversaciones**: `getClientContext` de `main` (`conversations-queries.ts:348`) | sesión | conversaciones (commercial, operations, support) | lee | igual | **código de `main`: saldo 0 falso sin error** (medido; el principal dual ve 777 USD de otro tenant); código L07: RPC |
| **Órdenes de venta**: `listInvoicesForSalesOrder` de `main` (`sales-orders/queries.ts:226`) | sesión | sales-orders (commercial, operations, accounting) | lee | igual | **código de `main`: «Facturas · 0» sin error para commercial y operations** (medido); código L07: RPC |
| **Portal**: `listMyInvoices` y `getMyInvoice` (`lib/portal/portal-queries.ts:241` y `:280`) para lista, detalle y PDF | sesión, policy Portal | cliente Portal | policy por Shipping Mark sin tenant: con el mismo Shipping Mark en dos tenants lee facturas del otro (medido: D2-01 desde T1) | igual | un vínculo coherente conserva sus facturas y deja de ver las de otro tenant con su mismo Shipping Mark: la lista las pierde y su detalle da `notFound`. **Frontera aceptada (ronda 2):** un vínculo activo con cliente borrado o incoherente deja de leer facturas sin ningún mensaje de error. El layout ya lo manda a `/entrar`, así que en la app sólo se nota en el PDF por URL, que pasa a 404 (medido) |
| Portal con service_role: `lib/portal/portal-legal-queries.ts:116`, `:200` y `:261` y `app/portal/(app)/facturas/[code]/reportar/actions.ts:86`, tras resolver el principal por sesión | service_role | cliente Portal | igual | igual | igual |
| Procesos: cron `kommo-contact-status` (`lib/studio/kommo-contact-status.ts:214`) | service_role | cron | igual | igual | igual |
| Funciones SQL definer que leen `invoices`: `next_invoice_code`, `comment_entity_in_tenant`, `document_entity_in_tenant` (0215/0314), `payment_reports_validate_invoice`, `get_portal_referral_program` (0404), `sales_order_claim_and_invoice` y `confirm_payment_report` | definer | según su gate | igual | igual | igual |
| Roles no financieros por PostgREST directo | sesión | — | 1.355 filas, incluidas 2 borradas | igual | **0 filas sin error** |

Fallas silenciosas marcadas:
1. 0414 con el código de `main` todavía desplegado, o revirtiendo sólo la app después de 0414.
2. 0412 aplicada sin el despliegue es inocua, pero desplegar sin 0412 degrada el panel en silencio.
3. Portal tras 0414: vínculo con cliente borrado o incoherente. Es frontera aceptada por el Director; en la app sólo se nota en el PDF por URL, que responde 404.
4. 0407 para escrituras por PostgREST de roles no financieros, sin camino desde la app.

Con L07 desplegado, ningún lector ni escritor legítimo se rompe, así que no hizo falta ningún arreglo fuera del allowlist.

## ANÁLISIS 3 — PARIDAD DE CADA FACADE CON EL CONSUMIDOR DE `main`

Cifras medidas con el arnés de postgrest-js y datos sintéticos, en la etapa «tras 0413»: RPC aplicadas y RLS todavía de `main` + 0407. Los tenants T1 y T2 comparten Shipping Marks. En la ronda 2 el Director aceptó todas las divergencias; la PR las lista en lenguaje llano.

**0411 — facturación anual por Shipping Mark (USD, accounting de T1)**

| Caso sintético (disposición infeliz) | `main` | L07 | Resultado |
|---|---|---|---|
| L07-EDGE: `issued_at` exactamente hace un año (entra), un día antes (sale), fallback `created_at` 23:59:59 UTC del día previo (sale) y 00:00 UTC del día de inicio (entra) | 90 | 90 | igual |
| L07-BIG: 1.100 facturas, por encima del tope de 1.000 de PostgREST | 1.100 | 1.100 | igual (ambos paginan) |
| L07-ANUL: emitida 100 y anulada 1.000 | 100 | 100 | igual |
| L07-TIE: VES sin tasa 100 y USD 100 | 100 | 100 | igual |
| L07-OLD: cliente fusionado; facturas con el Shipping Mark viejo | 60 | 60 | igual: ninguno las suma al sobreviviente |
| DEAD: cliente borrado con facturas vivas | 80 | 80 | igual |
| DUP en T1 (2 × 10 más un borrador) y en T2; T2 ve DUP 906 y L07-A 777 | 20 | 20 | igual |
| **L07-A**: USD, USDT, VES con tasa 36,5, VES sin tasa, CNY, borrador, anulada, vieja, fallback, **una borrada de 800, una con `issued_at` futuro de 123,45 y una negativa de −50** | 3.623,45 | 2.650 | **diverge**: `main` suma la borrada y la futura e ignora la negativa |
| **L07-DEC**: 12 × 12.500,00 VES con tasa 3,0000 | 49.999,99999999999, **Bronze** | 50.000, **Silver** | **diverge**: suma flotante contra `numeric` en el umbral |
| **L07-SO**: incluye una borrada de 60 | 690 | 630 | **diverge**: borrada |
| **Principal dual**: commercial de T1 con vínculo Portal activo en T2 a L07-A | L07-A 4.400,45 | 2.650 | **diverge**: `main` suma la factura de T2 por la policy Portal histórica |
| operations, warehouse, marketing y accounting desactivado | datos (vacío el desactivado) | 42501 | sin efecto visible: sus páginas no los dejan entrar |

Borde bisiesto: `trailingStart` de `main` da 2027-03-01 para el 29/02/2028 (medido en Node), mientras la RPC resta `interval '1 year'` sobre `date`.
Medido en PostgreSQL 17.11 (`results/bisiesto.txt`): `(date '2028-02-29' - interval '1 year')::date` = 2027-02-28. Ese único día cada cuatro años la RPC cuenta las facturas del 2027-02-28 y `main` no; el resto del año las ventanas coinciden (medido en L07-EDGE). No se midió punta a punta porque la RPC sólo acepta `p_as_of` en hoy ± 1 día.

**0412 — saldo por hilo**

| Caso sintético | `main` | L07 | Resultado |
|---|---|---|---|
| L07-A: moneda dominante VES 37.600, con sobrepago USDT | 37.600 VES | 37.600 VES | igual |
| DUP en T1; DUP en T2 desde commercial de T2 | 20 USD; 906 USD | 20 USD; 906 USD | igual |
| Cliente borrado; hilo de otro tenant | null | null | igual |
| Hilo borrado | contexto (función aislada) | null | sin efecto: la ruta responde 404 antes (`route.ts:41-48`) |
| accounting sin Conversaciones | contexto | null (42501) | sin efecto: la ruta responde 403 antes |
| **L07-TIE**: VES 100 insertada primero; USD 100 con pagado 30 | VES 100 | USD 70 | **diverge**: el empate en `main` depende del orden de filas; la RPC ordena por código |
| **L07-ANUL**: emitida 100 y anulada 1.000 | 1.100 USD | 100 USD | **diverge**: `main` incluía anuladas; es la decisión 3 de SDD-0355 |
| **L07-BIG**: 1.100 facturas de 1 USD | 1.000 USD | 1.100 USD | **diverge**: `main` truncaba en 1.000 sin paginar |

**0413 — referencias por orden de venta**

| Caso sintético | `main` | L07 | Resultado |
|---|---|---|---|
| OV-L07-1: emitida, borrador, anulada, borrada y pagada, más una factura de T2 que apunta a esta OV | 4 | 4 | igual en códigos y estados; el empate de `created_at` sale por id |
| OV de T2 vista desde T1 | 0 | 0 | igual |
| **OV-L07-BIG**: 210 facturas | 200 | 210 | **diverge**: `main` truncaba en 200 |
| OV-L07-DEL: orden borrada con una factura | 1 | 0 | diverge sin efecto visible: la página lista órdenes vivas |
| commercial de T2 pidiendo la OV de T1 | 1 (S2-X de T2) | 0 | diverge sin camino desde la UI |
| support, sin Órdenes de venta | lista | 42501 | sin efecto: el layout ya lo bloquea |

Búsqueda activa de divergencias como la de L10:
- Estas RPC no normalizan texto. La igualdad por Shipping Mark es exacta en ambos lados: `.eq("client_markbox", …)` en `main` y `i.client_markbox = v_markbox` en la RPC.
- `client_markbox <> ''` equivale a `if (!r.client_markbox) continue`; moneda y estado son enums.
- Montos: `numeric(14,2)` y `numeric(14,4)`. La RPC divide y suma en `numeric` y PostgREST entrega un string que la app convierte con `Number`. `main` sumaba flotantes por factura: de ahí L07-DEC.
- Zona horaria: la RPC toma la fecha UTC de `created_at` y `p_as_of` es la fecha UTC del servidor web; `main` corta el ISO que PostgREST emite en la zona de la sesión. En la base efímera es UTC; en producción es NO VERIFICABLE sin `show timezone`.

## ANÁLISIS 4 — DATOS PERSONALES Y FINANCIEROS (`revisar-datos-ve`)

Resumen: 3 ENCONTRADO que L07 cierra al aplicarse, 1 ENCONTRADO preexistente que L07 no cambia, 5 CORRECTO y 4 NO VERIFICABLE.

Inventario de lo que cruza la frontera en este lote:

| Campo | Qué es | Finalidad | Quién lo ve |
|---|---|---|---|
| `studio_client_annual_billing.client_markbox` | Shipping Mark: identifica a una persona natural o empresa | nivel de fidelización y cruce del CRM | roles con Fidelización, CRM o Reportes efectivos |
| `studio_client_annual_billing.billed_usd` | dato económico agregado del cliente | nivel | ídem |
| `conversation_client_outstanding.client_id`, `balance` y `currency` | saldo por cobrar del cliente | panel del hilo | Conversaciones efectivo |
| `sales_order_invoice_refs`: `id`, `sales_order_id`, `invoice_code`, `total_amount`, `status` y `created_at` | referencia económica sin identidad del cliente | drawer de la OV; `created_at` sólo pagina | Órdenes de venta efectivo |
| Facturas leídas por el Portal (`getMyInvoice`: `client_name`, `client_rif`, `client_doc_kind`, montos, líneas y notas; `lib/portal/portal-queries.ts:283`) | identidad fiscal y datos económicos | autoservicio del cliente | el principal Portal |

Hallazgos:
1. **ENCONTRADO, grave; lo cierra 0414.** Con la policy Portal histórica (`supabase/migrations/0085_portal_invoices_rls.sql:19-25`) y el mismo Shipping Mark en dos tenants, un cliente Portal lee facturas de otro tenant, con nombre, RIF, montos y líneas: medido D2-01 desde un vínculo de T1. Le corresponden la CRBV art. 28 (acceso a los datos propios) y el art. 60 (confidencialidad). Arreglo: 0414 (`0414:62-80`) exige vínculo, cliente y tenant coherentes, y se midió que la exposición cesa. Pendiente de aplicar. La ruta del PDF la expone además por URL, porque lee la factura antes de resolver el principal (`app/portal/(app)/facturas/[code]/pdf/route.ts:41-44`).
2. **ENCONTRADO; lo cierran 0411–0413 con 0414.** Hoy commercial, operations, warehouse, support y marketing leen cada factura del tenant con moneda, tasa, estado, fechas, RIF, líneas y notas (policy `invoices by tenant` y `0230:36`), aunque sólo necesitan agregados. Es el punto 2 del checklist, minimización (SC 332/2001: finalidad). Tras 0414 leen 0 filas y reciben sólo las columnas de las RPC.
3. **ENCONTRADO; lo cierra 0407.** Esos cinco roles también pueden crear, modificar, anular y borrar facturas por PostgREST (medido).
4. **CORRECTO. Minimización de columnas:** 2 columnas en `0411:44-47`, 3 en `0412:20` y 6 en `0413:19-22`, sin cliente, líneas, tasa, notas ni datos fiscales. El helper de OV descarta `created_at` antes de la UI (`lib/studio/sales-orders/queries.ts:254-259`), y el test lo afirma.
5. **CORRECTO. EXECUTE:** `revoke all … from public, anon, authenticated` y `grant execute … to authenticated` (`0411:136-139`, `0412:93-96` y `0413:72-74`). Medido en el catálogo: anon sin EXECUTE; service_role con EXECUTE por el privilegio por defecto del esquema, sin consumidor en el repo.
6. **CORRECTO. Cruce de tenants:** ninguna RPC recibe el tenant. Lo derivan de `get_user_tenant_id()` (`0411:54`, `0412:27` y `0413:29`) y lo filtran en cada tabla (`0411:111`, `0412:56-61` y `:73`, `0413:62-67`). Medido con dos tenants y Shipping Marks repetidos.
7. **CORRECTO. Límites de volumen:** 0411 agrega por Shipping Mark y fija `p_as_of` en hoy ± 1 día (`0411:92-97`), sin enumerar historia. 0412 devuelve una fila. 0413 corta en 500 órdenes (`0413:55-57`) y el helper pagina por lotes.
8. **CORRECTO. Roles efectivos**, con overrides y membresía activa (`0411:58-88`, `0412:33-53` y `0413:33-50`). Medido: 42501 para roles sin acceso y para la membresía desactivada.
9. **ENCONTRADO, preexistente; L07 no lo cambia.** Desde 0230 el equipo lee facturas borradas y `accounting_select` de 0414 mantiene esa lectura para accounting y admin (`0414:52-57`). Varios lectores financieros no filtran `deleted_at` (sección FUERA DE ALCANCE). Es temporalidad (SC 332/2001).

NO VERIFICABLE:
- Zona horaria de la base de producción.
- ACL y policies reales de `invoices` en producción. La espera de 0407 trae la lectura de catálogo.
- Si hoy existe en producción el mismo Shipping Mark en dos tenants: el conteo agregado necesita autorización y no se leyó. El Director lo pide a Sam.
- Base de licitud, retención y avisos, que están fuera del repo.

Fuera de alcance legal: redacción de políticas, contratos con encargados y decisión sobre la base de licitud. Conviene pedir una segunda opinión de otro modelo sobre este análisis. Esto no es asesoría legal.

## ANÁLISIS 5 — ORDEN DE APLICACIÓN, LOCKS Y TIMEOUTS

Medición local y efímera, no de producción:
- **Contenedor y base.** `dtd_l07_pg` (`postgres:17`, 17.11), con los stubs de plataforma del repo y las 419 migraciones de `main`.
- **Datos.** Sintéticos, 1.355 facturas en T1 y 5 en T2, insertados con `session_replication_role = replica`.
- **Aplicación.** Cada migración en su propia transacción, leyendo `pg_locks` del propio backend antes del COMMIT.
- **Limpieza.** Contenedores y red retirados antes del verify. El stack ajeno `dtd-pr28-auth-*` no se tocó.

| Paso | Migración | Qué hace | Requiere | Locks retenidos hasta COMMIT | Timeouts | Compatibilidad |
|---|---|---|---|---|---|---|
| 1 | 0407 | policies separadas y ACL sin DELETE | `invoices`, helpers de 0200 y la policy histórica `invoices by tenant` con cmd ALL (preflight `0407:35-57`) | **ACCESS EXCLUSIVE sobre `invoices`**, más AccessShare y ShareUpdateExclusive; objeto `pg_policy` en AccessExclusive; 16 de catálogo; ~14 ms sin contención | **propios, en la transacción: 5 s y 60 s**; medidos en `5s` y `1min` con la sesión en `0` | compatible con `main`: misma lectura y escritores legítimos intactos (medido) |
| 2 | 0411 | RPC de facturación anual | 0407 (`0411:30-39`), `studio_role_module_overrides` y helpers | ninguno sobre tablas de usuario; objeto de la función en ShareUpdateExclusive; ~10 ms | sin propios: no toma locks de tabla | aditiva |
| 3 | 0412 | RPC de saldo por hilo | conversations, clients, invoices, overrides y helpers | ídem; ~10 ms | sin propios | aditiva |
| 4 | 0413 | RPC de referencias por OV | sales_orders, invoices, overrides y helpers | ídem; ~8 ms | sin propios | aditiva |
| 5 | — | **despliegue de esta PR** y smoke por roles: Fidelización, CRM (Dirección) y Reportes → Comercial con commercial, support y accounting; panel de Conversaciones con commercial, operations, support y admin; drawer de OV con commercial, operations y accounting; lista y detalle de facturas del Portal | 0407 y 0411–0413 aplicadas y verificadas | — | — | antes de este paso el código nuevo no opera (MIGRATE-FIRST) |
| 6 | 0414 | lectura interna sólo accounting y admin; Portal por vínculo, cliente y tenant | las tres RPC como definer y exactamente las dos policies de lectura previas (`0414:15-48`) | **ACCESS EXCLUSIVE sobre `invoices`**, más AccessShare y ShareUpdateExclusive; **ACCESS SHARE sobre `clients` y `client_users`**; dos objetos `pg_policy` en AccessExclusive; 19 de catálogo; ~14 ms | **propios: 5 s y 60 s**; medidos en `5s` y `1min` | rompe **en silencio** el código anterior (análisis 2) |

**Contención**, con otra sesión que retenía ACCESS SHARE sobre `invoices` durante 15 s. En los cuatro casos la migración se aplicó dentro de una transacción, desde una sesión **sin** `lock_timeout` propio. Un lector nuevo, también sin `lock_timeout`, llegó 2 s después de empezar la migración:

| Archivo | Resultado de la migración | Espera del lector nuevo |
|---|---|---|
| 0407 de origen | la primera `DROP POLICY` esperó 13,99 s, hasta que terminó el retenedor | 11,99 s en cola |
| 0407 actual | cortó en `DROP POLICY` (`0407:59`) a los 5,001 s con `canceling statement due to lock timeout`; la transacción se revirtió entera | 2,985 s, terminó normal |
| 0414 de origen | esperó 13,99 s | 11,99 s en cola |
| 0414 actual | cortó en `DROP POLICY` (`0414:51`) a los 5,001 s con el mismo error; se revirtió entera | 2,997 s |

Desviación pre-autorizada y su condición:
- **Qué cambia.** 0407 y 0414 fijan `set local lock_timeout = '5s'` y `set local statement_timeout = '60s'` al nivel superior del archivo, antes del primer lock, como L10 y a diferencia de 0450 y 0451, que lo fijan dentro de su `do`.
- **Autorización cumplida.** Ningún preflight, postflight ni contrato depende de la identidad o posición del archivo: sólo hay `\ir` en los contratos y el texto de un mensaje en `0411:38`.
- **Contratos.** Agregan la aserción estática: los timeouts van antes de la primera sentencia `do|create|alter|drop|grant|revoke|comment|lock|select|insert|update|delete|truncate`, leída sin comentarios. También comprueban en la transacción `pg_settings` 5000 y 60000.
- **Autocommit.** El tope de lock_timeout/statement_timeout rige solo si se aplica dentro de una transacción, como hace apply_migration; si se aplicara en autocommit, no tiene efecto: usar entonces una sesión con `set lock_timeout`. Medido: `SET LOCAL` fuera de transacción emite `WARNING: SET LOCAL can only be used in transaction blocks` y `lock_timeout` sigue en `0`.

Riesgos operativos:
- Mientras 0407 o 0414 esperan, hasta 5 s, queda en cola toda lectura de facturas: Facturación, Cobranzas, Portal, tablero y reportes. Conviene aplicarlas en baja actividad; si cortan, se reintentan.
- La vuelta atrás de 0407 y 0414 está escrita y probada en local (sección siguiente). Ninguna pierde datos: revertir 0414 reabre la lectura cruda del equipo y la fuga del Portal entre tenants, y revertir 0407 reabre la escritura y el DELETE de los roles no financieros. Primero 0414, después 0407.

## VUELTA ATRÁS DE 0407 Y 0414 (PROBADA)

Ronda 2, por pedido del Director.
- **Qué son.** Ninguno de estos dos bloques SQL es una migración: no se guardan en `supabase/migrations` ni se registran en el ledger.
- **Cómo se aplican.** Sólo con OK nominal de Sam, siguiendo `docs/runbooks/aplicar-migraciones-prod.md` y dentro de una transacción.
- **Locks y timeouts.** Los dos fijan `lock_timeout` 5 s y `statement_timeout` 60 s, como las migraciones, y toman el mismo ACCESS EXCLUSIVE sobre `invoices`.
- **Controles.** El preflight comprueba que la tabla está exactamente como la deja su migración, y el postflight, que quedó como estaba antes.

Orden y alcance:
- **Sólo 0407 aplicada:** se revierte 0407.
- **0414 aplicada:** primero se revierte 0414. Revertir 0407 con 0414 aplicada aborta en su preflight con «revertir 0414 primero» y no deja nada a medias (medido).
- **Volver la app a `main` con 0414 aplicada** rompe en silencio Fidelización, CRM, Reportes, Conversaciones y Órdenes de venta (análisis 2). Antes de volver la app, se revierte 0414.
- **Las tres RPC de 0411–0413 quedan.** No son parte de esta vuelta atrás; retirarlas con la app de L07 desplegada rompe esas pantallas (MIGRATE-FIRST).
- **Producción.**
  - Antes de aplicar 0407 conviene guardar la lectura de catálogo de su espera. Esta vuelta atrás devuelve el estado de `main`: si lo capturado difiere, hay que ajustarla antes de usarla.
  - En producción `authenticated` puede tener además REFERENCES, TRIGGER o MAINTAIN, que la base local no tiene. La vuelta atrás sólo toca DELETE, que es lo que 0407 quita, y GRANT y REVOKE editan la misma entrada del ACL, así que el resto queda igual (en local, `relacl` idéntico).

### SQL de la vuelta atrás de 0414

```sql
-- VUELTA ATRÁS DE 0414 · L07 / SDD-0357. NO es una migración: no se guarda en
-- supabase/migrations ni se registra en el ledger. Aplicar sólo con OK nominal
-- de Sam y dentro de una transacción. Deja public.invoices como la dejan
-- 0407 y 0411–0413 (antes de 0414). No toca filas ni las tres RPC. Reabre la
-- lectura cruda de facturas para el equipo del tenant y la policy Portal
-- histórica por Shipping Mark sin tenant.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_policies text := (
    select pg_catalog.string_agg(p.policyname || ':' || p.cmd, ', ' order by p.policyname collate "C")
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public' and p.tablename = 'invoices'
  );
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices') <> 4
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_select' and cmd = 'SELECT')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_insert' and cmd = 'INSERT')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_update' and cmd = 'UPDATE')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices portal self read' and cmd = 'SELECT'
         and qual like '%client_users%') then
    raise exception 'vuelta atrás de 0414: invoices no está como la deja 0414 (policies: %)', v_policies;
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0414: authenticated tiene DELETE; la ACL no es la de 0407';
  end if;
end;
$preflight$;

drop policy invoices_accounting_select on public.invoices;
create policy invoices_team_select
  on public.invoices for select
  to authenticated
  using (
    tenant_id = (select public.get_user_tenant_id())
  );

drop policy "invoices portal self read" on public.invoices;
create policy "invoices portal self read"
  on public.invoices for select to authenticated
  using (
    deleted_at is null
    and status <> 'borrador'
    and client_markbox is not null
    and client_markbox = public.get_portal_client_markbox()
  );

comment on table public.invoices is
  'SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.';

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices') <> 4
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_team_select' and cmd = 'SELECT')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices portal self read' and cmd = 'SELECT'
         and qual like '%get_portal_client_markbox%')
     or exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_select')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0414: estado final inválido';
  end if;
end;
$postflight$;
```

### SQL de la vuelta atrás de 0407

```sql
-- VUELTA ATRÁS DE 0407 · L07 / SDD-0350. NO es una migración: no se guarda en
-- supabase/migrations ni se registra en el ledger. Aplicar sólo con OK nominal
-- de Sam, dentro de una transacción y, si 0414 estaba aplicada, después de
-- revertir 0414. Deja public.invoices con las policies, la ACL y el comentario
-- de main bca98147 (antes de 0407). No toca filas.
set local lock_timeout = '5s';
set local statement_timeout = '60s';

do $preflight$
declare
  v_policies text := (
    select pg_catalog.string_agg(p.policyname || ':' || p.cmd, ', ' order by p.policyname collate "C")
    from pg_catalog.pg_policies as p
    where p.schemaname = 'public' and p.tablename = 'invoices'
  );
begin
  if exists (
    select 1 from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'invoices'
      and policyname = 'invoices_accounting_select'
  ) then
    raise exception 'vuelta atrás de 0407: 0414 sigue aplicada; revertir 0414 primero (policies: %)', v_policies;
  end if;
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices') <> 4
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_team_select' and cmd = 'SELECT')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_insert' and cmd = 'INSERT')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices_accounting_update' and cmd = 'UPDATE')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices portal self read' and cmd = 'SELECT'
         and qual like '%get_portal_client_markbox%') then
    raise exception 'vuelta atrás de 0407: invoices no está como la deja 0407 (policies: %)', v_policies;
  end if;
  if pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0407: authenticated ya tiene DELETE; comparar con la ACL capturada antes de 0407';
  end if;
end;
$preflight$;

drop policy invoices_team_select on public.invoices;
drop policy invoices_accounting_insert on public.invoices;
drop policy invoices_accounting_update on public.invoices;

create policy "invoices by tenant"
  on public.invoices for all
  to authenticated
  using (tenant_id = public.get_user_tenant_id())
  with check (tenant_id = public.get_user_tenant_id());

grant delete on public.invoices to authenticated;

comment on table public.invoices is
  'SDD-0021: facturas operativas. State machine borrador → emitida → parcial/pagada · vencida (visual) · anulada. paid_amount es acumulador (el ledger de pagos es Cobranzas, Bloque 2). Soft delete via deleted_at. RLS por tenant_id.';

do $postflight$
begin
  if (select count(*) from pg_catalog.pg_policies
      where schemaname = 'public' and tablename = 'invoices') <> 2
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices by tenant' and cmd = 'ALL')
     or not exists (select 1 from pg_catalog.pg_policies
       where schemaname = 'public' and tablename = 'invoices'
         and policyname = 'invoices portal self read' and cmd = 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'SELECT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'INSERT')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'UPDATE')
     or not pg_catalog.has_table_privilege('authenticated', 'public.invoices', 'DELETE') then
    raise exception 'vuelta atrás de 0407: estado final inválido';
  end if;
end;
$postflight$;
```

### Prueba

Local y efímera, nunca producción:
- **Base.** `postgres:17` (17.11) con las 419 migraciones de `main` `bca98147`, sin las 18 sólo-ledger ni L07, más la siembra sintética de la ronda 1.
- **Foto de catálogo determinística, sin OID.** Incluye:
  - todas las policies de `invoices`, con nombre, permissive, roles, comando, `qual` y `with_check`;
  - `relacl` y los flags de RLS, más el ACL por columna;
  - el comentario de la tabla;
  - los privilegios efectivos de anon, authenticated y service_role en los ocho verbos;
  - `proacl`, `prosecdef` y `proconfig` de `get_user_tenant_id`, `current_studio_role`, `get_portal_client_markbox`, `auth.uid`, `void_invoice_with_audit_reason` y las tres RPC.
- **Comportamiento.** Además de la foto, una matriz de lectura de 16 identidades (visibles, borradas y de T2) y la matriz de escritura de 10 identidades y 5 operaciones.
- **Secuencia.**
  1. `main`.
  2. 0407 y su vuelta atrás.
  3. 0407 otra vez en transacción revertida.
  4. 0407, 0411, 0412 y 0413.
  5. 0414.
  6. Vuelta atrás de 0407 fuera de orden, revertida.
  7. Vuelta atrás de 0414.
  8. 0414 otra vez en transacción revertida.
  9. Cadena completa: 0414, vuelta atrás de 0414 y vuelta atrás de 0407.

### Recibo

`results/rollback/recibo.txt`: 23 comprobaciones, todas OK.

```
# Prueba de vuelta atrás L07 · 2026-09-13T01:40:16.690Z
PostgreSQL 17.11 (Debian 17.11-1.pgdg13+2) on x86_64-pc-linux-gnu, compiled by gcc (Debian 14.2.0-19) 14.2.0, 64-bit
base: l07_work = main bca98147 (419 migraciones, sin ledger-only ni L07) + siembra sintética
OK   · 0407 aplica (commit)
OK   · control: la foto detecta el cambio de 0407 (4 líneas sólo antes, 6 sólo después)
OK   · vuelta atrás de 0407 aplica (commit)
OK   · catálogo tras revertir 0407 idéntico a main (md5 eea99782464a89cbc45e3647990a4b7d vs eea99782464a89cbc45e3647990a4b7d; 12 líneas)
OK   · matriz de lectura por identidad idéntica a main tras revertir 0407
OK   · matriz de escritura por rol idéntica a main tras revertir 0407
OK   · 0407 vuelve a pasar su preflight sobre el estado restaurado (transacción revertida)
OK   · tras esa prueba revertida el catálogo sigue idéntico a main
OK   · 0407, 0411, 0412 y 0413 aplican (commit)
OK   · 0414 aplica (commit)
OK   · control: la foto detecta el cambio de 0414 (3 líneas sólo antes, 6 sólo después)
OK   · control: revertir 0407 con 0414 aplicada aborta en su preflight
OK   · ese intento no deja nada a medias
OK   · vuelta atrás de 0414 aplica (commit)
OK   · catálogo tras revertir 0414 idéntico al de antes de 0414 (md5 232ea029615ac26d47ecc7d4f49c49b4 vs 232ea029615ac26d47ecc7d4f49c49b4; 17 líneas)
OK   · matriz de lectura por identidad idéntica a la de antes de 0414
OK   · matriz de escritura por rol idéntica a la de antes de 0414
OK   · 0414 vuelve a pasar su preflight sobre el estado restaurado (transacción revertida)
OK   · tras esa prueba revertida el catálogo sigue idéntico al de antes de 0414
OK   · 0414 aplica otra vez (commit)
OK   · cadena de vuelta atrás 0414 → 0407 aplica (dos commits)
OK   · tras la cadena completa, invoices y helpers idénticos a main (md5 eea99782464a89cbc45e3647990a4b7d vs eea99782464a89cbc45e3647990a4b7d; 12 líneas; las tres RPC de 0411–0413 siguen existiendo)
OK   · matriz de lectura por identidad idéntica a main tras la cadena completa
OK   · matriz de escritura por rol idéntica a main tras la cadena completa
```

Qué cambia 0407 en la foto y restaura su vuelta atrás (`results/rollback/02-diff-main-vs-0407.txt`):

```
SOLO ANTES
comment|SDD-0021: facturas operativas. State machine borrador → emitida → parcial/pagada · vencida (visual) · anulada. paid_amount es acumulador (el ledger de pagos es Cobranzas, Bloque 2). Soft delete via deleted_at. RLS por tenant_id.
policy|invoices by tenant|PERMISSIVE|authenticated|ALL|(tenant_id = get_user_tenant_id())|(tenant_id = get_user_tenant_id())
priv|authenticated|DELETE=true,INSERT=true,MAINTAIN=false,REFERENCES=false,SELECT=true,TRIGGER=false,TRUNCATE=false,UPDATE=true
relacl|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arwd/postgres}|rls=true|force=false

SOLO DESPUES
comment|SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.
policy|invoices_accounting_insert|PERMISSIVE|authenticated|INSERT|-|((tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id)) AND (( SELECT current_studio_role() AS current_studio_role) = ANY (ARRAY['accounting'::text, 'admin'::text])))
policy|invoices_accounting_update|PERMISSIVE|authenticated|UPDATE|((tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id)) AND (( SELECT current_studio_role() AS current_studio_role) = ANY (ARRAY['accounting'::text, 'admin'::text])))|((tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id)) AND (( SELECT current_studio_role() AS current_studio_role) = ANY (ARRAY['accounting'::text, 'admin'::text])))
policy|invoices_team_select|PERMISSIVE|authenticated|SELECT|(tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id))|-
priv|authenticated|DELETE=false,INSERT=true,MAINTAIN=false,REFERENCES=false,SELECT=true,TRIGGER=false,TRUNCATE=false,UPDATE=true
relacl|{postgres=arwdDxtm/postgres,service_role=arwdDxtm/postgres,authenticated=arw/postgres}|rls=true|force=false
```

Qué cambia 0414 y restaura su vuelta atrás (`results/rollback/06-diff-before-vs-0414.txt`):

```
SOLO ANTES
comment|SDD-0021/0350: facturas operativas y financieras. SELECT interno permanece tenant-wide por compatibilidad con consumidores agregados; INSERT/UPDATE requieren accounting o admin en RLS (0407). authenticated no tiene DELETE físico: borradores usan soft-delete y hechos emitidos se anulan. service_role queda reservado a jobs/RPCs controladas.
policy|invoices portal self read|PERMISSIVE|authenticated|SELECT|((deleted_at IS NULL) AND (status <> 'borrador'::invoice_status) AND (client_markbox IS NOT NULL) AND (client_markbox = get_portal_client_markbox()))|-
policy|invoices_team_select|PERMISSIVE|authenticated|SELECT|(tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id))|-

SOLO DESPUES
comment|SDD-0021/0350/0357: lectura y escritura internas requieren accounting/admin activos del tenant. Portal sólo lee sus facturas no borrador/vivas mediante vínculo activo, cliente vivo y tenant coincidente. Módulos no financieros usan RPCs minimizadas 0411–0413. authenticated no tiene DELETE físico; service_role se reserva a procesos controlados.
policy|invoices portal self read|PERMISSIVE|authenticated|SELECT|((deleted_at IS NULL) AND (status <> 'borrador'::invoice_status) AND (client_markbox IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (client_users cu
     JOIN clients c ON (((c.id = cu.client_id) AND (c.tenant_id = cu.tenant_id) AND (c.deleted_at IS NULL))))
  WHERE ((cu.auth_user_id = ( SELECT auth.uid() AS uid)) AND (cu.status = 'active'::text) AND (cu.tenant_id = invoices.tenant_id) AND (c.markbox = invoices.client_markbox)))))|-
policy|invoices_accounting_select|PERMISSIVE|authenticated|SELECT|((tenant_id = ( SELECT get_user_tenant_id() AS get_user_tenant_id)) AND (( SELECT current_studio_role() AS current_studio_role) = ANY (ARRAY['accounting'::text, 'admin'::text])))|-
```

Tras la cadena completa, `invoices` y los helpers coinciden con `main`. Sólo quedan las tres líneas `proacl-rpc` de 0411–0413, que `main` no tiene (`results/rollback/10-diff-main-vs-full-chain.txt`).

### Qué no vuelve igual

- **Comportamiento.** Nada: foto y matrices idénticas.
- **OID internos.** Cambian los de las policies recreadas; no son semánticos y la foto los excluye.
- **Filas.** La vuelta atrás no deshace filas escritas mientras la migración estuvo aplicada. 0407 y 0414 no escriben filas, y las escrituras legítimas de ese periodo quedan con su auditoría.
- **Seguridad.** Se pierde, que es el objetivo de las migraciones:
  - revertir 0414 reabre la lectura cruda de facturas para todo el equipo del tenant y la exposición del Portal entre tenants con Shipping Mark repetido;
  - revertir 0407 reabre INSERT, UPDATE y DELETE por PostgREST a commercial, operations, warehouse, support y marketing.

Recibos en el scratchpad de la tarea:
- `results/rollback/`: fotos, logs, matrices y diffs `01`–`10`.
- `tools/rollback/`: `revert-0407.sql`, `revert-0414.sql`, `snapshot.sql` y `rollback-test.mjs`.
- `tools/`: `read-matrix.sql` y `write-matrix.sql`.

## COORDINACIÓN CON PR ABIERTAS Y HALLAZGOS PREVIOS

- **PR #104 (L14, 0420–0423).** No comparte archivos de código con L07; comparte `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json` y `docs/specs/README.md`, así que habrá conflicto textual en el segundo merge. README y baseline usan el driver `dtd-generated-records`; las declaraciones se unen a mano. Interacción SQL:
  - Los comandos de L14 leen y actualizan `invoices` dentro de `payment_private.run_report_command`, que es definer y no pasa por RLS. Da igual el orden respecto de 0407 y 0414.
  - Los preflights de 0421 y 0422 sólo exigen `relrowsecurity` en `invoices`, sin huellas de sus policies ni de su ACL.
  - En el Portal, el detalle de factura de L14 sigue leyendo la factura con `getMyInvoice` por sesión, sujeto a la policy de 0414: el mismo resultado para un vínculo coherente.
  - `reportar/actions.ts` de L14 lee la factura con service_role después de resolver el principal, así que 0414 no lo afecta.
  - No hay solape de locks: 0414 bloquea `invoices` y 0420/0422 bloquean `payment_reports`.
- **PR #105 (L10, 0410 → 0415).** Sólo comparte los mismos tres registros. 0410 lee `invoices` como definer, y 0415 no toca `invoices`.
- **Test de inventario (ronda 2).** Ninguna de las dos PR altera sus 45 llamadas: el conteo AST de los 14 archivos de producción de la #104 y el de la #105 da 0 cambios (`results/branch-inventory-delta.txt`).
- **SDD-0390 y SDD-0397**, `done` en `main` sin todo su código. L07 no depende de ellas: la policy Portal de 0414 es autocontenida, con EXISTS sobre `client_users` y `clients`, evaluable con la RLS que `main` ya da al Portal (`client_users self or tenant read` y `clients portal self read`, verificadas en el catálogo). Las lecturas de facturas del Portal (`lib/portal/portal-queries.ts:235-300`) están fuera de sus allowlists. 0414 no corrige `get_portal_client_markbox()` (`limit 1` sin tenant).

## CONTROLES ROJOS

1. **Aserción estática de timeouts.** El contrato de 0407 contra el archivo de origen falla con `TEST 0407: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=0, statement_timeout=0, primera sentencia=25)`. El de 0414 falla con el mismo mensaje y `primera sentencia=5`. Con los archivos actuales, los cinco contratos pasan en bases limpias.
2. **Contención.** Sin tope, 13,99 s de espera y 11,99 s de cola. Con tope, 5,0 s y unos 3,0 s.
3. **Migrate-first.** PGRST202 en las tres RPC antes de aplicarlas; los consumidores lanzan (0411 y 0413) o devuelven null (0412).
4. **Paridad.** Casos donde `main` difiere: L07-DEC en Bronze frente a Silver, L07-A 3.623,45 frente a 2.650, principal dual 4.400,45 frente a 2.650, TIE en VES 100 frente a USD 70, ANUL 1.100 frente a 100, BIG 1.000 frente a 1.100 y OV-BIG 200 frente a 210.
5. **Falla silenciosa de 0414 con el código de `main`.** Fidelización `{}` para support, todo Bronze. Conversaciones con saldo 0, y 777 USD de T2 para el dual. OV «Facturas · 0».
6. **Fuga del Portal en `main`.** D2-01 de T2 visible desde un vínculo de T1; deja de verse tras 0414. El bloque `regression_reproduced` del contrato 0414 reproduce la lectura cruzada antes de aplicar.
7. **Matriz de escritura.** En `main` los roles no financieros escriben y borran; tras 0407 no.
8. **Test de inventario (ronda 2).** Un lector ficticio de `invoices` fuera de la lista lo hace fallar (19 archivos contra 18); retirado, vuelve a verde.
9. **Vuelta atrás (ronda 2).**
   - La foto de catálogo detecta el cambio de cada migración: con 0407, 4 líneas sólo antes y 6 sólo después; con 0414, 3 y 6. Tras la vuelta atrás vuelve a coincidir.
   - Revertir 0407 con 0414 aplicada aborta con «revertir 0414 primero» sin dejar nada a medias.

## VALIDACIÓN

### Ronda 1 — verify sobre el head de código

**`corepack pnpm verify` completo** sobre `961ec85eaf612b6ec9c6064721b56b6ef7ce2bf5`, el head de código:
- **Entorno.** Rama limpia sobre la base `bca98147`. Corrió de 2026-09-13T00:47:25Z a 01:24:20Z con Node v24.20.0, pnpm 12.3.4 y Docker 29.7.2.
- **Salida.** Verify sale con **1**: «1 fallo(s) → e2e», con el cierre además incompleto porque `migrations-applied` quedó sin medir.
- **Recibos.** `verify-961ec85e.log`, `verify-961ec85e-clean.log`, `verify-961ec85e.meta` y `verify-961ec85e.exit`.

| Paso | Veredicto | Cifras y motivo |
|---|---|---|
| harness | PASÓ | pruebas del harness de verify, worktree y watchdog |
| lint | PASÓ | — |
| rsc-boundary | PASÓ | 1.599 módulos de `app` y `lib` sin cruces |
| typecheck | PASÓ | — |
| edge-functions | PASÓ | 4 funciones compilan |
| test | PASÓ | 545 archivos y 6.817 pruebas de Vitest |
| docs:check | PASÓ | 444 specs |
| numbering | PASÓ | sin números repetidos |
| feature-constants | PASÓ | 5 banderas |
| components:check | PASÓ | — |
| governance:check | PASÓ | — |
| migrations-applied | NO DISPONIBLE | el worktree no tiene `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY`; es un paso crítico sin medir, y las cinco migraciones de L07 están pendientes por diseño |
| pending-migration-symbols | PASÓ | 0 ROJO · 3 AMARILLO declarados |
| sql-tests | PASÓ | 185 contratos con rollback total, incluidos `0407`, `0411`, `0412`, `0413` y `0414` |
| schema-rebuild | PASÓ | 424 migraciones desde cero (419 de `main` y 5 de L07) y aislamiento multi-tenant verificado (219 tablas, 2 tenants) |
| e2e | FALLÓ | diagnóstico abajo |
| build | PASÓ | — |

**Diagnóstico del e2e con el log, sin volver a correrlo.** Usó un dev server propio en el puerto 3191 y corrió 186 pruebas con 8 workers.
- **Primera pasada.** 15 fallidas, 1 flaky, 18 omitidas y 152 pasadas en 13,9 min, más «1 error was not a part of any test»: `worker-47 process did not exit within 300000ms after stop, force-killed it`. Ahí se colgó: un worker de Playwright no terminó al detenerse y el propio Playwright lo mató a los 300 s. Eso explica la duración frente al reintento. El watchdog de verify no intervino.
- **Reintento 1/1 («flaky conocido»).** Las mismas 15 fallidas, 1 flaky, 18 omitidas y 152 pasadas en 8,7 min, sin error fuera de pruebas ni corte del watchdog.
- **Las 15 fallidas son las previstas.** Son `e2e/auth.spec.ts:21`, `:91`, `:98` y `:105` y `e2e/global-search.spec.ts:22`, cada una en chromium, mobile-chrome y mobile-safari. Fallan por aserción (`toBeVisible` y `toHaveURL`) porque el servidor no tiene configuración de Supabase: el log repite «Your project's URL and Key are required to create a Supabase client!» desde `proxy.ts:67`.
- **La flaky es ajena a L07.** Es `e2e/calculadora-semantic-colors.spec.ts:53` en mobile-chrome: falló la variante light en la primera pasada y la dark en el reintento (`toHaveValue`, `:58`).
- **Cobertura de L07.** Ninguna prueba e2e entra con sesión a Fidelización, CRM, Reportes, Conversaciones ni Órdenes de venta. El código de L07 lo cubren Vitest, los contratos SQL y el arnés de PostgREST.
- **Procesos huérfanos, revisados al terminar.** No queda ningún proceso de verify, Playwright, `next dev` ni `chrome-headless-shell`, nada escucha en 3191 y no quedan contenedores `dtd_sqltest_*`, `dtd_rebuild_*` ni `dtd_l07_*`.
- **Commit del handoff de la ronda 1.** `0d247073` sólo agregó este archivo, sin cambios de código; por eso no se repitió verify.
- **CI.** El workflow de calidad no corre `sql-tests` ni `schema-rebuild`: esta corrida local es la única evidencia de esos dos pasos.

Validación focal previa, recibos en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/a4705ad7-612e-488b-9826-2cd036e3da72/scratchpad/c-l07-fidelizacion-conversations/`:
- `corepack pnpm vitest run` sobre fidelización, reportes, conversaciones, órdenes de venta, `orders-relations-batch` y `route-auth`: **PASÓ**, 14 archivos y 235 pruebas.
- Los cinco contratos L07 en PostgreSQL 17.11 efímero, en bases limpias: **PASÓ** (`results/contract-*.txt`). Controles rojos de timeouts: **FALLARON como se esperaba** (`results/redcontrol-*.txt`).
- `node scripts/check-pending-migration-symbols.mjs`: **PASÓ**, 0 ROJO y 3 AMARILLO (`gate-pending-symbols.log`).
- `node scripts/build-docs-index.mjs --check`: **PASÓ**, 444 specs (`gate-docs-check.log`). `node scripts/check-numbering.mjs`: **PASÓ**, sólo choques históricos (`gate-sdd-check.log`). `node scripts/build-governance-capsule.mjs --check`: **PASÓ**, 28 políticas (`gate-governance-check.log`).
- `git diff --check`: **PASÓ**. Ningún archivo tocado tiene CR.
- Inventario AST: `inventory-main-bca98147.txt` da 48 llamadas en 21 archivos; `inventory-l07-head.txt`, 45 en 18.
- Mediciones: `results/parity-{main,after0407,after0413,after0414}.json`, `results/write-{main,after0407,after0414}.txt`, `results/locks-*.txt`, `results/contention-*.txt` y `results/autocommit-set-local.txt`.
- Herramientas: `tools/measure-db.mjs`, `tools/seed-l07.sql`, `tools/parity.mts`, `tools/locks.sql`, `tools/contention.mjs`, `tools/write-matrix.sql`, `tools/make-redcontrols.mjs`, `tools/invoice-inventory.mjs` y `mainsrc/` (copias de `main` `bca98147`).
- `/ui-check`: **NO EJECUTADO** por no aplicar. No cambia ningún componente, estilo ni página: sólo `lib/`, una ruta API, SQL y documentación.

### Ronda 2 — validación proporcional

Sin verify completo: desde `961ec85e` no cambió código de producto ni SQL de migraciones. La corrida fue sobre `4200d1d669cabac8edcad951a004dbf9bea0a07f` (C8), con el árbol limpio y `origin/main` en `bca98147`, de 2026-09-13T01:54:26Z a 01:57:47Z (`round2/validations.meta`).

| Comprobación | Veredicto | Cifras |
|---|---|---|
| `corepack pnpm vitest run scripts/__tests__/invoice-read-boundary.test.mjs` (focal) | PASÓ | 3/3. Su control rojo FALLÓ como se esperaba (19 archivos contra 18) y al retirarlo volvió a PASAR 3/3 |
| `corepack pnpm test` | PASÓ | 546 archivos y 6.820 pruebas; en la ronda 1 fueron 545 y 6.817, y la diferencia es el test importado (`round2/val-test.log`) |
| `corepack pnpm harness:test` | PASÓ | 87 pruebas, 0 fallidas (`round2/val-harness-test.log`) |
| `node scripts/build-docs-index.mjs --check` | PASÓ | 444 specs |
| `corepack pnpm sdd:check` | PASÓ | sin números repetidos; sólo los choques históricos declarados |
| `git diff --check 961ec85e HEAD` y `git diff --check` del árbol | PASÓ | sin problemas |
| eslint focal sobre el test importado | PASÓ | sin avisos |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ | 0 ROJO · 3 AMARILLO; el baseline editado parsea |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ | 28 políticas |
| Prueba de vuelta atrás de 0407 y 0414 | PASÓ | 23 comprobaciones OK (sección «VUELTA ATRÁS DE 0407 Y 0414») |
| Sonda de la frontera del Portal | PASÓ | 5 casos, en la tabla de «Ronda 2» |
| `corepack pnpm verify` completo | NO EJECUTADO | no cambió código de producto ni SQL de migraciones desde `961ec85e`; vale la corrida de la ronda 1 |
| `/ui-check` | NO EJECUTADO | sin cambios de UI |

`git diff --stat 961ec85e..4200d1d6` (`round2/val-diff-stat.log`). La primera línea es este handoff tal como lo publicó la ronda 1:

```
 .../handoffs/c-l07-fidelizacion-conversations.md   | 393 +++++++++++++++++++++
 docs/specs/0350-invoices-write-rbac/spec.md        |   4 +-
 docs/specs/0357-invoices-read-rbac/spec.md         |  26 +-
 scripts/__tests__/invoice-read-boundary.test.mjs   |  88 +++++
 supabase/migrations-baseline.json                  |   4 +-
 5 files changed, 506 insertions(+), 9 deletions(-)
```

El commit que contiene este documento sólo cambia este archivo. Su `git diff --stat` final contra `961ec85e` va en la PR y en el reporte al Director.

Recibos de la ronda 2, en el scratchpad de la tarea:
- `round2/`: `validations.meta`, `val-*.log`, `test-invoice-read-boundary-{focal,redcontrol,after-revert}.log` y `pr-body-r2.md`.
- `results/rollback/`, `results/portal-pdf-probe.txt` y `results/branch-inventory-delta.txt`.
- `commit-msgs/c7.txt` y `commit-msgs/c8.txt`.
- Herramientas: `tools/rollback/`, `tools/read-matrix.sql`, `tools/portal-pdf-probe.sql` y `tools/branch-inventory-delta.mjs`.

## COMMITS

Ronda 1:
- `6330cb46` feat(studio): SDD-0350 y SDD-0354 a SDD-0357 — importar L07 SQL 0407, 0411–0414 y contratos, pendientes. Diez SQL idénticos al origen.
- `b6fdf92f` fix(db): SDD-0350 y SDD-0357 — 0407 y 0414 fijan lock_timeout y statement_timeout (L07). Desviación y aserciones.
- `f9bbf24d` feat(studio): SDD-0354, SDD-0355 y SDD-0356 — Fidelización, Conversaciones y Órdenes de venta leen facturas por RPC minimizada.
- `dddd918a` chore(db): declarar 0407 y 0411–0414 pendientes de aplicar y el degradado migrate-first (L07).
- `961ec85e` docs(specs): SDD-0350 y SDD-0354 a SDD-0357 — importar specs de L07 con nota de importación. Es el head de código verificado.
- `0d247073` docs(handoff): L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta. Primera versión de este documento; sólo lo agregó.

Ronda 2:
- `e952e4bd` test(studio): SDD-0357 — importar el test de inventario de lectores de invoices (L07, ronda 2). Test idéntico al origen.
- `4200d1d6` docs(db): SDD-0350 y SDD-0357 — esperas y notas de 0407 y 0414 con la vuelta atrás probada y la frontera del Portal (L07, ronda 2).
- Commit que contiene este documento: docs(handoff): L07 — ronda 2 (vuelta atrás probada, frontera del Portal, test de inventario y decisiones del Director). Sólo cambia este archivo.

## PR / BRANCH

- Rama `codex/c-l07-fidelizacion-conversations`, publicada a sí misma. La ronda 1 se publicó con un único push en `0d247073`, y la ronda 2 con otro único push normal, sin force, después de todos sus commits.
- PR #106 en borrador contra `main`: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/106. El cuerpo se actualizó en la ronda 2; el head final queda en la PR.
- Base `main` `bca98147`.
- Worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`, conservado.

## PENDIENTES DE ESTA TAREA

Ninguno para la aceptación de la extracción ni de la ronda 2. Lo que sigue pertenece a release o a decisión del Director, no a esta tarea:
- el conteo agregado de la fuga del Portal, que el Director pide a Sam;
- aplicar 0407 y 0411–0413 con autorización;
- fusionar y desplegar;
- el smoke por roles;
- 0414.

## FUERA DE ALCANCE DETECTADO

1. **Facturas borradas en lectores financieros.** Desde `0230_fix_rls_soft_delete_blocked.sql:36`, la RLS del equipo no filtra `deleted_at` y varios lectores tampoco lo hacen:
   - `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts:72`, `:130` y `:166`).
   - `receivablesQueue` (`lib/studio/payment-queries.ts:502`), que alimenta la cola de Cobranzas y los recordatorios por correo.
   - `financeInvoiceKpis` (`dashboard-kpi-queries.ts:49`), `revenueByShipment` (`costing/queries.ts:152`) y `applicableInvoicesForReferrer` (`referral-credit-queries.ts:131`).

   `softDeleteInvoice` no restringe el estado (`app/studio/(app)/facturacion/actions.ts:715-731`), así que una factura emitida borrada puede seguir contando o recibir recordatorios. 0414 conserva esa lectura para accounting y admin. Preexistente.
2. `commercialByAgent` traga el error de la facturación y publica ingresos por asesor en cero sin aviso (`lib/studio/reports/queries.ts:619`).
3. La página de Órdenes de venta pide relaciones por orden (`app/studio/(app)/ordenes-venta/page.tsx:39-57`). SDD-0322 está en `main` como spec, pero su código batch y el de la página no. En la ronda 2 el Director lo confirmó fuera del alcance de L07.
4. `get_portal_client_markbox()` y `get_user_tenant_id()` resuelven con `limit 1` sin orden. Un principal con varios vínculos o membresías obtiene un Shipping Mark o tenant arbitrario, y las tres RPC dependen de `get_user_tenant_id()`.
5. La server action `getReceivableHistory` no tiene gate de módulo (`app/studio/(app)/cobranzas/actions.ts:208-221`). Lee recibos y gestiones bajo RLS, no `invoices`.
6. `app/api/studio/__tests__/route-auth.test.ts:190` mockea `getClientContext` sin afirmar su argumento: no detectaría una vuelta a `conv.client_id`.
7. **Ruta del PDF del Portal sin guard de principal.** `app/portal/(app)/facturas/[code]/pdf/route.ts:41-44` lee la factura con `getMyInvoice` antes de resolver el principal, y `get_portal_client_markbox()` no comprueba cliente vivo ni tenant. Hasta aplicar 0414, un vínculo con cliente borrado o incoherente, y un Shipping Mark repetido en otro tenant, descargan por URL facturas que las páginas no les muestran (medido en la base: X01, D01 y D2-01 visibles). Con 0414 aplicada responde 404. Es parte de la fuga que el Director está dimensionando.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la ronda 2 de la PR #106. El orden de release no es un único paso DB: 0407 → 0411, 0412 y 0413, cada una con OK nominal de Sam y el runbook → fusión y despliegue → smoke por roles → 0414. Con la ronda 2 no quedan decisiones abiertas de L07.
- **Decisiones del Director (ronda 2), aplicadas:**
  1. **Divergencias de paridad:** aceptadas y listadas en la PR, en «Cambios de comportamiento visibles al desplegar».
  2. **Frontera del Portal con 0414:** aceptada. Declarada, sin mensaje de error, en la espera de 0414, la nota de 0357 y la PR, con la sonda de «Ronda 2».
  3. **Fuga del Portal:** sin cambios en L07; 0414 conserva su lugar.
  4. **Página de Órdenes de venta y SDD-0322:** fuera de alcance (FUERA DE ALCANCE 3).
  5. **Test de inventario:** importado sin ajustes, con control rojo.
  6. **Vuelta atrás:** escrita y probada; las esperas de 0407 y 0414 remiten a su sección.
- **Pendiente del Director: el conteo agregado.** Con autorización de Sam, sirve para dimensionar la fuga del Portal. Consulta sugerida, no ejecutada: sólo conteos y ninguna fila.

  ```sql
  select count(*) filter (where i.tenant_id <> cu.tenant_id) as facturas_de_otro_tenant,
         count(*) filter (where c.deleted_at is not null) as con_cliente_borrado,
         count(*) filter (where c.tenant_id <> cu.tenant_id) as con_vinculo_incoherente,
         count(distinct cu.auth_user_id) as principales
  from public.client_users cu
  join public.clients c on c.id = cu.client_id
  join public.invoices i on i.client_markbox = c.markbox
  where cu.status = 'active' and cu.auth_user_id is not null
    and i.deleted_at is null and i.status <> 'borrador'
    and (i.tenant_id <> cu.tenant_id or c.deleted_at is not null or c.tenant_id <> cu.tenant_id);
  ```

  - **Límite.** Es una cota superior: `get_portal_client_markbox()` toma un solo vínculo activo por usuario (`limit 1`).
- **Cambios compartidos.** Los tres registros entran en conflicto textual con las PR #104 y #105. Integrar en serie y regenerar el índice con el script.
- **Sesiones consumidoras.** Ninguna.
  - **Ronda 1.** Se retiraron los contenedores `dtd_l07_pg` y `dtd_l07_rest`, la red `dtd_l07_net` y el contenedor desechable `dtd_l07_expr`.
  - **Ronda 2.** Se levantaron y retiraron otra vez `dtd_l07_pg`, `dtd_l07_rest` y la red, para la prueba de vuelta atrás y la sonda del PDF.
  - **Claim.** Liberado al terminar la escritura de cada ronda.
