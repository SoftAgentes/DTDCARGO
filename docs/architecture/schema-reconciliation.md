# Reconciliación de esquema · Blueprint Norte (v2.3) ↔ Supabase real

> **Qué es esto.** El Norte de Cloud Design (v2.3) trajo un **blueprint de backend**
> (`_norte/backend/prisma/schema.prisma` + `_norte/backend/API-CONTRACT.md` + el seam
> `_norte/nuevo/api/client.jsx`). Este documento **conecta ese blueprint con el backend real**
> (Next.js + Supabase) para que **no driften**: qué entidad del blueprint ya existe, cuál es
> parcial, cuál falta, y por dónde se construye lo que falta.
>
> **Fuente de verdad doble:** el blueprint es la **SPEC** (qué datos, qué endpoints, qué reglas);
> las migraciones `supabase/migrations/*.sql` son la **implementación**. Relacionado:
> [`module-sdd-map.md`](module-sdd-map.md) · briefs en `docs/design/studio/_norte/{BACKEND-BRIEF,PROMPT-BACKEND}.md`.

## Decisión de fondo (no re-discutir sin motivo)

1. **Nativo Supabase, NO Prisma.** El repo ya tiene 76 migraciones, multi-tenant + RLS, auth y 25
   módulos operativos. El `schema.prisma` se usa como **especificación de datos**, no se instala.
   No seguir `PROMPT-BACKEND.md` literal (asume "Vite + React + TS + Prisma desde cero" — eso ignora
   que el backend ya existe y es más avanzado que el blueprint en infraestructura).
2. **El seam `window.DTDApi` (mock↔rest) es del prototipo HTML, no de nuestro Next.js.** Nosotros no
   "flipeamos a modo rest": ya reconstruimos esas pantallas como Server Components contra Supabase.
   El seam solo importaría si alguien portara el prototipo tal cual — no es el caso.
3. **Lo que SÍ tomamos del blueprint:** el **modelo de datos** (para validar el nuestro y guiar lo que
   falta) y las **reglas de negocio que no se negocian** (MARKBOX/numeraciones server-side, `tenant_id`
   en toda query, moneda funcional USD + VES@BCV para fiscal, IVA flag de tenant OFF por defecto).
4. **Resolución de tenant — equivalencia, no copia.** El blueprint resuelve `tenantId` del JWT
   (`payload.tenantId`). Nosotros ya lo hacemos con `get_user_tenant_id()` (RPC security-definer sobre
   `user_tenants`, usado dentro de las policies RLS). Mismo principio, mecanismo propio. **No migrar a
   JWT con tenantId embebido.**

## El cruce: 20 modelos del blueprint ↔ tablas reales

> El `schema.prisma` declara "18 modelos" en su header pero **define 20** (incluye `JournalLine` y
> `AuditLog`). Estado: ✅ existe · 🟡 parcial/fragmentado · ❌ no existe.

| # | Modelo (blueprint) | Estado | Tabla(s) real(es) Supabase | Nota / dónde se construye |
|---|---|:--:|---|---|
| 1 | Tenant | ✅ | `tenants` | Multi-tenant raíz (1 seed: `dtd`). |
| 2 | User | 🟡 | `auth.users` + `user_tenants` + `user_profiles` + `operario_pins` | Identidad en Supabase Auth (no tabla `users` propia). Rol en `user_tenants`. |
| 3 | Client | ✅ | `clients` | MARKBOX `DTD-NNNN`, geo, foto fachada. |
| 4 | Supplier | ❌ | — | Módulo `proveedores` = placeholder. Proveedor CN hoy se infiere en recepciones/etiquetas. |
| 5 | Order | 🟡 | `dispatch_orders` (+`dispatch_order_packages`) | Eso es **orden de despacho/entrega VE**, no el "pedido comercial" del blueprint (`MARKBOX-prov-compra`). |
| 6 | Shipment | ✅ | `shipments` (+`shipment_events`) | Núcleo. |
| 7 | Box | 🟡 | `warehouse_receipt_items` (CN) · `warehouse_receipt_ve_boxes` (VE) · `dispatch_order_packages` | Concepto **fragmentado por superficie**, no unificado como `Box`. |
| 8 | Container | ❌ | — | Sin entidad. Aparece como *scope* en `expenses` + RPC `next_consolidation_code`. **Lo necesita Naviera/Consolidación.** |
| 9 | WarehouseEvent | ✅ | `warehouse_receipt_events` | + `shipment_events`, `entity_audit_log`. |
| 10 | Invoice | ✅ | `invoices` | SDD-0021: módulo Facturación (RPC `next_invoice_code` F-YYYY-NNNN, toggle `tenants.iva_enabled`). Asiento automático al emitir (SDD-0040); sin ledger de pagos (`paid_amount` acumulador). |
| 11 | Quote | ✅ | `quotes` | Cotizador completo (RPC `next_quote_code`). |
| 12 | Account | ✅ | `accounts` | SDD-0040: plan de cuentas jerárquico (seed 86 cuentas estándar transporte, editable). |
| 13 | JournalEntry | ✅ | `journal_entries` | SDD-0040: asientos doble partida (borrador/asentado/anulado), `next_entry_code` A-YYYY-NNNN, asiento automático desde factura. |
| 14 | JournalLine | ✅ | `journal_lines` | SDD-0040: líneas debe/haber (CHECK XOR). |
| 15 | ExchangeRate | 🟡 | `tenant_fx_history` | FX CNY/USD acotado a expenses; no catálogo general BCV/paralelo/CNY. (`rates` = tarifas de flete, otro concepto.) |
| 16 | Comment | ❌ | — | `bug_messages` es hilo acotado a bugs; no comentarios transversales con @menciones. |
| 17 | ScheduledEmail | 🟡 | dominio `mail_*` (`mail_logs/rules/templates/config`) | Motor de reglas event-driven existe; falta cola programada (`scheduledAt`). |
| 18 | TmsIncident | ✅ | `tms_incidents` | TMS completo. |
| 19 | Document | 🟡 | `customs_documents` · `bug_attachments` · `warehouse_receipt_photos` · `back_assets` | Sin DMS genérico `documents`; módulo `documentos` es stub. |
| 20 | AuditLog | ✅ | `entity_audit_log` | + logs específicos (`no_olvidar_access_log`, `bug_timeline`). |

**Resumen:** **10 ✅ · 6 🟡 · 4 ❌** (faltan: Supplier, Container, Comment + completar parciales). El patrón: el backend real es **fuerte en operación/logística**
(clientes, cotizaciones, envíos, almacenes CN/VE, despacho, TMS, aduana + infra: multi-tenant, agentes
IA, mailing, bug reporter, push, auditoría). El hueco es **la mitad financiera/contable del ERP** +
catálogos comerciales (Supplier, Container como entidad, Comment genérico).

## Hacia dónde vamos — roadmap por bloques

Cada bloque = uno o más SDD por el harness (`implement → verify → review`, `node scripts/verify.mjs`).
La UI ya está diseñada en el Norte; el blueprint da el shape de datos; **construimos nativo en Supabase**.

| Bloque | Qué | Entidades que cierra | SDD |
|---|---|---|---|
| **1 · Núcleo financiero ⭐** | Facturación (`Invoice`) → asiento automático → Contabilidad (`Account` + `JournalEntry/Line`, plan de cuentas, diario/mayor, P&L, balance) | Invoice, Account, JournalEntry, JournalLine | SDD-0021 (reservado) + nuevo SDD Contabilidad |
| **2 · Flujo de caja** | Cobranzas (CxC, registrar pago baja saldo) + Tesorería (CxP, multi-moneda USD/VES/USDT/CNY, remesas a China, aprobación multi-firma) | — (usa Invoice + cuentas de caja) | nuevos SDD |
| **3 · Fiscal (si IVA ON)** | Libro de Ventas desde facturas emitidas, retenciones, TXT/XML SENIAT. Toggle `tenants.iva_enabled` | — | nuevo SDD |
| **4 · Logística avanzada** | Naviera + Consolidación (entidad `Container`, bin-packing LCL→FCL por CBM/peso) + emisión BL | Container | nuevo SDD |
| **5 · Cierre comercial/BI** | Proveedores CN (entidad `Supplier`), Costing & Margen, Reportes/Dirección (tablero ejecutivo), Conversaciones (omnichannel), Fidelización/Referidos, Documentos Hub (`Document` genérico), Comentarios transversales (`Comment`) | Supplier, Document, Comment | SDD-0022 (Costing) + SDD-0023 (Reportes) + nuevos |

> Numeración: los **specs** (`docs/specs/NNNN`) y las **migraciones** (`supabase/migrations/NNNN`) son
> correlativos **independientes** (specs llegan a 0039; migraciones a 0076). Specs reservados sin escribir:
> 0021 (Facturación), 0022 (Costing), 0023 (Reportes). Nuevos SDD financieros: siguiente libre desde 0040.

## Reglas de negocio del blueprint a respetar al construir

- **MARKBOX / numeraciones server-side:** `DTD-NNNN` (cliente), `DTDU-NNNNNN` (embarque), `F-2026-NNNN`
  (factura), + `CXP-`/`REF-`/`REC-`/`DOC-`. Ya hay RPCs de correlativo por tenant (`next_markbox`,
  `next_quote_code`, `next_consolidation_code`); extender el patrón a `F-`/`CXP-` al construir finanzas.
- **Moneda funcional USD**, VES @ BCV solo para lo fiscal (declaración SENIAT en bolívares).
- **IVA/SENIAT = flag de tenant, OFF por defecto** → `tenants.iva_enabled` (ya existe `feature_flags`;
  decidir si IVA va ahí o como columna dedicada). Con OFF se oculta toda la capa fiscal.
- **`tenant_id` en toda tabla operativa + RLS fail-closed** (ya es el estándar del repo).

## Mantenimiento

Documento **vivo**. Actualizar cuando: (a) se construya una entidad (✅), (b) llegue un nuevo handoff que
cambie el blueprint (NORTE-SYNC), (c) se cree un SDD financiero. El cruce de arriba es el termómetro de
"cuánto del ERP-meta ya es real".
