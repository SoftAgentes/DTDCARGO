# Reconciliación de esquema · blueprint del Norte ↔ Supabase real

> **Qué es:** reconcilia el **blueprint de datos del Norte** (lo que el diseño dice que "debería existir") contra las **tablas realmente construidas en Supabase** (lo que existe en `supabase/migrations/`). Cada marker está **respaldado por una tabla/migración real** — nada inventado.
>
> **Snapshot:** 2026-06-03 · migraciones hasta `0096` · 105 tablas en 93 migraciones.
> **Método:** generado por barrido de `CREATE TABLE` en todas las migraciones + verificación adversarial (cada `✅` cita una tabla real; cada `❌` confirmado por ausencia total de candidata). Regenerable con `/radar` o re-corriendo el reconciliador.
>
> ⚠️ **Fuente del blueprint:** NO existe un `schema.prisma` en `_norte/` — el backend del Norte es un **handoff documental** (prototipo 100% mock en `localStorage`). Las entidades se derivan de `_norte/backend/API-CONTRACT.md` (mapea cada seam a un recurso REST), corroborado por los stores mock de `_norte/erp/data.jsx`.

## Resumen

| | Entidades |
|---|---|
| ✅ **built** (tabla real fiel) | **11** |
| 🟡 **partial** (existe pero fragmentado/incompleto) | **8** |
| ❌ **missing** (sin tabla) | **3** |
| **Total blueprint** | **22** |

**Completitud del modelo:** 11/22 = **50% built** · 36% partial · 14% missing.
**Hueco real principal:** la **capa legal** (documentos + aceptaciones versionadas) y el **inbox del portal** — no existen como tabla.

## Reconciliación por entidad

| Entidad (blueprint) | Estado | Tabla(s) real(es) | Nota |
|---|---|---|---|
| Tenant | ✅ | `tenants`, `user_tenants` | Multi-tenant raíz (`0001`). `markboxPrefix` no es columna (prefijo `DTD-` en `next_markbox()`). |
| Client (MARKBOX) | ✅ | `clients` | `0006` + enriquecida: `rif`/`doc_verify_*` (`0092`), `rif` unique (`0095`). status/last_login del portal viven en `client_users` (`0080`). |
| Quote / Cotización | ✅ | `quotes` | `0007`, máquina de estados draft→sent→accepted + `next_quote_code()`. |
| Shipment / Embarque | ✅ | `shipments`, `shipment_events` | `0002` + timeline. `shipment_documents` (`0086`). Contenedor DTDU → capa naviera (`0096`). |
| Payment / Cobro-Pago | ✅ | `payment_receipts`, `supplier_payments` | Cobro (`0079`) + pago a proveedor (`0088`). |
| Reception / Recepción CN | ✅ | `warehouses_cn`, `warehouse_receipts_cn`, `warehouse_receipt_items`, `warehouse_receipt_events`, `warehouse_receipt_photos` | `0008` + fotos (`0022`). Cabecera+items+eventos+fotos. |
| Dispatch / Despacho | ✅ | `dispatch_orders`, `dispatch_order_packages`, `qr_print_orders` | `0024` + cola QR (`0027`). |
| Route / Ruta del chofer | ✅ | `dispatch_routes`, `tms_routes` | `0024` (R-YYYY-NNNN, paradas) + TMS (`0011`). |
| Delivery / POD | ✅ | `dispatch_pods`, `shipments` | `0025` + columnas POD/GPS en shipments (`0009`/`0068`). |
| Rate / Tarifa (config) | ✅ | `rates` | `0005`: per_cbm/flat/min_charge + RLS por tenant + seed 6 rutas. |
| FeatureFlag | ✅ | `feature_flags` | `0042`: per-tenant en DB (superior al blueprint legacy que decía localStorage). |
| User / Profile (Auth+sesión) | 🟡 | `user_profiles`, `user_invitations`, `user_tenants`, `operario_pins`, `tms_drivers` | Concepto repartido (identidad/rol, PIN, conductor). Auth (token) lo maneja Supabase Auth, no tabla propia. Sin modelo unificado con `deviceId`/`vehicle`/`site`. |
| Invoice / Factura | 🟡 | `invoices` | La **tabla** está 100% built (`0077`, F-YYYY-NNNN, total, status, paid). El `partial` es por el **gate legal (AUT-04)** — "exige aceptación legal vigente" — que NO está implementado (depende de LegalAcceptance, que es missing). |
| SyncBatch (outbox offline) | 🟡 | `outbox_push_events` | `0066` es push de **salida** (server→device). NO existe cola offline-first de **entrada** del operario; el patrón se maneja client-side. |
| File / Archivo | 🟡 | `warehouse_receipt_photos`, `bug_attachments`, `shipment_documents`, `back_assets`, `expenses`, `dispatch_pods` | No hay tabla genérica `File`; cada dominio referencia el binario por path/URL a Supabase Storage (`expenses.receipt_path`, etc.). Concepto cumplido pero fragmentado. |
| Route catalog / Rutas (config) | 🟡 | `rates`, `dispatch_routes`, `dispatch_city_catalog` | La plantilla de costo multi-componente CN→VE (freight/customs/transport/handling/insurance/commission) **NO existe** como columnas: `rates` solo tiene per_cbm/flat/min. |
| City / Ciudad (config) | 🟡 | `ve_locality_catalog`, `dispatch_city_catalog` | Destino VE bien modelado (estados/ciudades/CP). **Falta catálogo de origen CN** (ciudades/puertos de China). `ports` (`0096`) cubre puertos marítimos. |
| Rule / Regla (config) | 🟡 | `dispatch_rules`, `mail_rules` | No hay catálogo genérico `rules`. Reglas especializadas por dominio (despacho, mailing). |
| Notification (WhatsApp/Email/Push) | 🟡 | `mail_*` (logs/templates/rules/config/blacklist/signatures), `outbox_push_events`, `bug_notifications`, `user_notification_prefs` | Email con infra completa (`0018`). Push (`0066`). **WhatsApp NO tiene tabla de salida** persistida (es deep-link/handoff); Telegram tampoco. Sin tabla única multi-canal. |
| LegalDoc / Documento legal | ❌ | — | Confirmado por barrido completo: ninguna tabla `legal_docs`/`terms`/`tos`/`consent`. No hay T&C / Condiciones del Operador versionadas en DB. |
| LegalAcceptance / Aceptación T&C | ❌ | — | Ninguna tabla de aceptaciones (AC-YYYY-NNNN, hash, ip, server-time). El gate AUT-04 no está respaldado. |
| PortalInboxEvent / Bandeja del portal | ❌ | — | Ninguna tabla de eventos cliente→ERP con badge `read`. El portal (`0080`/`0091`/`0094`) cubre auth/registro/throttle; `comments` (`0090`) es hilo interno del Studio, no inbox del portal. |

## Roadmap de Bloques financieros

> Numeración documentada **solo** en los front-matters de los specs financieros (no había doc dedicado). Estados citados de `docs/specs/README.md`.

| Bloque | Nombre | Spec | Estado |
|---|---|---|---|
| **1.1** | Facturación (núcleo financiero) | SDD-0021 | ✅ done |
| **1.2** | Contabilidad (plan de cuentas + diario/mayor + P&L/Balance) | SDD-0040 | ✅ done |
| **2.1** | Cobranzas (recibos + asiento del cobro + CxC) | SDD-0041 | ✅ done |
| **2.2** | Tesorería (Proveedores + CxP + órdenes de pago + asiento) | SDD-0044 | ✅ done |
| **3** | Fiscal · SENIAT (Libro Ventas/Compras, retenciones, IVA) | — | ⏳ pendiente · sin spec |
| **4** | Naviera & Consolidación (carriers + bookings/BL + LCL→FCL) | SDD-0047 | 🟡 approved · **en construcción** (no done; tablas `consolidations`/`bookings`/`ports` en `0096`) |
| **5** | Comercial / Costing & margen + Documentos Hub (DMS) | SDD-0022 (reservado) | ⏳ pendiente · sin spec |

## Notas de procedencia y correcciones

- **Verificación adversarial:** la pasada de control confirmó la reconciliación sin degradar ningún verdict — cero markers inflados. Correcciones menores de evidencia (ej. la columna real es `expenses.receipt_path`, no `expenses.receipt`).
- **Correcciones a datos previos circulantes:** una auditoría anterior (Explore) reportó "13✅/6🟡/7❌" y "bottleneck = entidad Container, Bloque 4 bloqueado 0%". **Ambos eran incorrectos**: el conteo real es 11✅/8🟡/3❌, el Bloque 4 está *approved y en construcción* (SDD-0047), y los huecos reales son la capa legal + inbox del portal, no Container.
- **Numeración de migraciones:** llega a `0096` pero hay huecos a propósito (faltan `0061-0065`, `0089`) y números duplicados con sufijo (`0020`+`0020b`; dos `0057`; dos `0058`). 93 archivos `.sql`, 105 tablas.
- `0044` Tesorería figura **done** en `specs/README` (matiza la nota de memoria que lo daba como "commit local sin push").
