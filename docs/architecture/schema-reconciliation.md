# Reconciliación de esquema · blueprint del Norte ↔ Supabase real

> **Qué es:** reconcilia el **blueprint de datos del Norte** (lo que el diseño dice que "debería existir") contra las **tablas realmente construidas en Supabase** (lo que existe en `supabase/migrations/`). Cada marker está **respaldado por una tabla/migración real** — nada inventado.
>
> **Snapshot:** 2026-06-21 · migraciones hasta `0151` · ≈150 tablas en 146 migraciones.
> **Método:** generado por barrido de `CREATE TABLE` en todas las migraciones + verificación adversarial (cada `✅` cita una tabla real; cada `❌` confirmado por ausencia total de candidata). Regenerable con `/radar` o re-corriendo el reconciliador.
>
> ⚠️ **Fuente del blueprint:** NO existe un `schema.prisma` en `_norte/` — el backend del Norte es un **handoff documental** (prototipo 100% mock en `localStorage`). Las entidades se derivan de `_norte/backend/API-CONTRACT.md` (mapea cada seam a un recurso REST), corroborado por los stores mock de `_norte/erp/data.jsx`.

## Resumen · core API-CONTRACT (22 entidades)

> Estas 22 son el **piso** — el contrato original (`API-CONTRACT.md`). La **re-derivación completa contra el Norte v4.5** está abajo en su propia sección: ahí el blueprint crece a ~13 dominios / ~146 formas y aparecen los huecos nuevos (Nómina entera, Reclamos del cliente, libros fiscales).

| | Entidades |
|---|---|
| ✅ **built** (tabla real fiel) | **18** |
| 🟡 **partial** (existe pero fragmentado/incompleto) | **4** |
| ❌ **missing** (sin tabla) | **0** |
| **Total core** | **22** |

**Completitud del core:** 18/22 = **82% built** · 18% partial · 0% missing.
**Hueco real (dentro del core 22):** ya **no quedan entidades sin tabla**. Lo que falta es **modelado/consolidación** (todo en 🟡): auth unificado, cola offline de entrada, catálogo de origen CN y salida multi-canal (WhatsApp/Telegram). Ninguno es keystone — la capa legal (que bloqueaba Facturación) ya está cerrada (`0102`), el inbox del portal cerró con SDD-0057 (`0105`/`0118`/`0119`) y las reglas genéricas ya las cubre el motor de workflow por servicio (`0143`, SDD-0091).
**⚠️ Fuera del core**, la re-derivación v4.5 (abajo) **sí encuentra módulos enteros sin tabla** — el más grande, Nómina/RRHH.

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
| Rule / Regla (config) | ✅ | `service_workflow_steps`, `workflow_step_runs`, `dispatch_rules`, `mail_rules` | **Promovido 🟡→✅ (2026-06-19):** el **motor de workflow por servicio** (N8N-lite, SDD-0091, `0143`) es el catálogo genérico configurable de automatización (pasos + corridas) que faltaba; coexiste con las reglas especializadas por dominio (despacho, mailing). |
| Notification (WhatsApp/Email/Push) | 🟡 | `mail_*` (logs/templates/rules/config/blacklist/signatures), `outbox_push_events`, `conversations`, `conversation_messages`, `bug_notifications`, `user_notification_prefs` | Email con infra completa (`0018`). Push (`0066`). Bandeja unificada inbound `conversations`/`conversation_messages` (`0106`/SDD-0056). **WhatsApp/Telegram NO tienen tabla de salida** persistida (deep-link/handoff). Sin tabla única multi-canal outbound. |
| LegalDoc / Documento legal | ✅ | `legal_docs` | **Promovido ❌→✅:** `0102` (SDD-0054 capa legal). T&C / Condiciones del Operador **versionadas** (fila por key+version, estado vigente|archivada, body jsonb). |
| LegalAcceptance / Aceptación T&C | ✅ | `legal_acceptances` | **Promovido ❌→✅:** `0102` (SDD-0054). Prueba legal **inmutable server-sellada** (AC-YYYY-NNNN, hash SHA-256, ip, accepted_at, atada a cbm/weight/total). Append-only por trigger DB. Respalda el gate AUT-04. |
| PortalInboxEvent / Bandeja del portal | ✅ | `prealertas`, `prealerta_documents`, `conversations`, `conversation_messages` | **Promovido 🟡→✅ (2026-06-10):** SDD-0057 **done** — flujo cliente→ERP completo en prod con datos vivos: `prealertas` (`0105`) + adjuntos (`0118`) + link al proveedor `share_token` (`0119`) + bandeja `conversations` (`0106`/SDD-0056). Implementado como **composición de tablas especializadas** (no una única `PortalInboxEvent` genérica) — equivalente funcional, mismo criterio que `File`. |

## Re-derivación contra el Norte v4.5 (2026-06-21)

> Las 22 de arriba son el **API-CONTRACT core**. El Norte v4.2–v4.5 expandió el prototipo a **~13 dominios / ~146 formas de entidad**. Esta sección reconcilia esa superficie ampliada contra las **145 tablas reales** (`information_schema`, 2026-06-21). Método: barrido de `_norte/backend/API-CONTRACT.md` + stores mock (`erp/data.jsx`, `erp/modules/*-data.jsx`, `portal/*`, `academia-data.jsx`, `naviera-data.jsx`, `nomina-data.jsx`, `reclamos/`, `packlist/`, `inventario/`) cruzado contra las tablas reales. Las cifras `~` son aproximadas; los **huecos** de abajo están verificados (ausencia de tabla en las 145).

**Cobertura ampliada:** ~146 formas → **~100 con tabla** · **~16 vistas/derivados** (no son entidad) · **~30 huecos sin tabla**.

### Dominios NUEVOS ya respaldados por tabla (✅ · más allá de las 22)

- **Academia / LMS (8):** `academy_courses` · `_modules` · `_lessons` · `_cohorts` · `_enrollments` · `_lesson_progress` · `_attendance` · `_diplomas` (SDD-0093/0144/0145/0149).
- **Naviera & Consolidación (7):** `carriers` · `sailings` · `bookings` · `consolidations` · `consolidation_items` · `container_types` · `ocean_rates` (SDD-0047/0096, ocean 0146).
- **Oferta / Servicios (6):** `service_configs` · `service_addons` · `service_faqs` · `service_price_history` · `service_workflow_steps` · `workflow_step_runs` (SDD-0076/0090/0091, migr 0130/0142/0143).
- **Prealerta add-ons (3):** `prealerta_service_requests` · `prealerta_addons` · `prealerta_documents` (SDD-0098, migr 0150).
- **Packing list del proveedor (1):** `packing_list_submissions` (SDD-0097, migr 0148).
- **Proveedor CN (1):** `suppliers_cn` (catálogo operativo + rating + `wechat` como **campo**).
- **Financiero / contable:** `accounts` · `journal_entries`/`_lines` · `accounting_settings` · `currency_conversions` · `tenant_fx_history` · `purchase_orders`(+`_items`) · `sales_orders` · `renditions`(+`_receipts`) · `expenses`(+`_alerts`) · `collection_activities` · `fiscal_settings` (SDD-0040/0044/0073/0077/0079/0080/0124/0125).
- **Comunicación / colaboración:** `conversations`(+`_messages`) · `comments`(+`_mentions`/`_reactions`) · `referrals` (SDD-0045/0051/0056).
- **Cliente del portal:** `client_users` (auth+sesión separada de `clients`).

### Huecos del blueprint v4.5 (el Norte lo diseña · Supabase NO tiene tabla)

| # | Hueco | Fuente en el Norte | Estado | Nota |
|---|---|---|---|---|
| 1 ⭐ | **Nómina / RRHH completa** (~11: employee, payroll_rules, payroll_run, attendance, holidays, loans, registrations, invites, warnings, contractors, employee_comms) | `nomina-data.jsx` + API §10 | ❌ | **Módulo entero sin backend** — el hueco más grande del Norte v4.5. |
| 2 | **Reclamo / siniestro del cliente** | `reclamos/reclamos.jsx` | ❌ | `supplier_claim_offsets`/`supplier_credit_notes` cubren el lado **proveedor**, no el reclamo del **cliente** (daño/faltante/retraso + seguro). Hoy cae en `conversations`. |
| 3 | **Libros fiscales** (Libro Ventas / Compras + Retenciones) | `fiscal-data.jsx` | ❌ | Solo existe `fiscal_settings` (config). SDD-0073 clasifica por factura; los **registros** como tabla = V2. |
| 4 | **Conciliación bancaria + Activos fijos** | `conciliacion.jsx`, `contabilidad-data.jsx` | ❌ | Contabilidad sin esas 2 tablas (bank_statements, fixed_assets). |
| 5 | **Supplier↔Client (grupo WeChat)** | `SUPPLIER_CLIENTS` (`data.jsx`) | ❌ | Relación M:N con `wechatGroup` por par cliente↔proveedor. El **dato** WeChat ya vive en `suppliers_cn.wechat`; falta la **tabla puente**. |
| 6 | **Detección de ferias (IA)** + **Vault / No-olvidar** | `fairs-detection.jsx`, `vault.jsx` | ❌ | Vault = decisión founder (SDD-0025 **skip**). Ferias = store de aprobación IA sin tabla. |
| 7 | **Portal inbox** (seam `portalInbox`, API §5) | `data-bridge.jsx` | 🟡 | Sin tabla 1:1; se compone de `conversations`/`comments`/`outbox_push_events` (equivalente funcional, mismo criterio que `File`). |

### No son entidad (vistas / derivados — NO cuentan como hueco)

Dashboard · Scorecard de proveedor · Calendar (base) · Copilot · course progress · collection item (CxC, overlay de `invoices`) · settlement/liquidación · tier de fidelización · "próxima salida" · **Sistema de Movimiento** (spec visual) · **WeChat Perfil** (asset de marca). Todo computado sobre entidades reales.

### Tablas huérfanas (built, fuera del blueprint del Norte)

Integración/infra que el prototipo no modela (es lo inverso de un hueco, no deuda): Kommo (`kommo_*`, 8) · Bug Reporter (`bug_*`, 6) · Agentes (`agents`/`agent_*`/`skills`, SDD-0020) · CMS público (`back_*`/`news_*`/`seo_drafts`) · Calculadora (`calculator_*`) · `public_track_log` · `sync_logs` · `platform_admins` · `operario_pins`/`operario_push_subscriptions` · `portal_registro_throttle`.

## Roadmap de Bloques financieros

> Numeración documentada **solo** en los front-matters de los specs financieros (no había doc dedicado). Estados citados de `docs/specs/README.md`.

| Bloque | Nombre | Spec | Estado |
|---|---|---|---|
| **1.1** | Facturación (núcleo financiero) | SDD-0021 | ✅ done |
| **1.2** | Contabilidad (plan de cuentas + diario/mayor + P&L/Balance) | SDD-0040 | ✅ done |
| **2.1** | Cobranzas (recibos + asiento del cobro + CxC) | SDD-0041 | ✅ done |
| **2.2** | Tesorería (Proveedores + CxP + órdenes de pago + asiento) | SDD-0044 | ✅ done |
| **2.3** | Financiero con el Socio Logístico China (libro mayor bilateral + reconciliación) | SDD-0059 | 🟡 in-progress (confidencial) — migr `0114` (5 tablas: supplier_charges/credit_notes/currency_conversions/partner_ledger_entries/claim_offsets) + `0115` (partner_statements ×2) **en prod**; fuera del blueprint del Norte (no cuenta en el 17/22) |
| **3** | Fiscal · SENIAT (Libro Ventas/Compras, retenciones, IVA) | SDD-0073 | ✅ **done** (SDD-0073 v2 **LIVE en prod**, migr `0126`/`0141`: master toggle `fiscal_module_enabled` + Libro Ventas/Compras clasificados por `iva_mode` de cada factura; transporte de carga **exento** = default editable; reglas fiscales = config editable, no hardcode; retenciones-comprobantes/declaración = V2). `0018-aduana` es aduana, no libros IVA. |
| **4** | Naviera & Consolidación (carriers + bookings/BL + LCL→FCL) | SDD-0047 | ✅ **done** (Slice A+B; tablas `carriers`/`bookings`/`consolidations`/`consolidation_items`/`sailings`/`container_types`/`ports` en `0096`, UI `/studio/naviera`) |
| **5** | Comercial (Dirección + Documentos + Fidelización + Reportes + Costing + Legal) | SDD-0048/0049/0051/0052/0053/0054 | ✅ **done** (los 6 en prod; 0052 Reportes Slice A+B+C incl. Constructor + export CSV/PDF, marcado `done` 2026-06-12; 0053 Costing `done`) — fuera de V1 (bloqueado, no es deuda del bloque): "Por agente" (`quotes` sin owner) · "Posición IVA" (→ Bloque 3 Fiscal) |

## Notas de procedencia y correcciones

- **Re-derivación v4.5 (2026-06-21):** primera reconciliación contra el Norte **ampliado** (no solo el API-CONTRACT core de 22). Barrido de los 13 dominios del prototipo v4.5 vs las 145 tablas reales → **~100 con tabla, ~16 vistas/derivados, ~30 huecos**; el mayor = **Nómina entera** (≈11 entidades, API §10, cero tablas), luego **Reclamo del cliente** y **libros fiscales** (Ventas/Compras/Retenciones). Las 22 del core quedan como **piso** (18✅/4🟡/0❌ sin cambio). Ver sección «Re-derivación contra el Norte v4.5». Método: agente de enumeración sobre `_norte/` + verificación de ausencia de tabla contra `information_schema`.
- **Regeneración 2026-06-21 (snapshot `0147`→`0151`):** **0 promociones** — las 4 migraciones nuevas (`0148` dirección del proveedor en packing list, `0149` `academia_lesson_progress`, `0150` add-ons de prealerta, `0151` `clients.advisor_id`) son **extensiones de módulo / columnas, no entidades del blueprint** → conteo **18✅/4🟡/0❌ (82%) sin cambio**. ⚠️ Sigue pendiente la **re-derivación completa del blueprint contra el Norte v4.5** (las 22 entidades son un **piso**; Academia/WMS/Reclamos/Scorecard/Dashboard aún sin reconciliar).
- **Regeneración 2026-06-19 (snapshot `0119`→`0147`):** **1 promoción** — `Rule / Regla` 🟡→✅ (motor de workflow por servicio `service_workflow_steps`+`workflow_step_runs`, `0143`/SDD-0091 = catálogo genérico configurable de automatización). Conteo **17✅/5🟡/0❌ → 18✅/4🟡/0❌ (77%→82%)**. **Bloque 3 Fiscal/SENIAT promovido a `done`** (SDD-0073 v2 LIVE, `0126`/`0141`). Las demás migraciones `0120`–`0147` son **módulos nuevos o extensiones** que NO mueven el blueprint de 22: financiero (rendiciones `0123`, OC `0124`, OV `0125`/`0127`–`0129`, fiscal `0126`/`0141`, QBO `0131`, cierre `0133`), CRM (kommo writeback `0136`/`0137`/`0138`, users `0139`), contenido (service-configs `0130`, news `0140`, oferta `0142`), Academia LMS (`0144`, 7 tablas), ocean rates (`0146`), packing list del proveedor (`0147`). ⚠️ **El Norte v4.2–v4.4 sumó módulos nuevos (Academia, WMS/Inventario, Reclamos, Scorecard, Dashboard) que EXPANDEN el blueprint más allá de las 22 entidades del `API-CONTRACT.md` original** — una re-derivación completa contra el Norte v4.4 es tarea aparte; las 22 son hoy un **piso**, no el total del Norte vigente.
- **Regeneración 2026-06-10 (snapshot `0113`→`0119`):** **1 promoción** — `PortalInboxEvent` 🟡→✅ (SDD-0057 cerrado `done`; `prealertas`+`prealerta_documents`+`share_token`+`conversations`, verificado en prod con datos vivos: 3 proveedores, 2 prealertas con token). Conteo **16✅/6🟡/0❌ → 17✅/5🟡/0❌ (73%→77%)**. Las otras 4 migraciones nuevas no mueven el blueprint: `0114`/`0115` = **Bloque 2.3 Financiero Socio China** (SDD-0059, 7 tablas confidenciales fuera del blueprint del Norte, fila nueva en el roadmap) · `0116` versionado refuerza `File` (ya ✅) · `0117` RLS refuerza `Quote` (ya ✅).
- **Regeneración 2026-06-07 (snapshot `0096`→`0113`):** **5 promociones** verificadas adversarialmente — `LegalDoc`+`LegalAcceptance` ❌→✅ (por `0102_capa_legal`, SDD-0054); `Invoice` 🟡→✅ (gate AUT-04 ya respaldado); `File` 🟡→✅ (`documents` genérica, SDD-0049); `Route catalog` 🟡→✅ (`route_cost_templates`, `0100`). `PortalInboxEvent` ❌→🟡 (`prealertas`+`conversations`). Conteo **11✅/8🟡/3❌ → 16✅/6🟡/0❌**. **Bloque 4 Naviera corregido a `done`** (SDD-0047 cerrado; la versión previa lo daba "en construcción"). **0 entidades sin tabla.**
- **Verificación adversarial:** cada `✅` cita tabla+migración real; cada promoción se confirmó leyendo el `CREATE TABLE` de su migración (no por nombre suelto). `documents` genérica (SDD-0049) ≠ `customs_documents` (`0010`).
- **Correcciones a datos previos circulantes:** una auditoría anterior (Explore) reportó "13✅/6🟡/7❌" y "bottleneck = entidad Container, Bloque 4 bloqueado 0%". Ambos eran incorrectos. El bottleneck histórico real era la **capa legal** (3 entidades) — **ya cerrado** por SDD-0054. El bottleneck vigente pasa a ser el **Bloque 3 Fiscal/SENIAT** (sin spec ni tablas).
- **Numeración de migraciones:** llega a `0147` con **142 archivos `.sql` / ≈150 tablas** (sweep CREATE TABLE). Hay huecos y sufijos a propósito (números tomados por ramas paralelas).
- `0044` Tesorería figura **done** en `specs/README`.
