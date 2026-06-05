---
sdd: "0059"
title: "Financiero con el Socio Logístico China — libro mayor bilateral + reconciliación + cargos/notas de crédito (Bloque 2.3)"
status: in-progress
author: "founder"
created: 2026-06-05
updated: 2026-06-05
supersedes: null
superseded_by: null
related: ["0044", "0041", "0040", "0021", "0053", "0047", "0010"]
confidencialidad: confidencial
---

# DTD-0059 — Financiero con el Socio Logístico China

> Cierra la mitad **"China / proveedor"** del ERP: el **libro mayor bilateral** (USD + RMB + USDT)
> con el Socio Logístico China, la **reconciliación** periódica contra su estado de cuenta, y el
> modelo de **cargos / notas de crédito / cruces contables** que hoy se llevan a mano en Excel.
> Es el dolor que el propio spec del ERP marca como **el de mayor ROI de automatización**
> (doc operativo §2.4). Se monta sobre Tesorería (0044) y Contabilidad (0040); **no** los duplica.

---

## 1. Resumen en una línea

Capa de **cuenta corriente bilateral** con el Socio Logístico China (`partner_ledger_entries`, dual
USD/RMB con saldo neto corriente) + `supplier_charges` (cargos del socio con estado
`vigente/disputado/corregido/cancelado`) + `supplier_credit_notes` (correcciones vinculadas al cargo
original) + `currency_conversions` (USD/USDT/RMB con tasa por operación, base del spread forex como
revenue) + `partner_statements` (importar el estado de cuenta chino y **reconciliar línea por línea**) +
`supplier_claim_offsets` (cruce contable reclamo→proveedor→socio→cliente) + pagos a fábrica **PP/CA**
con alerta de plazo. Reusa `suppliers` (0044), `accounts`/`journal_entries` (0040). Asiento en USD
funcional vía `fx_rate`.

---

## 2. Contexto — el dolor

Hoy esta mitad del negocio vive **fuera del ERP**, repartida entre el Excel del Administrador China,
WeChat y QuickBooks (tecleo manual). Concretamente lo que no resuelve nada del sistema actual:

- **Libro mayor bilateral.** Cientos de transacciones a lo largo de años que balancean **a la vez en
  USD y RMB**; la posición neta cambia según el ciclo de pagos. No existe en el ERP.
- **Reconciliación periódica.** El Administrador China manda un estado de cuenta acumulado; Contabilidad
  VE lo compara línea por línea, identifica discrepancias, clasifica a cuenta contable y carga a
  QuickBooks. **Varias horas/semana de una persona dedicada** → el proceso de mayor ROI a automatizar.
- **Errores de facturación recurrentes** del socio (ej. línea `超重 Overweight` de 100-200 RMB que no
  corresponde a realidad física). Se corrigen de dos formas: descuento en el mismo Excel (línea
  negativa) **o** nota de crédito separada que llega días/semanas después. Sin modelo → riesgo de
  **pago duplicado**.
- **Cruces contables** (`claim_offsets`): cuando un cliente reclama a su fábrica, el dinero lo retiene
  el socio China a favor de DTD y se devuelve como descuento en la factura del cliente. **No es pérdida
  de margen** — pero sin modelarlo, los reportes de margen por cliente quedan contaminados.
- **PP/CA** (订金/余额): depósito + balance al pagar fábricas en nombre del cliente, a veces con crédito
  comercial 30-45 días. Sin tracking de balance pendiente ni alerta de plazo.
- **USDT como medio de pago** por restricciones cambiarias: hoy no queda trazable/contable.

### Qué ya existe (y se reusa, no se rehace)

| Pieza | SDD | Se reusa para |
|---|---|---|
| `accounts` (plan de cuentas) + `journal_entries` (asientos DR/CR) | 0040 | toda la contabilización del dominio |
| `suppliers` (`PRV-NNNN`, incluye `country='CN'`, `name_cn`) | 0044 | el Socio China **es** un supplier; las fábricas también |
| `supplier_bills` (CxP) + `supplier_payments` (órdenes de pago) USD/VES/USDT/CNY | 0044 | causación y pago individual; PP/CA se modela como bills/payments vinculados |
| `shipment_costs` (costo editable por embarque) | 0053 | enganche costo↔contenedor para margen neto |
| `containers` (modo, puerto/país destino, tasa del período) | 0047 | el costo de contenedor del ledger ata acá |

**Frontera de alcance:** 0044 modela transacciones **individuales** (una CxP, un pago). Este SDD agrega
la **cuenta corriente acumulada** con un contraparte específico (el socio), su **reconciliación** contra
un estado externo, y el modelo de **corrección** (charges/credit_notes) que 0044 no tiene.

---

## 3. Alcance

### Incluye

#### Backend (Supabase) — migración `0110_financiero_china.sql` (o siguiente libre)

- **`partner_ledger_entries`** — cuenta corriente bilateral con el socio:
  `id, tenant_id, supplier_id (FK suppliers, el socio China), entry_code (PLE-YYYY-NNNN),
  entry_type ('costo_contenedor'|'pago_fabrica_pp'|'pago_fabrica_ca'|'conversion_divisa'|'bl_courier'|
  'inspeccion_qc'|'registro_marca'|'hospitalidad'|'pago_aliado'|'nota_credito'|'ajuste'|'otro'),
  direction ('debe'|'haber') ,  amount_usd, amount_rmb, fx_rate (USD/RMB del movimiento), currency_paid
  ('USD'|'USDT'|'RMB'|'VES'), container_id (FK containers, nullable), shipment_id (FK shipments, nullable),
  charge_id (FK supplier_charges, nullable), occurred_on (date), description, description_cn (nullable),
  journal_entry_id (FK, opcional), created_at, deleted_at`. **Saldo neto corriente** (USD y RMB) se
  computa en `lib`, no se persiste (evita drift).
- **`supplier_charges`** — cada línea de cargo facturada por el socio:
  `id, tenant_id, supplier_id, container_id (nullable), description, description_cn, amount, currency,
  fx_rate, charged_on (date), status ('vigente'|'disputado'|'corregido'|'cancelado', default 'vigente'),
  reconciled (bool, default false), statement_line_id (FK, nullable), created_at, updated_at, deleted_at`.
  **`net_amount` NO es columna** (un generated column no puede sumar de otra tabla) → se **deriva en
  `charges-queries.ts`** = `amount − Σ supplier_credit_notes.amount aplicadas`. La query de listado lo
  devuelve calculado.
- **`supplier_credit_notes`** — correcciones posteriores vinculadas:
  `id, tenant_id, charge_id (FK supplier_charges restrict), reason, amount, currency, fx_rate,
  issued_on (date), document_id (FK documents 0049, nullable — adjunto), created_at, deleted_at`.
- **`currency_conversions`** — conversión de divisa con tasa por operación (base del spread forex):
  `id, tenant_id, from_currency ('USD'|'USDT'|'VES'), to_currency ('RMB'|'USD'), from_amount, to_amount,
  effective_rate, market_rate (nullable, referencia), spread_pct (computado), commission_amount,
  shipment_id (nullable), client_id (nullable), converted_on (date), journal_entry_id (FK, opcional),
  notes, created_at, deleted_at`. El **5% por cambio de moneda es revenue** (no costo) → cuenta de
  ingreso nueva en el plan (ver §5).
- **`partner_statements`** + **`partner_statement_lines`** — estado de cuenta chino importado.
  **➜ Diferido a Slice B** (va pegado a su UI de import + resolución; sin pantalla no se usa). Schema en §6.
- **`supplier_claim_offsets`** — cruce contable reclamo→cliente:
  `id, tenant_id, shipment_id, client_id, supplier_id, amount_usd, claimed_on, recognized_on,
  received_in_china_on, applied_to_client_on, evidence_document_id (FK documents, nullable),
  status ('reclamado'|'reconocido_proveedor'|'pagado_en_china'|'aplicado_a_cliente'|'cerrado'),
  client_invoice_id (FK invoices, nullable — dónde se aplicó el descuento), created_at, deleted_at`.
- **PP/CA**: no tabla nueva — se reusa `supplier_bills` (0044), que **ya tiene `shipment_id` nullable**.
  Solo se **agrega columna `bill_kind ('pp'|'ca'|'full')` default `'full'`** (back-compat: bills viejas
  quedan `full`). La obligatoriedad de `shipment_id` cuando `bill_kind in ('pp','ca')` es **validación en
  lib**, NO constraint NOT NULL (rompería filas existentes). La **alerta** de `due_date` vencido con
  balance pendiente (crédito 30-45d) → **Slice C** (reusa patrón `expense_alerts` 0075).
- **RPCs** de correlativos: `next_partner_ledger_code`, (charges/credit_notes/conversions usan
  `gen_random_uuid` + correlativo legible donde aplique). Patrón `next_markbox`/`next_supplier_code`.
- **RLS fail-closed por tenant** (patrón `get_user_tenant_id`, 0096/0098/0100) en **todas** las tablas.
- **Validación de integridad cross-tenant en la DB** (lección 0045/0093): helpers `supplier_in_tenant()` /
  `container_in_tenant()` + triggers `BEFORE INSERT/UPDATE` → un cliente PostgREST directo no puede colgar
  un cargo/entry de un supplier o container de otro tenant.

#### Backend (lib) — `lib/studio/partner-finance/`

- `types.ts` — enums + validators propios (no Zod, patrón DTD) + helpers de label/tone de estado.
- `ledger-queries.ts` — `getPartnerBalance(client, supplierId)` (neto USD + RMB), `listLedgerEntries`,
  `addLedgerEntry`. Saldo corriente derivado.
- `charges-queries.ts` — CRUD de cargos, aplicar nota de crédito (recomputa `net_amount`), transición de
  estado (vigente→disputado→corregido/cancelado) con guard.
- `reconciliation.ts` — parser del estado de cuenta + **motor de match** (por monto+fecha+descripción,
  fuzzy sobre `description_cn`). **➜ Slice B** (junto con sus tablas `partner_statements`).
- `conversions-queries.ts` — registrar conversión, computar spread + comisión como revenue.
- `claim-offsets-queries.ts` — máquina de estados del cruce.
- `posting.ts` — generación de asientos (DR/CR) por evento, en `accounting/` (patrón
  `bill-posting`/`supplier-payment-posting` de 0044).

#### Frontend (app) — `app/studio/(app)/financiero-china/` (o pestaña dentro de `tesoreria/`)

- **Vista cuenta corriente**: saldo neto USD/RMB del socio, timeline de entries, filtro por contenedor.
- **Cola de reconciliación**: importar estado de cuenta → tabla con match propuesto, resolver
  discrepancias, cerrar período.
- **Cargos**: lista con estado + acción "aplicar nota de crédito".
- **Conversiones**: registro + KPI de spread/comisión captada.
- **Cruces (claim offsets)**: tablero de estados.
- Admin-only / roles `CEO·Gerente·Contabilidad·Administración` (patrón gating de 0048: `user_tenants.role`).

### No incluye (diferido)

- **Integración QuickBooks** (push de asientos / pull) → SDD aparte (Bloque Fiscal); acá solo se deja el
  asiento USD funcional listo para exportar.
- **Ingesta automática de Excel/WeChat del Administrador China** → la importación del estado de cuenta es
  **upload manual** del archivo (CSV/XLSX) en Slice B; el parser WeChat es Fase 6 del plan macro.
- **Comisiones a asesores/aliados versionadas** y pricing multinivel por aliado → SDD comercial separado
  (es otro dolor del análisis, no este).
- Reconciliación **automática** sin intervención humana → siempre hay paso de revisión (el match es
  *asistido*, no ciego).

---

## 4. Flujos clave

### 4.1 PP / CA (pago a fábrica en nombre del cliente)
1. Se crea `supplier_bills` con `bill_kind='pp'` (depósito, % variable) ligada al `shipment`.
2. Asiento causación (DR Costo mercancía-cliente / CR Cuenta corriente Socio China).
3. Al despacho/recepción, `bill_kind='ca'` por el balance. Si hay crédito comercial, `due_date` +30-45d.
4. Alerta cuando `due_date` vence con balance pendiente.
5. Cada pago via socio → `partner_ledger_entries` (`direction='debe'`, moneda real USDT/RMB).

### 4.2 Reconciliación periódica
1. Llega estado de cuenta → upload → `partner_statements` + `partner_statement_lines`.
2. Motor de match cruza líneas vs `supplier_charges` + `partner_ledger_entries` del período.
3. Operador resuelve discrepancias (cargo erróneo → marcar `disputado`; nota de crédito → registrar).
4. Cerrar período → líneas `reconciled=true`, saldo confirmado.

### 4.3 Error de facturación → nota de crédito
- Cargo `超重 Overweight` entra como `supplier_charges` (`status='disputado'`). Cuando llega la
  corrección: `supplier_credit_notes` ligada → `net_amount` recalculado, cargo pasa a `corregido`.
  **Nunca se paga el `amount` bruto si hay nota aplicada** (guard en `posting.ts`).

### 4.4 Cruce contable (claim offset)
- `reclamado` → `reconocido_proveedor` → `pagado_en_china` → `aplicado_a_cliente` (descuento en
  `invoices`) → `cerrado`. El asiento neutraliza margen: no es pérdida, es devolución de valor ya cobrado.

### 4.5 Conversión de divisa + spread forex
- Cliente entrega USD/USDT en destino → DTD paga fábrica en RMB vía línea de crédito del socio.
- `currency_conversions` captura tasa efectiva vs referencia → `spread_pct` + `commission_amount` →
  asiento a **cuenta de ingreso "Ingresos por cambio de moneda"** (revenue, no costo).

---

## 5. Plan de cuentas — altas a sembrar (sobre 0040)

- **Cuenta corriente Socio Logístico China** — **una sola cuenta**; en doble partida el **signo del
  saldo** indica la posición (saldo acreedor = le debemos; deudor = nos retiene/nos debe). Se clasifica
  como pasivo (familia Proveedores) por ser el caso normal, pero puede portar saldo deudor sin problema.
- `4.x` **Ingresos por cambio de moneda** (revenue del spread forex).
- `5.x` **Costo de mercancía pagada a fábrica (por cuenta de cliente)** (contra-cuenta del cruce).
- Reusa `2.1.1` Proveedores (0044) para CxP individuales que no son cuenta corriente.

---

## 6. Slices (para el harness `/feature`)

- **Slice A — Foundation de datos (backend, SIN UI).** ✅ **implementado (harness `/feature`).**
  - Migración `0110_financiero_china.sql`: tablas `partner_ledger_entries`, `supplier_charges`,
    `supplier_credit_notes`, `currency_conversions`, `supplier_claim_offsets` + columna `bill_kind` en
    `supplier_bills` + RLS fail-closed por tenant + triggers cross-tenant (`supplier_in_tenant` /
    `container_in_tenant` vía `partner_finance_validate_refs`) + RPC `next_partner_ledger_code`. Altas de
    plan de cuentas (§5): `2.1.7` Cuenta corriente Socio China · `4.6` Ingresos por cambio de moneda ·
    `5.10` Costo de mercancía pagada a fábrica. **⚠️ pendiente: founder aplica `0110` a prod.**
  - `lib/studio/partner-finance/`: `types.ts`, `ledger-queries.ts`, `charges-queries.ts`
    (incl. `net_amount` derivado + aplicar nota de crédito), `conversions-queries.ts`,
    `claim-offsets-queries.ts`, `posting.ts` (asientos DR/CR en estilo `accounting/`).
  - Tests **67** (>≥30; patrón 0044/0096): validators, derivación de saldo neto USD/RMB, net_amount,
    máquina de estados de cargos y claims (transiciones válidas e inválidas), spread/comisión, posting
    balanceado DR=CR.
  - **Decisiones de implementación (drift menor sobre §3):**
    - `journal_entries` recibió 3 FKs aditivas (`charge_id` / `conversion_id` / `claim_offset_id`,
      nullable) para idempotencia del posting por origen — mismo patrón que `bill_id` (0088). El §3 no
      las listaba; se documenta acá.
    - `container_id` apunta a `public.consolidations` (el `Container` del blueprint, SDD-0047) — la
      entidad `containers` que la spec nombraba se materializó como `consolidations` en 0096.
    - Monedas del dominio (USD/USDT/RMB/VES) se modelan como `text` con CHECK (no reusa
      `invoice_currency`: RMB no está en ese enum).
    - `statement_line_id` en `supplier_charges` queda `uuid` SIN FK (la tabla destino es de Slice B).
  - **NO incluye:** `partner_statements`, motor de reconciliación, ninguna UI.
- **Slice B1 — Backend de reconciliación (SIN UI).** ✅ **implementado (harness `/feature`).**
  Migración `0112_partner_statements.sql` (se **cede `0111`** a SDD-0060 Documentos Versionado, que la tomó
  en paralelo): tablas `partner_statements` + `partner_statement_lines` (+ RLS fail-closed por tenant +
  triggers cross-tenant `statement_in_tenant`/`charge_in_tenant`/`ledger_entry_in_tenant`) + FK diferida
  `supplier_charges.statement_line_id → partner_statement_lines` (0110 la dejó sin constraint) + **trigger
  `charge_in_tenant()` sobre `supplier_credit_notes`** (cierra el follow-up del review de Slice A).
  `lib/studio/partner-finance/`: `reconciliation.ts` (motor de match PURO y DETERMINISTA — monto exacto +
  ventana de fecha ±N días → `alta`; monto exacto sin fecha cercana / fuzzy CN → `media`; aproximado →
  `baja`; clasifica `discrepancia`/`solo_en_estado`/`solo_en_erp`; consumo único de candidatos, greedy por
  confianza; sin `Date.now` — fechas/ventanas por parámetro) + `statements-queries.ts` (`createStatement`,
  `addStatementLines`, `listStatements`, `getStatementWithLines`, `applyMatchDecision`, `closeStatement`
  que marca `reconciled=true` en los cargos atados vía `markChargesReconciled` de `charges-queries`).
  Tipos/validators de statements/lines viven en `types.ts` (sección Slice B1). **+37 tests** (motor 30 +
  queries 7; objetivo era ≥25) → gate `node scripts/verify.mjs` verde end-to-end. **Aislado: no toca nada
  fuera de `partner-finance/` + su migración.** **Decisiones de implementación:**
    - `reconcileStatement` también reporta los `unmatched_charge_ids`/`unmatched_ledger_entry_ids` del ERP
      que ninguna línea consumió (= candidatos a `solo_en_erp`; la línea-fantasma se materializa en B2).
    - el monto comparable del ledger se elige por moneda de la línea (`RMB → amount_rmb`, resto `amount_usd`).
    - **⚠️ pendiente: founder aplica `0112` a prod.**
- **Slice B2 — UI `/studio/financiero-china`.** Cuenta corriente (saldo neto USD/RMB + timeline
  debit/credit/runBalance) + cola de reconciliación (subir estado de cuenta → match auto → confirmar/
  corregir/rechazar → cerrar período) + cargos + notas de crédito. **Diseño anclado** (§7).
  *Aquí vive el dolor de mayor ROI (reconciliación).*
- **Slice C — Avanzado.** Conversiones/forex como revenue (UI + KPI de spread), tablero de claim offsets,
  alertas PP/CA (`due_date` vencido), export de asiento para QuickBooks.

---

## 7. Diseño

✅ **DESIGN-CHECK resuelto (2026-06-05)** — la UI de Slice B2 ancla a dos patrones probados del Norte
vigente (`docs/design/studio/_norte/`, v2.4), que se adaptan al contexto socio China (son versiones
cliente/banco; el shell UX transfiere directo):
- **`erp/modules/conciliacion.jsx`** → cola de reconciliación: subir extracto → matches auto-sugeridos
  con confianza alta/media/baja → confirmar/rechazar/manual → exportar. KPIs + tabs + balance strip +
  detail panel con búsqueda de match manual.
- **`pantallas/estado-cuenta.jsx`** → cuenta corriente: `MovementsTable` con saldo corriente
  (debit/credit/**runBalance**) + `RatesBanner` (tasas + spread + "asientos @ source").

Al construir Slice B2 igual pasa por `ui-ux-designer` (check liviano). Slice A/B1 no tocan UI → no bloquean.

## 8. Confidencialidad

`confidencial`: el spec describe **estructura y flujos del sistema**, no cifras reales (márgenes, tasas
efectivas, montos del ledger, identidad del socio). Cualquier dato económico crudo va **fuera de git**
(Supabase + RLS, o Drive con puntero en `docs/legal/`) por regla de `AGENTS.md`. La especificación
operativa fuente vive bajo NDA fuera del repo.

## 9. Adjuntos

Diagramas de los 5 flujos (§4) y ejemplo de estado de cuenta anonimizado →
`docs/specs/0059-financiero-china/assets/` (cuando se construya Slice B).

---
<!-- Validar: node scripts/build-docs-index.mjs (docs:check). Índice en docs/specs/README.md se regenera con docs:index. -->
