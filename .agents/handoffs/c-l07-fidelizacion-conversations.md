# L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta (0407, 0411–0413 → 0414)

Fecha: 2026-09-12. Task ID: `c-l07-fidelizacion-conversations`.
Owner / sesión escritora: `c-l07-fidelizacion-conversations-20260912` (Worker asignado por el Director; sin subagentes ni otras sesiones escritoras).
Estado de tarea: lista-para-revision. PR en borrador. **MIGRATE-FIRST: no fusionar antes de aplicar y verificar 0407, 0411, 0412 y 0413.** 0414 va después del despliegue de esta PR y del smoke por roles. Release y aplicación de migraciones quedan fuera de esta tarea.
Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`.
Rama: `codex/c-l07-fidelizacion-conversations`. Base: `origin/main` `bca98147672a6255192b62b247ab3f5c44061bb2`; comprobado sin cambios antes del verify y antes del push.
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

## OBJETIVO ORIGINAL

Extraer el lote L07 del bloque C desde la PR #21: el RBAC de escritura y lectura de `invoices` (0407 y 0414) y las tres facades que lo preparan, que son la facturación anual de Fidelización, CRM y Reportes (0411), el saldo de Conversaciones (0412) y las referencias de facturas de Órdenes de venta (0413). Traer su SQL, specs, código y pruebas, listo para revisión en una PR borrador contra `main`, sin aplicar nada a producción ni leer filas de negocio. Es el lote de mayor riesgo del bloque: restringe quién lee y escribe facturas.

## COMPLETADO

### Archivos y relación con el origen

Diff contra `origin/main` `bca98147`: 28 archivos de producto más este handoff.

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
| las cinco `docs/specs/…/spec.md` | origen más la nota de importación; frontmatter intacto |
| `docs/specs/README.md` | regenerado con `node scripts/build-docs-index.mjs`: 444 specs; 0350 y 0354–0357 salen de la lista de huecos |
| `supabase/migrations-baseline.json` | cinco esperas; `cutoff 238`, `$doc` y la espera de 0451 idénticos a `main`, comprobado por valor |
| `supabase/pending-migration-symbol-declarations.json` | tres declaraciones AMARILLO; `schemaVersion` y `$doc` idénticos a `main` |

La identidad se comprobó con `git hash-object` al importar y con `git rev-parse HEAD:<ruta>` contra `refs/dtd/pr/21:<ruta>`: el primer commit (`6330cb46`) guarda los diez SQL idénticos al origen y la desviación queda sola en el segundo (`b6fdf92f`). Los SQL van byte a byte (`-text` en `.gitattributes`) y se comprobó con Node que ningún archivo tocado tiene CR.

### Solapamientos con `main` y resolución

- Desde la base común, `main` sólo tocó dos líneas del alcance: `STATUS_TONES.abierto` pasó de `warning` a `info` y su expectativa en el test. Se conservan; de esos dos archivos sólo entra lo de L07.
- En el origen, `lib/studio/sales-orders/queries.ts` y `orders-relations-batch.test.ts` mezclan SDD-0322 (commit `1faff60b`: `listPrealertasBySalesOrder`, columna `sales_order_id` de prealertas, ítems de compra y lectura de las páginas) con SDD-0356 (`3ca9a79d`). Entra sólo 0356. La spec 0322 está en `main` sin ese código. El test recortado conserva los casos de facturas (agrupación por RPC sin consulta por orden, error que no se vuelve vacío y lote vacío) y agrega uno: el helper de una orden delega en la misma RPC. En el cliente falso, `from` lanza para probar que no hay lectura directa.
- `digest-extract.ts` y `monthly-digest.ts`, que la PR #21 cambió en la misma carpeta por observabilidad, no entran.
- `scripts/__tests__/invoice-read-boundary.test.mjs`, de la allowlist de SDD-0357, no entra: está fuera del alcance asignado.
- No hubo merge ni conflicto textual: `origin/main` no se movió durante la tarea.

### Esperas y declaración

- `supabase/migrations-baseline.json`: una espera por migración, en el estilo de las PR #104 y #105. Cada una lleva lo que hace la migración, el orden obligatorio de L07, las lecturas de catálogo previas (0407), la condición transaccional literal de `set local` (0407 y 0414), locks y contención medidos, qué rompe en silencio (0414) y el párrafo literal de autorización.
- `supabase/pending-migration-symbol-declarations.json`: `studio_client_annual_billing`, `conversation_client_outstanding` y `sales_order_invoice_refs` quedan AMARILLO con su sitio de llamada y la evidencia del degradado. El gate da `0 ROJO · 3 AMARILLO`.

### Specs importadas

Las cinco conservan el frontmatter de origen. Cada nota de importación, con el patrón de `0352-bank-reconciliation-rbac`, registra el origen y sus commits, los cortes, la paridad medida, el estado real **pendiente de aplicar** y los archivos que entran fuera de su allowlist: los registros de pendientes y este handoff. Las notas de 0350 y 0357 registran además la desviación de timeouts. Cada archivo del diff queda cubierto por la allowlist de alguna spec o por esas notas.

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
- **Inventario AST propio.** Recorre con TypeScript cada `from("invoices")`, con su cadena de métodos y su receptor, en `app/`, `lib/`, `components/`, `scripts/` y `supabase/functions/`. Da 48 llamadas de producción en 21 archivos y ninguna `.delete()`. Con L07 quedan 45 en 18, el mismo inventario que congelaba el origen.
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
| **Portal**: `listMyInvoices` y `getMyInvoice` (`lib/portal/portal-queries.ts:241` y `:280`) para lista, detalle y PDF | sesión, policy Portal | cliente Portal | policy por Shipping Mark sin tenant: con el mismo Shipping Mark en dos tenants lee facturas del otro (medido: D2-01 desde T1) | igual | un vínculo coherente conserva sus facturas. **Deja de ver**, sin error, las del otro tenant, las de un vínculo activo a un cliente borrado y las de un vínculo incoherente: la lista queda vacía y el detalle da `notFound` |
| Portal con service_role: `lib/portal/portal-legal-queries.ts:116`, `:200` y `:261` y `app/portal/(app)/facturas/[code]/reportar/actions.ts:86`, tras resolver el principal por sesión | service_role | cliente Portal | igual | igual | igual |
| Procesos: cron `kommo-contact-status` (`lib/studio/kommo-contact-status.ts:214`) | service_role | cron | igual | igual | igual |
| Funciones SQL definer que leen `invoices`: `next_invoice_code`, `comment_entity_in_tenant`, `document_entity_in_tenant` (0215/0314), `payment_reports_validate_invoice`, `get_portal_referral_program` (0404), `sales_order_claim_and_invoice` y `confirm_payment_report` | definer | según su gate | igual | igual | igual |
| Roles no financieros por PostgREST directo | sesión | — | 1.355 filas, incluidas 2 borradas | igual | **0 filas sin error** |

Fallas silenciosas marcadas:
1. 0414 con el código de `main` todavía desplegado, o revirtiendo sólo la app después de 0414.
2. 0412 aplicada sin el despliegue es inocua, pero desplegar sin 0412 degrada el panel en silencio.
3. Portal tras 0414: vínculo con cliente borrado o incoherente.
4. 0407 para escrituras por PostgREST de roles no financieros, sin camino desde la app.

Con L07 desplegado, ningún lector ni escritor legítimo se rompe, así que no hizo falta ningún arreglo fuera del allowlist.

## ANÁLISIS 3 — PARIDAD DE CADA FACADE CON EL CONSUMIDOR DE `main`

Cifras medidas con el arnés de postgrest-js y datos sintéticos, en la etapa «tras 0413»: RPC aplicadas y RLS todavía de `main` + 0407. Los tenants T1 y T2 comparten Shipping Marks.

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
1. **ENCONTRADO, grave; lo cierra 0414.** Con la policy Portal histórica (`supabase/migrations/0085_portal_invoices_rls.sql:19-25`) y el mismo Shipping Mark en dos tenants, un cliente Portal lee facturas de otro tenant, con nombre, RIF, montos y líneas: medido D2-01 desde un vínculo de T1. Le corresponden la CRBV art. 28 (acceso a los datos propios) y el art. 60 (confidencialidad). Arreglo: 0414 (`0414:62-80`) exige vínculo, cliente y tenant coherentes, y se midió que la exposición cesa. Pendiente de aplicar.
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
- Si hoy existe en producción el mismo Shipping Mark en dos tenants: el conteo agregado necesita autorización y no se leyó.
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
- No se preparó rollback SQL. Revertir 0414 exige recrear `invoices_team_select` y la policy Portal histórica, y reabre la fuga entre tenants. Revertir 0407 exige recrear la policy FOR ALL y el DELETE. Hay que evaluarlo aparte según el runbook.

## COORDINACIÓN CON PR ABIERTAS Y HALLAZGOS PREVIOS

- **PR #104 (L14, 0420–0423).** No comparte archivos de código con L07; comparte `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json` y `docs/specs/README.md`, así que habrá conflicto textual en el segundo merge. README y baseline usan el driver `dtd-generated-records`; las declaraciones se unen a mano. Interacción SQL:
  - Los comandos de L14 leen y actualizan `invoices` dentro de `payment_private.run_report_command`, que es definer y no pasa por RLS. Da igual el orden respecto de 0407 y 0414.
  - Los preflights de 0421 y 0422 sólo exigen `relrowsecurity` en `invoices`, sin huellas de sus policies ni de su ACL.
  - En el Portal, el detalle de factura de L14 sigue leyendo la factura con `getMyInvoice` por sesión, sujeto a la policy de 0414: el mismo resultado para un vínculo coherente.
  - `reportar/actions.ts` de L14 lee la factura con service_role después de resolver el principal, así que 0414 no lo afecta.
  - No hay solape de locks: 0414 bloquea `invoices` y 0420/0422 bloquean `payment_reports`.
- **PR #105 (L10, 0410 → 0415).** Sólo comparte los mismos tres registros. 0410 lee `invoices` como definer, y 0415 no toca `invoices`.
- **SDD-0390 y SDD-0397**, `done` en `main` sin todo su código. L07 no depende de ellas: la policy Portal de 0414 es autocontenida, con EXISTS sobre `client_users` y `clients`, evaluable con la RLS que `main` ya da al Portal (`client_users self or tenant read` y `clients portal self read`, verificadas en el catálogo). Las lecturas de facturas del Portal (`lib/portal/portal-queries.ts:235-300`) están fuera de sus allowlists. 0414 no corrige `get_portal_client_markbox()` (`limit 1` sin tenant).

## CONTROLES ROJOS

1. **Aserción estática de timeouts.** El contrato de 0407 contra el archivo de origen falla con `TEST 0407: lock_timeout y statement_timeout deben ir antes del primer lock o DDL (lock_timeout=0, statement_timeout=0, primera sentencia=25)`. El de 0414 falla con el mismo mensaje y `primera sentencia=5`. Con los archivos actuales, los cinco contratos pasan en bases limpias.
2. **Contención.** Sin tope, 13,99 s de espera y 11,99 s de cola. Con tope, 5,0 s y unos 3,0 s.
3. **Migrate-first.** PGRST202 en las tres RPC antes de aplicarlas; los consumidores lanzan (0411 y 0413) o devuelven null (0412).
4. **Paridad.** Casos donde `main` difiere: L07-DEC en Bronze frente a Silver, L07-A 3.623,45 frente a 2.650, principal dual 4.400,45 frente a 2.650, TIE en VES 100 frente a USD 70, ANUL 1.100 frente a 100, BIG 1.000 frente a 1.100 y OV-BIG 200 frente a 210.
5. **Falla silenciosa de 0414 con el código de `main`.** Fidelización `{}` para support, todo Bronze. Conversaciones con saldo 0, y 777 USD de T2 para el dual. OV «Facturas · 0».
6. **Fuga del Portal en `main`.** D2-01 de T2 visible desde un vínculo de T1; deja de verse tras 0414. El bloque `regression_reproduced` del contrato 0414 reproduce la lectura cruzada antes de aplicar.
7. **Matriz de escritura.** En `main` los roles no financieros escriben y borran; tras 0407 no.

## VALIDACIÓN

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
- **Commit del handoff.** El commit que contiene este documento sólo agrega este archivo, sin cambios de código; por eso no se repitió verify.
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

## COMMITS

- `6330cb46` feat(studio): SDD-0350 y SDD-0354 a SDD-0357 — importar L07 SQL 0407, 0411–0414 y contratos, pendientes. Diez SQL idénticos al origen.
- `b6fdf92f` fix(db): SDD-0350 y SDD-0357 — 0407 y 0414 fijan lock_timeout y statement_timeout (L07). Desviación y aserciones.
- `f9bbf24d` feat(studio): SDD-0354, SDD-0355 y SDD-0356 — Fidelización, Conversaciones y Órdenes de venta leen facturas por RPC minimizada.
- `dddd918a` chore(db): declarar 0407 y 0411–0414 pendientes de aplicar y el degradado migrate-first (L07).
- `961ec85e` docs(specs): SDD-0350 y SDD-0354 a SDD-0357 — importar specs de L07 con nota de importación. Es el head de código verificado.
- Commit que contiene este documento: docs(handoff): L07 — RBAC de facturas y facades de Fidelización, Conversaciones y Órdenes de venta. Sólo agrega este archivo.

## PR / BRANCH

- Rama `codex/c-l07-fidelizacion-conversations`, publicada a sí misma con un único push después de todos los commits.
- PR en borrador contra `main`, abierta después del push; su URL y el head final quedan en la PR y en el reporte al Director, porque no existen al commitear este documento.
- Base `main` `bca98147`.
- Worktree `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/c-l07-fidelizacion-conversations`, conservado.

## PENDIENTES DE ESTA TAREA

Ninguno para la aceptación de la extracción. Lo que sigue pertenece a release o a decisión del Director, no a esta tarea: aplicar 0407 y 0411–0413 con autorización, fusionar y desplegar, el smoke por roles y 0414.

## FUERA DE ALCANCE DETECTADO

1. **Facturas borradas en lectores financieros.** Desde `0230_fix_rls_soft_delete_blocked.sql:36`, la RLS del equipo no filtra `deleted_at` y varios lectores tampoco lo hacen:
   - `listInvoices`, `getInvoiceByCode` e `invoiceKpis` (`lib/studio/invoice-queries.ts:72`, `:130` y `:166`).
   - `receivablesQueue` (`lib/studio/payment-queries.ts:502`), que alimenta la cola de Cobranzas y los recordatorios por correo.
   - `financeInvoiceKpis` (`dashboard-kpi-queries.ts:49`), `revenueByShipment` (`costing/queries.ts:152`) y `applicableInvoicesForReferrer` (`referral-credit-queries.ts:131`).

   `softDeleteInvoice` no restringe el estado (`app/studio/(app)/facturacion/actions.ts:715-731`), así que una factura emitida borrada puede seguir contando o recibir recordatorios. 0414 conserva esa lectura para accounting y admin. Preexistente.
2. `commercialByAgent` traga el error de la facturación y publica ingresos por asesor en cero sin aviso (`lib/studio/reports/queries.ts:619`).
3. La página de Órdenes de venta pide relaciones por orden (`app/studio/(app)/ordenes-venta/page.tsx:39-57`). SDD-0322 está en `main` como spec, pero su código batch y el de la página no.
4. `get_portal_client_markbox()` y `get_user_tenant_id()` resuelven con `limit 1` sin orden. Un principal con varios vínculos o membresías obtiene un Shipping Mark o tenant arbitrario, y las tres RPC dependen de `get_user_tenant_id()`.
5. La server action `getReceivableHistory` no tiene gate de módulo (`app/studio/(app)/cobranzas/actions.ts:208-221`). Lee recibos y gestiones bajo RLS, no `invoices`.
6. `app/api/studio/__tests__/route-auth.test.ts:190` mockea `getClientContext` sin afirmar su argumento: no detectaría una vuelta a `conv.client_id`.
7. `scripts/__tests__/invoice-read-boundary.test.mjs`, de la allowlist de SDD-0357, no se importó. Su inventario congelado de 45 llamadas en 18 archivos coincide con esta rama.

## HANDOFF AL DIRECTOR

- **Siguiente acción.** Revisar la PR en borrador. El orden de release no es un único paso DB: 0407 → 0411, 0412 y 0413, cada una con OK nominal de Sam y el runbook → fusión y despliegue → smoke por roles → 0414.
- **Decisiones pendientes:**
  1. **Divergencias de las facades con `main`**, todas medidas y todas defectos de `main`. ¿Se aceptan tal como vienen o alguna RPC debe imitar a `main`?
     - 0411 excluye facturas borradas y con `issued_at` futuro, neta los negativos y suma exacto. En el umbral, L07-DEC pasa de Bronze a Silver. Los negativos y las fechas futuras sólo entran por SQL: la app fuerza montos ≥ 0 y fija `issued_at` al emitir.
     - 0412 excluye anuladas, lo que la spec busca, no trunca y resuelve el empate de moneda por código.
     - 0413 no trunca y oculta las facturas de órdenes borradas.
  2. **Cambio del Portal con 0414.** Un vínculo activo a un cliente borrado, o incoherente de tenant, deja de ver facturas sin error, y el principal dual conserva sólo su derecho Portal. ¿Conforme?
  3. **Prioridad de la fuga del Portal en `main`.** Con el mismo Shipping Mark en dos tenants, `main` la sigue exponiendo hasta aplicar 0414. Saber si hoy ocurre en producción necesita un conteo agregado autorizado.
  4. **Página de Órdenes de venta.** Sigue con una llamada RPC por orden (SDD-0322 sin código en `main`). ¿Lote aparte?
  5. **Import del test de inventario.** ¿Importar `invoice-read-boundary.test.mjs` en un lote propio?
  6. **Rollback.** Evaluar un plan de vuelta atrás para 0407 y 0414 antes de su OK individual.
- **Cambios compartidos.** Los tres registros entran en conflicto textual con las PR #104 y #105. Integrar en serie y regenerar el índice con el script.
- **Sesiones consumidoras.** Ninguna. Retirados los contenedores `dtd_l07_pg` y `dtd_l07_rest`, la red `dtd_l07_net` y el contenedor desechable `dtd_l07_expr` del borde bisiesto. Claim liberado al terminar la escritura.
