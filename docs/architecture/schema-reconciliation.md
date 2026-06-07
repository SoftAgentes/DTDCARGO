# Reconciliación de esquema · blueprint del Norte ↔ Supabase real

> **Qué es:** reconcilia el **blueprint de datos del Norte** (lo que el diseño dice que "debería existir") contra las **tablas realmente construidas en Supabase** (lo que existe en `supabase/migrations/`). Cada marker está **respaldado por una tabla/migración real** — nada inventado.
>
> **Snapshot:** 2026-06-07 · migraciones hasta `0113` · 116 tablas en 107 migraciones.
> **Método:** generado por barrido de `CREATE TABLE` en todas las migraciones + verificación adversarial (cada `✅` cita una tabla real; cada `❌` confirmado por ausencia total de candidata). Regenerable con `/radar` o re-corriendo el reconciliador.
>
> ⚠️ **Fuente del blueprint:** NO existe un `schema.prisma` en `_norte/` — el backend del Norte es un **handoff documental** (prototipo 100% mock en `localStorage`). Las entidades se derivan de `_norte/backend/API-CONTRACT.md` (mapea cada seam a un recurso REST), corroborado por los stores mock de `_norte/erp/data.jsx`.

## Resumen

| | Entidades |
|---|---|
| ✅ **built** (tabla real fiel) | **16** |
| 🟡 **partial** (existe pero fragmentado/incompleto) | **6** |
| ❌ **missing** (sin tabla) | **0** |
| **Total blueprint** | **22** |

**Completitud del modelo:** 16/22 = **73% built** · 27% partial · 0% missing.
**Hueco real principal:** ya **no quedan entidades sin tabla**. Lo que falta es **modelado/consolidación** (todo en 🟡): auth unificado, cola offline de entrada, catálogo de origen CN, reglas genéricas, salida multi-canal (WhatsApp/Telegram) e inbox del portal fragmentado. Ninguno es keystone — la capa legal (que bloqueaba Facturación) ya está cerrada (`0102`).

## Reconciliación por entidad

| Entidad (blueprint) | Estado | Tabla(s) real(es) | Nota |
|---|---|---|---|
| Tenant | ✅ | `tenants`, `user_tenants` | Multi-tenant raíz (`0001`). `markboxPrefix` no es columna (prefijo `DTD-` en `next_markbox()`). |
| Client (MARKBOX) | ✅ | `clients` | `0006` + enriquecida: `rif`/`doc_verify_*` (`0092`), `rif` unique (`0095`). status/last_login del portal viven en `client_users` (`0080`). |
| Quote / Cotización | ✅ | `quotes` | `0007`, máquina de estados draft→sent→accepted + `next_quote_code()`. |
| Shipment / Embarque | ✅ | `shipments`, `shipment_events` | `0002` + timeline. `shipment_documents` (`0086`). Contenedor DTDU → capa naviera (`0096`). Costos → `shipment_costs` (`0100`). |
| Payment / Cobro-Pago | ✅ | `payment_receipts`, `supplier_payments`, `supplier_bills` | Cobro (`0079`) + pago a proveedor + facturas del proveedor (`0088`). |
| Reception / Recepción CN | ✅ | `warehouses_cn`, `warehouse_receipts_cn`, `warehouse_receipt_items`, `warehouse_receipt_events`, `warehouse_receipt_photos` | `0008` + fotos (`0022`). Cabecera+items+eventos+fotos. |
| Dispatch / Despacho | ✅ | `dispatch_orders`, `dispatch_order_packages`, `qr_print_orders` | `0024` + cola QR (`0027`). |
| Route / Ruta del chofer | ✅ | `dispatch_routes`, `tms_routes` | `0024` (R-YYYY-NNNN, paradas) + TMS (`0011`). |
| Delivery / POD | ✅ | `dispatch_pods`, `shipments` | `0025` + columnas POD/GPS en shipments (`0009`/`0068`). |
| Rate / Tarifa (config) | ✅ | `rates` | `0005`: per_cbm/flat/min_charge + RLS por tenant + seed 6 rutas. |
| FeatureFlag | ✅ | `feature_flags` | `0042`: per-tenant en DB (superior al blueprint legacy que decía localStorage). |
| Invoice / Factura | ✅ | `invoices`, `legal_acceptances` | Tabla 100% built (`0077`, F-YYYY-NNNN, total, status, paid). **Promovido 🟡→✅:** el gate legal AUT-04 ("factura DDP exige aceptación vigente") **ya está respaldado** por `legal_acceptances` (`0102`); el cableado del gate en código es trabajo de app, no de modelo. |
| File / Archivo | ✅ | `documents`, `warehouse_receipt_photos`, `bug_attachments`, `shipment_documents`, `back_assets`, `expenses`, `dispatch_pods` | **Promovido 🟡→✅:** ya existe la tabla **genérica polimórfica `documents`** (SDD-0049, hub DMS) además de los binarios por dominio (path/URL a Supabase Storage). |
| Route catalog / Rutas (config) | ✅ | `route_cost_templates`, `shipment_costs`, `rates`, `dispatch_routes`, `dispatch_city_catalog` | **Promovido 🟡→✅:** la plantilla de costo multi-componente CN→VE (freight/customs/transport/handling/insurance/commission/other) **ya existe** — `route_cost_templates` (defaults por ruta+servicio) + `shipment_costs` (7 categorías USD) (`0100`/SDD-0053). El CRUD + auto-prefill es Slice C pendiente (no de modelo). |
| User / Profile (Auth+sesión) | 🟡 | `user_profiles`, `user_invitations`, `user_tenants`, `operario_pins`, `tms_drivers` | Concepto repartido (identidad/rol, PIN, conductor). Auth (token) lo maneja Supabase Auth, no tabla propia. Sin modelo unificado con `deviceId`/`vehicle`/`site`. |
| SyncBatch (outbox offline) | 🟡 | `outbox_push_events` | `0066` es push de **salida** (server→device). NO existe cola offline-first de **entrada** del operario; el patrón se maneja client-side. |
| City / Ciudad (config) | 🟡 | `ve_locality_catalog`, `dispatch_city_catalog`, `calculator_cities`, `ports` | Destino VE bien modelado (estados/ciudades/CP) + ciudades del calculador (`0110`/SDD-0055) + puertos marítimos (`ports`, `0096`). **Falta catálogo completo de origen CN** (ciudades/puertos de China) como entidad propia. |
| Rule / Regla (config) | 🟡 | `dispatch_rules`, `mail_rules` | No hay catálogo genérico `rules`. Reglas especializadas por dominio (despacho, mailing). |
| Notification (WhatsApp/Email/Push) | 🟡 | `mail_*` (logs/templates/rules/config/blacklist/signatures), `outbox_push_events`, `conversations`, `conversation_messages`, `bug_notifications`, `user_notification_prefs` | Email con infra completa (`0018`). Push (`0066`). Bandeja unificada inbound `conversations`/`conversation_messages` (`0106`/SDD-0056). **WhatsApp/Telegram NO tienen tabla de salida** persistida (deep-link/handoff). Sin tabla única multi-canal outbound. |
| LegalDoc / Documento legal | ✅ | `legal_docs` | **Promovido ❌→✅:** `0102` (SDD-0054 capa legal). T&C / Condiciones del Operador **versionadas** (fila por key+version, estado vigente|archivada, body jsonb). |
| LegalAcceptance / Aceptación T&C | ✅ | `legal_acceptances` | **Promovido ❌→✅:** `0102` (SDD-0054). Prueba legal **inmutable server-sellada** (AC-YYYY-NNNN, hash SHA-256, ip, accepted_at, atada a cbm/weight/total). Append-only por trigger DB. Respalda el gate AUT-04. |
| PortalInboxEvent / Bandeja del portal | 🟡 | `prealertas`, `conversations`, `conversation_messages` | **Promovido ❌→🟡:** el flujo cliente→ERP con badges ya tiene tablas — `prealertas` (compras/pre-arribo del portal, `0105`/SDD-0057 *in-progress*) + `conversations` (badge `unread_count`, `0106`). Aún **fragmentado** (no una única `PortalInboxEvent`) y SDD-0057 no cerrado. |

## Roadmap de Bloques financieros

> Numeración documentada **solo** en los front-matters de los specs financieros (no había doc dedicado). Estados citados de `docs/specs/README.md`.

| Bloque | Nombre | Spec | Estado |
|---|---|---|---|
| **1.1** | Facturación (núcleo financiero) | SDD-0021 | ✅ done |
| **1.2** | Contabilidad (plan de cuentas + diario/mayor + P&L/Balance) | SDD-0040 | ✅ done |
| **2.1** | Cobranzas (recibos + asiento del cobro + CxC) | SDD-0041 | ✅ done |
| **2.2** | Tesorería (Proveedores + CxP + órdenes de pago + asiento) | SDD-0044 | ✅ done |
| **3** | Fiscal · SENIAT (Libro Ventas/Compras, retenciones, IVA) | — | ⏳ pendiente · **sin spec** (existe `0018-aduana-seniat` pero es **aduana**, no los libros IVA) |
| **4** | Naviera & Consolidación (carriers + bookings/BL + LCL→FCL) | SDD-0047 | ✅ **done** (Slice A+B; tablas `carriers`/`bookings`/`consolidations`/`consolidation_items`/`sailings`/`container_types`/`ports` en `0096`, UI `/studio/naviera`) |
| **5** | Comercial (Dirección + Documentos + Fidelización + Reportes + Costing + Legal) | SDD-0048/0049/0051/0052/0053/0054 | 🟡 **mayormente done** (0048/0049/0051/0053/0054 done · 0052 Reportes approved) — falta Reportes Slice C + Costing Slice B-C |

## Notas de procedencia y correcciones

- **Regeneración 2026-06-07 (snapshot `0096`→`0113`):** **5 promociones** verificadas adversarialmente — `LegalDoc`+`LegalAcceptance` ❌→✅ (por `0102_capa_legal`, SDD-0054); `Invoice` 🟡→✅ (gate AUT-04 ya respaldado); `File` 🟡→✅ (`documents` genérica, SDD-0049); `Route catalog` 🟡→✅ (`route_cost_templates`, `0100`). `PortalInboxEvent` ❌→🟡 (`prealertas`+`conversations`). Conteo **11✅/8🟡/3❌ → 16✅/6🟡/0❌**. **Bloque 4 Naviera corregido a `done`** (SDD-0047 cerrado; la versión previa lo daba "en construcción"). **0 entidades sin tabla.**
- **Verificación adversarial:** cada `✅` cita tabla+migración real; cada promoción se confirmó leyendo el `CREATE TABLE` de su migración (no por nombre suelto). `documents` genérica (SDD-0049) ≠ `customs_documents` (`0010`).
- **Correcciones a datos previos circulantes:** una auditoría anterior (Explore) reportó "13✅/6🟡/7❌" y "bottleneck = entidad Container, Bloque 4 bloqueado 0%". Ambos eran incorrectos. El bottleneck histórico real era la **capa legal** (3 entidades) — **ya cerrado** por SDD-0054. El bottleneck vigente pasa a ser el **Bloque 3 Fiscal/SENIAT** (sin spec ni tablas).
- **Numeración de migraciones:** llega a `0113` con **107 archivos `.sql` / 116 tablas**. Hay huecos y sufijos a propósito (números tomados por ramas paralelas).
- `0044` Tesorería figura **done** en `specs/README`.
