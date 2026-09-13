---
sdd: "0462"
title: "Las facturas del Portal quedan ligadas al tenant del principal"
status: done
author: "Claude"
created: 2026-09-13
updated: 2026-09-13
supersedes: null
superseded_by: null
related: ["0042", "0177", "0281", "0287", "0298", "0359", "0382"]
confidencialidad: interno
---

# SDD-0462 · Las facturas del Portal quedan ligadas al tenant del principal

> Un cliente del Portal deja de ver facturas de otra empresa que tenga un cliente con
> su mismo Shipping Mark. Los lectores de facturas resuelven el principal Portal y
> filtran por su tenant y su Shipping Mark. La ruta del PDF resuelve el principal
> antes de leer la factura y toma los datos del emisor, cuentas incluidas, de ese
> tenant. Sin migraciones: la RLS de 0085 queda como riesgo residual, con la
> migración recomendada analizada.

## Contexto

- El Shipping Mark es único **por tenant** (`supabase/migrations/0006_clients.sql:23`,
  `unique (tenant_id, markbox)`), y el código de factura también
  (`supabase/migrations/0077_invoices.sql:48`).
- La policy Portal de facturas compara solo el Shipping Mark. `invoices portal self read`
  (`supabase/migrations/0085_portal_invoices_rls.sql:19-25`) usa
  `client_markbox = get_portal_client_markbox()`, y esa helper
  (`supabase/migrations/0080_portal_cliente.sql:49-55`) no mira el tenant ni la baja del
  cliente.
- En main, `listMyInvoices` (`lib/portal/portal-queries.ts:235-266`) y `getMyInvoice`
  (`:273-321`) resolvían el Shipping Mark con esa RPC y filtraban solo por
  `client_markbox` (`:246` y `:286`). `getMyInvoice` devolvía el `tenantId` de la
  propia factura (`:298`).
- La ruta del PDF (`app/portal/(app)/facturas/[code]/pdf/route.ts`) no pasa por el
  layout. Leía la factura con `getMyInvoice` (`:43`) antes de resolver el cliente, y los
  datos del emisor con el cliente admin para `inv.tenantId` (`:57-60`).
- L07 (PR #106) midió la exposición y la cierra en RLS con 0414, pero 0414 es el último
  paso de su lote MIGRATE-FIRST. Esta SDD cierra antes, y por su cuenta, la capa de
  aplicación.
- El principal de L18 ya está en main. `getPortalClientPrincipal`
  (`lib/portal/portal-queries.ts:111`) valida sesión, vínculo activo único, cliente vivo
  y coherencia entre cliente y tenant, y devuelve `tenantId`.

## Inventario de lectores de facturas del Portal (main `bca98147`)

- **Cliente:** «sesión» es el JWT del usuario, con RLS; «admin» es service_role, sin RLS.
- **Exposición:** la de un cliente Portal puro de T1 con el mismo Shipping Mark que un
  cliente de T2.
- **Medido:** con PostgREST 16.1 efímero (ver «Evidencia»); lo demás sale de leer el
  código.

| Camino | Lector | Cliente | Filtro en main | ¿Expone otro tenant en main? | Con SDD-0462 |
|---|---|---|---|---|---|
| Lista `/portal/facturas` (`app/portal/(app)/facturas/page.tsx:72`) | `listMyInvoices` | sesión | Shipping Mark de la RPC, `neq borrador` y vivas | **Sí, medido** | tenant y Shipping Mark del principal |
| Estado de cuenta en pantalla, `?vista=cuenta` (`facturas/page.tsx:201`) | `listMyInvoices` → `StatementLedgerTable` | sesión | igual | **Sí**, mismo lector | cerrado por el lector |
| Finanzas `/portal/finanzas` (`app/portal/(app)/finanzas/page.tsx:41`) | `listMyInvoices` | sesión | igual | **Sí**, mismo lector | cerrado por el lector |
| KPIs del inicio (`app/portal/(app)/page.tsx:53`) | `getDashboardKpis` → `listMyInvoices` (`portal-queries.ts:629-632`) | sesión | igual | **Sí, medido**: facturado 1277 en vez de 250 | cerrado por el lector |
| Detalle `/portal/facturas/[code]` (`facturas/[code]/page.tsx:25`, archivo de la PR #104, sin tocar) | `getMyInvoice` | sesión | código, Shipping Mark y `neq borrador` | **Sí, medido**: nombre, RIF, montos y líneas de T2. La factura propia con un código repetido en T2 daba 404 (PGRST116) | tenant y Shipping Mark del principal |
| Comprobante imprimible (`facturas/[code]/comprobante/page.tsx:68-71`) | `getMyInvoice` | sesión | igual | **Sí**, mismo lector | cerrado por el lector |
| Página de reportar pago (`facturas/[code]/reportar/page.tsx:27`, PR #104, sin tocar) | `getMyInvoice` | sesión | igual | **Sí**, mismo lector: total y saldo ajenos | cerrado por el lector |
| Acción de reportar pago (`facturas/[code]/reportar/actions.ts:75-92`, PR #104) | `from("invoices")` | admin | tenant de la fila `clients` del cliente del principal, código y Shipping Mark | No | sin cambio; la PR #104 la pasa a `principal.tenantId` |
| PDF de la factura (`facturas/[code]/pdf/route.ts:43-60`) | `getMyInvoice` y `getCompanyDataForTenant` | sesión y admin | factura antes del principal; emisor por `inv.tenantId`; oficinas y cuentas **sin tenant** (`lib/studio/company-queries.ts:118-129`) | **Sí, medido**: 200 con la factura y el emisor de T2, y cuentas bancarias de todos los tenants también en el PDF propio | principal primero, factura por tenant, emisor y cuentas del tenant del principal |
| Estado de cuenta en PDF (`facturas/estado-de-cuenta/pdf/route.ts:36-46`) | `getPortalClient` y `listMyInvoices` | sesión | igual que la lista | **Sí, medido**: el libro incluía facturas de T2 | cerrado por el lector; el emisor sigue saliendo de `getCompanyData` con sesión |
| Aceptación de términos, página y acción (`facturas/[code]/aceptar/page.tsx:54-67` y `aceptar/actions.ts:87-101`) | `getPendingAcceptanceInvoice` (`lib/portal/portal-legal-queries.ts:252-271`) | admin | tenant de la fila `clients` del cliente del principal, Shipping Mark, código y `borrador` | No, por código | sin cambio |
| Tarjeta de órdenes por aceptar del inicio (`app/portal/(app)/page.tsx:178-192`) | `listPendingAcceptanceInvoices` (`portal-legal-queries.ts:108-127`) | admin | igual | No, por código | sin cambio |
| Botón de aceptar en el detalle de envío (`app/portal/(app)/envios/[code]/page.tsx:131-151`) | `getPendingAcceptanceForShipment` (`portal-legal-queries.ts:188-211`) | admin | igual | No, por código | sin cambio |
| Programa de referidos (RPC `get_portal_referral_program`, `supabase/migrations/0404_portal_referidos_por_principal.sql:14-41`) | suma de facturas | definer | principal con tenant y Shipping Mark | No, por código | sin cambio |
| Rutas API del Portal (`app/api/portal/push/*`) | — | — | no leen facturas | No aplica | — |

En las lecturas con admin, el tenant sale de la fila `clients` del cliente del principal.
`getPortalClientPrincipal` ya exige que ese cliente pertenezca al tenant del vínculo, así
que coincide con `principal.tenantId`.

### Otras lecturas por Shipping Mark

| Lector en main | Tabla | RLS Portal en main | Medido | Clasificación |
|---|---|---|---|---|
| `listMyShipments` (`portal-queries.ts:164-189`, filtro `:173`), `getMyShipment` (`:196-228`, `:209`), `getPortalActivation` (`:544-548`) y `getNextArrival` (`:688-730`, `:699`) | `shipments` | por tenant desde 0416 (`0416_portal_shipments_tenant_boundary.sql:40-53`) | cliente puro: `ENV-T2-0009` no aparece en la lista ni en el detalle | hallazgo, sin exposición medida |
| `listMyDocuments` (`portal-queries.ts:329-362`, `:340`) | `shipment_documents` | por tenant desde 0416 (`:55-72`) | `doc-t2.pdf` no aparece | hallazgo, sin exposición medida |
| `listMyInvoiceReports` (`lib/portal/payment-report-queries.ts:68-85`, filtro `:78-79`; archivo de la PR #104) | `payment_reports` | **solo Shipping Mark** (`0195_payment_reports.sql:119-125`) | **expone**: el detalle de `F-2026-0001` lista el reporte de T2 | hallazgo de otro archivo y otro dueño (PR #104, que trae 0420) |

Ninguna entra en esta SDD. En envíos y documentos no se midió exposición, y
`payment_reports` vive en un archivo con dueño activo.

## Diseño

### Lectores

- `listMyInvoices` y `getMyInvoice` resuelven `getPortalClientPrincipal`. Sin principal
  devuelven `[]` o `null` sin consultar `invoices`. Con principal filtran por
  `tenant_id = principal.tenantId` y `client_markbox = principal.client.markbox`, además
  de `neq borrador` y `deleted_at is null`.
- `getMyInvoiceForPrincipal(supabase, principal, code)` es la lectura de detalle para
  quien ya resolvió el principal. La usa la ruta del PDF, para que una sola resolución
  gobierne la factura y el emisor. `getMyInvoice` delega en ella.
- Las llamadas `from("invoices")` no aumentan: siguen dos en `portal-queries.ts` y cero
  en las rutas. El conteo usa el mismo algoritmo AST que
  `scripts/__tests__/invoice-read-boundary.test.mjs` de la PR #106 y no cambia frente a
  main.

### Ruta del PDF

- **Orden:** principal, factura del principal, emisor.
- **404:** sin principal, sin factura, con factura ajena o con borrador responde el mismo
  `noEncontrado("Factura")` (404, «Factura no encontrado.», `private, no-store`), sin
  construir el cliente admin.
- **Emisor:** `getCompanyDataForTenant(createAdminClient(), principal.tenantId)`. El
  Shipping Mark impreso sale de `principal.client.markbox`.

### Datos del emisor

- `getCompanyDataForTenant` filtra `company_offices` y `company_bank_accounts` por
  `tenant_id`, como ya hacía con la fila de `tenants`. Con el admin no hay RLS: en main,
  el PDF imprimía las cuentas bancarias de todas las empresas (medido).
- **Studio.** `getCompanyData`, con sesión, llega a la misma función.
  - Para un usuario de un solo tenant no cambia nada: la RLS `… by tenant` ya filtraba por
    `get_user_tenant_id()`.
  - Con más de una membresía, `resolveTenantId` y `get_user_tenant_id()` hacen `limit 1`
    sin orden. Si caen en tenants distintos, antes se mezclaban la identidad de uno y las
    cuentas del otro; ahora las cuentas quedan vacías.

### Comentarios

La cabecera de la ruta del estado de cuenta en PDF describía una protección por la RPC que
ya no aplica. Se corrige el comentario sin tocar el código.

### Comportamiento visible

- Un cliente con su Shipping Mark repetido en otro tenant deja de ver las facturas de la
  otra empresa en la lista, el detalle, el comprobante, reportar, los KPIs, el estado de
  cuenta y el PDF. El detalle y el PDF responden 404.
- Su propia factura con un código que también existe en el otro tenant ahora abre; antes
  daba 404.
- El PDF muestra solo las cuentas bancarias de su empresa emisora.
- No cambian la UI ni los textos, y no hay migraciones.

## Evidencia

### Pruebas con control rojo

`lib/portal/__tests__/portal-invoices-tenant-boundary.test.ts` usa un transporte en
memoria que aplica los filtros y emula la policy 0085 y un service_role sin RLS.

- **Casos:** lista, filtros explícitos, detalle ajeno, código repetido, principal
  inválido (cinco casos), KPIs, PDF y estado de cuenta en PDF. Del PDF prueba el 404
  idéntico, el principal inválido, el orden principal → factura, el emisor y las cuentas.
- **Contra el código de producción de main: 13 fallos, todos por aserción.** Aparecen
  `F-T2-0009` en la lista, 877 en vez de 100, 200 en vez de 404, el principal resuelto
  después de la factura y las cuentas `0001-T1` y `0002-T2` juntas.
- **Casos que ya pasaban en main:** los 6 de principal inválido que main también cortaba
  (sesión anónima, sin vínculo y vínculo revocado, en lectores y PDF).
- **Con el arreglo:** verde.
- **Pruebas existentes:** `invoices.test.ts` suma la aserción de tenant, que da 2 fallos
  más contra main. `dashboard.test.ts` adapta su stub a la resolución por principal.

### PostgreSQL 17 + PostgREST 16.1 efímeros

- **Esquema.** Main reconstruido con el método de `scripts/check-schema-rebuild.mjs`: 419
  migraciones sobre PostgreSQL 17.11. La red es interna y PostgREST se publicó solo en
  127.0.0.1. Las únicas adaptaciones fueron que `auth.uid()` lea los claims de PostgREST
  y habilitar el rol `authenticator`.
- **Datos sintéticos:**
  - T1 y T2, cada uno con un cliente de Shipping Mark `DTD-9901`;
  - un vínculo Portal activo en T1;
  - facturas con código propio y con código repetido, y un borrador de T2;
  - reportes de pago, cuentas bancarias y oficinas.
- **Código.** Se ejecutaron las funciones y rutas reales del worktree, con `lib/db/server`
  y `lib/db/admin` reales. `next/headers` fue un shim, y `/auth/v1/user` se emuló
  verificando el JWT con el secreto de PostgREST.

| Lectura del cliente Portal de T1 | Antes (main) | Después (SDD-0462) | Después, con la policy candidata |
|---|---|---|---|
| `listMyInvoices` | `F-2026-0001` de T2 (250), `F-2026-0001` de T1, `F-T2-0009` de T2 (777) y `F-T1-0001` | `F-2026-0001` y `F-T1-0001`, de T1 | igual que después |
| `getMyInvoice("F-T2-0009")` | factura de T2 con nombre, RIF, total y líneas | `null` | `null` |
| `getMyInvoice("F-2026-0001")` | `null`: dos filas, PGRST116 | la de T1 | la de T1 |
| `getDashboardKpis` | facturado 1277, 4 pendientes | 250, 2 pendientes | 250, 2 pendientes |
| PDF de `F-T2-0009` | 200 con la factura de T2; el admin lee `tenants` de T2 | 404 idéntico al de inexistente y borrador, sin admin | 404 |
| PDF de `F-T1-0001` | 200, con cuentas `0001-T1` y `0002-T2` | 200; `tenant_id=eq.T1` en tenants, oficinas y cuentas; solo `0001-T1` | 200 |
| Estado de cuenta en PDF | libro con las 4 facturas | libro con las 2 de T1 | igual que después |
| Orden de lecturas del PDF | `invoices` antes que `client_users` | `client_users` antes que `invoices` | igual que después |
| PostgREST directo `GET /invoices` con el JWT del cliente | 4 filas, 2 de T2 con nombre, RIF y total | **4 filas: residual** | 2 filas, de T1 |
| PostgREST directo `GET /payment_reports` | 2 filas, 1 de T2 | 2 filas, 1 de T2 | 2 filas, 1 de T2 |
| Envíos y documentos | solo T1 | solo T1 | solo T1 |

## Riesgo residual

Hasta que se aplique una migración de RLS, la policy 0085 sigue comparando solo el
Shipping Mark. Un cliente del Portal puede usar su propio JWT, el de la sesión que ya tiene
en el navegador, contra PostgREST. Así lee las facturas no borrador de otro tenant con su
mismo Shipping Mark: nombre, RIF, montos, líneas y notas. Se midió antes y después del
arreglo. La app ya no lo muestra, pero la base lo sigue permitiendo. Lo mismo vale para
`payment_reports` (0195) hasta la 0420 de la PR #104.

## Migración recomendada (analizada, no escrita)

Una migración que reemplace **solo** `invoices portal self read`:

- con el predicado **idéntico, carácter por carácter,** al de la migración
  `0414_invoices_read_rbac` de la PR #106 (líneas 62-80 de su archivo, que todavía no
  está en main), el mismo nombre y `to authenticated`;
- con un preflight que exija esa policy y no dependa del estado de la policy de equipo:
  `invoices by tenant` antes de 0407, e `invoices_team_select` o
  `invoices_accounting_select` después;
- con un postflight de forma como el de 0416: `client_users`, `auth.uid()` y `tenant_id`,
  sin `get_portal_client_markbox`;
- con `lock_timeout` y `statement_timeout` locales, porque un DROP/CREATE POLICY toma
  ACCESS EXCLUSIVE sobre `invoices` durante un momento.

La convergencia se midió en copias de la base sembrada. La candidata se escribió solo en
el entorno efímero.

| Orden | Secuencia | Resultado |
|---|---|---|
| Cronológico: producción, con la candidata antes que L07 | candidata → 0407 → 0411 → 0412 → 0413 → 0414 | completa; el preflight de 0414 pasa |
| Numérico: schema-rebuild, con la candidata en 0452 o más | 0407 → 0411 → 0412 → 0413 → 0414 → candidata | completa |
| Referencia: la PR #106 sola | 0407 → 0411 → 0412 → 0413 → 0414 | completa |

Entre 0400 y 0451, todos los números están usados en main o reservados por las PR #104 a
#106; por eso la candidata iría en 0452 o más.

- **Mismo resultado.** Las tres secuencias terminan con el mismo catálogo de policies de
  `invoices` (md5 `345b2d1080a2e87e93639f2f0be8b28b`), y el cliente de T1 ve las mismas
  filas: `F-2026-0001` y `F-T1-0001`, de T1.
- **Condición.** La convergencia depende de que el predicado sea idéntico. Si difiere, el
  estado final depende del orden, y el rebuild numérico diverge de la producción
  cronológica.

Qué habría que ajustar en la PR #106:

- **SQL de 0414:** nada para converger. Su `drop policy "invoices portal self read"` sin
  `if exists` y su preflight siguen valiendo, porque la candidata conserva nombre y rol.
- **Textos de 0414:** su espera en `supabase/migrations-baseline.json` y la sección
  «Frontera del Portal al aplicar 0414» de la PR. Si la candidata va antes, esa frontera
  (vínculo coherente, cliente vivo y tenant) ya estaría vigente, y esa parte de 0414 no
  cambiaría nada.
- **Prueba:** `supabase/tests/0414_invoices_read_rbac.test.sql` arma su fixture con `\ir`
  de 0085 y de L07, sin la candidata, así que no cambia.
- **La candidata** necesitaría su propio contrato SQL y su espera en el baseline; no suma
  símbolos pendientes.

**Recomendación al Director:**

1. Integrar esta PR primero, sin dependencia de L07.
2. Pedirle a Sam el conteo agregado pendiente.
3. Asignar un número, 0452 o más, a la migración que cambia solo la policy Portal, con
   el predicado idéntico al de 0414, su contrato SQL y el ensayo de convergencia de
   arriba, y aplicarla antes de L07. Así se cierra el residual por PostgREST sin esperar
   el MIGRATE-FIRST de L07.
4. Si se prefiere esperar a 0414, el residual queda abierto hasta entonces, y conviene
   declararlo en la PR #106.

## Datos personales (`revisar-datos-ve`)

No es asesoría legal.

| Campo | Qué es | Finalidad | Quién lo veía de más |
|---|---|---|---|
| `invoices.client_name`, `client_rif` y `client_doc_kind` | identidad fiscal de una persona natural o jurídica | emitir y consultar su factura | el cliente Portal de otro tenant con el mismo Shipping Mark |
| `invoices.total_amount`, `paid_amount`, `lines`, `notes` y `shipment_code` | datos económicos y detalle de la mercancía; `notes` es texto libre | ídem | ídem |
| `company_bank_accounts.bank_name` y `account_number`; `tenants.legal_name` y `rif` | datos financieros y fiscales del emisor | pago de la factura | el cliente de otra empresa, dentro de su PDF |
| `payment_reports.amount`, `method`, `paid_at` y `note` | datos de pago de un cliente | conciliación | el cliente Portal de otro tenant (hallazgo de la PR #104) |

Hallazgos:

1. **ENCONTRADO, grave; esta SDD lo corrige en la app.** Los lectores de
   `lib/portal/portal-queries.ts:235-321` y la ruta
   `app/portal/(app)/facturas/[code]/pdf/route.ts:43-60`, ambos en main, entregaban
   facturas de otro tenant.
   - **Normas:** CRBV art. 28, derecho de acceso a los datos propios y a conocer su uso y
     finalidad, en registros oficiales o privados; y CRBV art. 60, confidencialidad y vida
     privada.
   - **Arreglo:** filtro por el tenant del principal, medido.
2. **ENCONTRADO; esta SDD lo corrige.** `lib/studio/company-queries.ts:118-129` leía en
   main, con service_role, las cuentas de todas las empresas para el PDF. Es un problema de
   minimización (SC 332/2001, principio de finalidad): el PDF solo necesita las cuentas
   del emisor.
3. **ENCONTRADO, residual.** `supabase/migrations/0085_portal_invoices_rls.sql:19-25` sigue
   permitiendo la lectura por PostgREST. El arreglo es la migración recomendada.
4. **ENCONTRADO, de otro dueño.** `lib/portal/payment-report-queries.ts:78-79` y
   `supabase/migrations/0195_payment_reports.sql:119-125`. El arreglo es filtrar
   `listMyInvoiceReports` por el tenant del principal, además de la 0420 de la PR #104.
5. **CORRECTO.**
   - El arreglo no agrega campos, columnas, logs ni tratamientos.
   - El PDF imprime lo mismo que antes, ahora solo del tenant correcto.
   - La medición usó solo datos sintéticos, sin ninguna lectura de producción.
6. **NO VERIFICABLE: si la exposición ocurrió en producción.** Hacen falta:
   - el conteo agregado de Shipping Marks repetidos entre tenants con vínculo Portal activo
     y facturas no borrador, que el Director tiene pendiente con Sam;
   - si el conteo es mayor que cero, los registros de acceso de la API y de las rutas del
     Portal, con retención suficiente.

   Nada de eso está en el repositorio, y tampoco consta si hoy existe más de un tenant con
   clientes Portal.

## Allowlist exacta

- `lib/portal/portal-queries.ts`
- `app/portal/(app)/facturas/[code]/pdf/route.ts`
- `app/portal/(app)/facturas/estado-de-cuenta/pdf/route.ts`
- `lib/studio/company-queries.ts`
- `lib/portal/__tests__/portal-invoices-tenant-boundary.test.ts`
- `lib/portal/__tests__/invoices.test.ts`
- `lib/portal/__tests__/dashboard.test.ts`
- `docs/specs/0462-portal-facturas-tenant/spec.md`
- `docs/specs/README.md`
- `.agents/handoffs/portal-facturas-tenant.md`

## Aceptación

- [x] Inventario de todos los caminos del Portal que leen facturas, con cliente, filtro y
      exposición.
- [x] `listMyInvoices` y `getMyInvoice` resuelven el principal, filtran por su tenant y su
      Shipping Mark, y fallan cerrado sin él.
- [x] La ruta del PDF resuelve el principal antes de leer la factura y usa
      `principal.tenantId` para el emisor. El 404 es idéntico para inexistente, ajena y
      borrador.
- [x] Las cuentas y oficinas del emisor salen solo de ese tenant.
- [x] Sin llamadas nuevas a `from("invoices")` y sin migraciones.
- [x] Sin cambios en los archivos de la PR #104.
- [x] Pruebas con control rojo contra el código de main, verdes con el arreglo.
- [x] Medición en PostgreSQL 17 y PostgREST efímeros, antes y después, con la RLS real de
      0085; contenedores y red retirados.
- [x] Riesgo residual medido y migración recomendada analizada, con su convergencia
      medida en los dos órdenes.
- [x] Revisión de datos personales, con constancia de lo no verificable.

La validación canónica, `pnpm verify` con su veredicto por paso, queda registrada en el
handoff.

## Producción

Esta SDD no trae migración.

- **Al desplegar:** se cierra la exposición en la app, es decir, en páginas, PDF y KPIs.
- **Residual:** el acceso por PostgREST sigue abierto hasta aplicar una migración de RLS,
  sea la recomendada o 0414.
- `done` en esta spec no significa desplegada.

Gobernanza:

- **No conformidad de aislamiento multi-tenant**, corregida en la capa de aplicación y
  verificada con PostgREST efímero. En producción queda NO VERIFICABLE.
- **Sin cambio visual ni de mensajes:** `/ui-check` no aplica.
