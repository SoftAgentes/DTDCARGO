---
sdd: "0115"
title: "Financiero China Slice C — forex como revenue · claim offsets · alertas PP/CA · parser de estado de cuenta"
status: draft
author: "Claude Code (redactor) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0059", "0110", "0044", "0040", "0075", "0049", "0047"]
confidencialidad: confidencial
---

# SDD-0115 · Financiero China Slice C — forex revenue · claim offsets · alertas · parser

> **Cierre del Slice C de [SDD-0059](../0059-financiero-china/spec.md).** SDD-0059 sembró
> en Slice A toda la **foundation de datos** del dominio (tablas `currency_conversions`,
> `supplier_claim_offsets`, columna `bill_kind` en `supplier_bills`) + las **queries puras**
> que las exponen (`conversions-queries.ts`, `claim-offsets-queries.ts`, `getForexRevenue()`).
> Slice B2 levantó la UI del módulo `app/studio/(app)/financiero-china/` con **3 tabs**
> (reconciliación · cuenta corriente · cargos). Lo que falta — y que el §6 de SDD-0059 dejó
> nombrado como "Slice C — Avanzado" — es que el **cliente exponga lo que ya vive en `lib`**:
> conversiones/forex como revenue, tablero de claim offsets, alertas PP/CA, y el parser de
> archivo del estado de cuenta (hoy alta manual).

## 0. Por qué — y qué NO es

**Objetivo:** convertir las piezas de `lib/studio/partner-finance/` que hoy **no tienen
superficie** en funcionalidad operativa, cerrando los 4 huecos del Slice C que el audit v4.5
marcó como pendientes:

1. **Spread forex como revenue (~5%).** `currency_conversions` + `computeConversionSpread()` +
   `getForexRevenue()` ya existen, pero **ninguna pantalla** registra una conversión ni muestra
   el KPI de comisión captada. El 5% por cambio de moneda es **ingreso del dominio**, no costo —
   pero hoy no se ve ni contabiliza.
2. **Cruce reclamo→proveedor→china→cliente (claim offsets).** `supplier_claim_offsets` con su
   máquina de estados lineal (`reclamado → reconocido_proveedor → pagado_en_china →
   aplicado_a_cliente → cerrado`) y `transitionClaimOffset()` ya existen en lib; falta el
   **tablero** y la UI de avance de estado.
3. **Alertas PP/CA de `due_date` vencido.** `bill_kind ('pp'|'ca'|'full')` ya está en
   `supplier_bills`. Falta el **detector de vencidos con balance pendiente** (crédito comercial
   30-45 días) reusando el patrón `expense_alerts` de SDD-0075.
4. **Parser CSV/XLSX del estado de cuenta.** Hoy el `ImportStatementDrawer` es **alta manual**
   línea por línea (`// TODO: upload CSV/XLSX`). El Administrador China manda formatos
   **heterogéneos** (Excel/CSV con columnas variables, descripciones en chino). Falta el
   parser + mapeo de columnas.

**Qué NO es:**
- **NO crea modelo de datos nuevo de cero.** El grueso de las tablas ya existe (Slice A). Este
  slice agrega **a lo sumo** tablas auxiliares menores (alertas, mapeo de columnas del parser) y
  **superficie** (tabs, actions, KPIs).
- **NO resuelve la contabilización real del revenue forex por sí solo.** El asiento DR/CR del
  spread depende del **keystone de posting [SDD-0110](../0110-posting-keystone/spec.md)** (ver §7).
  Mientras 0110 no aterrice, el forex se **registra y reporta** pero el `journal_entry_id` queda
  diferido — el revenue se ve en el KPI, no en el libro mayor.
- **NO es ingesta automática WeChat/Excel del Administrador China** — eso sigue siendo Fase 6 del
  plan macro (diferido en SDD-0059 §3). El parser de Slice C es **upload manual** de un archivo
  que el operador sube; el parser solo evita el tecleo línea por línea.

## 1. Resumen en una línea

Cuatro superficies sobre foundation ya sembrada: **tab Conversiones** (registrar conversión +
KPI de spread/comisión como revenue) + **tab Cruces** (tablero de claim offsets con máquina de
estados) + **alertas PP/CA** (detector de `due_date` vencido con balance pendiente, patrón
`expense_alerts`) + **parser CSV/XLSX** (mapeo de columnas heterogéneas → líneas de estado de
cuenta, reemplaza el alta manual del `ImportStatementDrawer`). Reusa `conversions-queries.ts`,
`claim-offsets-queries.ts`, `getForexRevenue()`, `reconcileStatement()` ya existentes. El asiento
del forex revenue **depende de SDD-0110**.

## 2. Contexto — qué ya existe (y se reusa, no se rehace)

| Pieza | SDD / archivo | Estado | Se reusa para |
|---|---|---|---|
| `currency_conversions` (tabla + RLS + trigger cross-tenant) | 0059 Slice A | ✅ prod (migr 0114) | tab Conversiones |
| `computeConversionSpread()` + `addConversion()` + `listConversions()` + `getForexRevenue()` | `conversions-queries.ts` | ✅ existe | registrar conversión + KPI revenue |
| `supplier_claim_offsets` (tabla + RLS + trigger) | 0059 Slice A | ✅ prod (migr 0114) | tab Cruces |
| `transitionClaimOffset()` + `canTransitionClaimOffset()` + `nextClaimOffsetStatus()` | `claim-offsets-queries.ts` | ✅ existe | máquina de estados del tablero |
| Columna `bill_kind ('pp'|'ca'|'full')` en `supplier_bills` | 0059 Slice A | ✅ prod (migr 0114) | base de la alerta PP/CA |
| `expense_alerts` (patrón de alerta de vencimiento) | 0075 | ✅ prod | molde de la alerta PP/CA |
| `ImportStatementDrawer` (alta manual de líneas) | 0059 Slice B2 | ✅ prod | se le agrega el parser |
| `reconcileStatement()` (motor de match puro) | `reconciliation.ts` | ✅ existe | corre igual sobre las líneas parseadas |
| `documents` polimórfica + bucket | 0049 | ✅ prod | adjuntar el archivo crudo del estado de cuenta + evidencia del cruce |

**El hueco real es de superficie, no de modelo.** El cliente
(`FinancieroChinaClient.tsx`) hoy expone solo `Tab = "reconciliacion" | "cuenta" | "cargos"`. Las
queries de conversiones y claim offsets **no se importan en ningún componente** del módulo.

## 3. Alcance

### Incluye

#### Frontend (app) — `app/studio/(app)/financiero-china/`

- **Tab Conversiones** (`ConversionsTab.tsx` + `ConversionDrawer.tsx`):
  - Lista de conversiones (vía `listConversions`) con `from_currency → to_currency`, monto,
    `effective_rate` vs `market_rate`, `spread_pct`, `commission_amount`.
  - Drawer "Registrar conversión" → server action `createConversionAction` (`addConversion`).
  - **KPI de revenue forex** (`getForexRevenue`): comisión total captada + count. Etiqueta
    explícita: **"Ingreso por cambio de moneda"** (es revenue, no costo).
  - `<NumericInput type="currency">` para montos/tasas; expresiones aritméticas inline.
- **Tab Cruces** (`ClaimOffsetsTab.tsx` + `ClaimOffsetDrawer.tsx`):
  - Tablero por estado (columnas o filtro: `reclamado`/`reconocido_proveedor`/`pagado_en_china`/
    `aplicado_a_cliente`/`cerrado`) vía `listClaimOffsets(supabase, status?)`.
  - Drawer "Nuevo cruce" → `createClaimOffsetAction` (`addClaimOffset`, arranca `reclamado`).
  - Botón "Avanzar estado" → `advanceClaimOffsetAction` (`transitionClaimOffset` con guard);
    usa `<ActionButton>` (side-effect: sella fecha-hito + opcional `client_invoice_id`).
  - Adjuntar evidencia (`evidence_document_id`, reusa `documents` 0049).
- **Alertas PP/CA** (banner/cola en tab Cuenta corriente o vista propia):
  - Lista de `supplier_bills` con `bill_kind in ('pp','ca')`, `due_date < today` y balance
    pendiente > 0 → fila de alerta con días de atraso + monto.
  - Query nueva `listOverduePartnerBills(supabase)` en `lib`.
- **Parser CSV/XLSX** en `ImportStatementDrawer`:
  - Upload del archivo → preview de filas → **mapeo de columnas** (qué columna es descripción,
    monto, moneda, fecha) → líneas pobladas que entran al flujo de match existente
    (`reconcileStatement`).
  - El archivo crudo se adjunta al `partner_statement` (reusa `documents` 0049) para auditoría.

#### Backend (lib) — `lib/studio/partner-finance/`

- `statement-parser.ts` — parser **puro y determinista** (recibe el texto/buffer ya leído, no
  hace I/O): CSV vía split robusto; XLSX vía librería (ver Decisión D3). Devuelve filas crudas +
  inferencia de mapeo de columnas (heurística por header). Sin `Date.now`, fechas por parámetro.
- `alerts-queries.ts` (o ampliar `ledger-queries.ts`) — `listOverduePartnerBills()` que computa
  balance pendiente de bills `pp`/`ca` y filtra vencidas. Puro: recibe `SupabaseClient` + fecha
  de corte por parámetro.
- `posting.ts` — **ya tiene** la generación del asiento de conversión (cuenta `4.6 Ingresos por
  cambio de moneda`); se enlaza al keystone SDD-0110 cuando aterrice (ver §7). Mientras tanto el
  `journal_entry_id` de la conversión queda `null` (registro sin posteo).

#### Backend (Supabase) — migración `0178_financiero_china_slice_c.sql` (número tentativo)

> **Confirmar el correlativo de migración con el Director antes de escribir** — out-of-order es
> riesgo conocido (ver memoria SDD-0106). El número real lo asigna la coordinación.

- **`partner_bill_alerts`** (opcional · ver Decisión D2) — si se persiste la alerta en vez de
  derivarla: `id, tenant_id, bill_id (FK supplier_bills), kind ('pp_ca_overdue'), due_date,
  pending_amount, currency, status ('abierta'|'resuelta'|'descartada'), created_at, resolved_at,
  deleted_at`. Patrón `expense_alerts` (0075). **Alternativa sin tabla:** derivar la alerta en
  query pura (sin persistir) → preferida si no hace falta historial de alertas.
- **`partner_statement_column_maps`** (opcional · ver Decisión D3) — recordar el mapeo de
  columnas por formato de socio para no re-mapear cada vez: `id, tenant_id, supplier_id,
  format_label, column_map (jsonb), created_at`. Si se descarta, el mapeo es per-upload (no se
  recuerda).
- **RLS fail-closed por tenant** (patrón `get_user_tenant_id`) en cualquier tabla nueva.
- **Defensa-en-DB cross-tenant** (lección 0045/0093): helpers `bill_in_tenant()` /
  `supplier_in_tenant()` + triggers `BEFORE INSERT/UPDATE` para tablas nuevas que referencien
  `supplier_bills`/`suppliers`. Si no se agrega tabla nueva, no hay migración.

#### Gating

- Admin-only / roles `CEO · Gerente · Contabilidad · Administración` (patrón de SDD-0048 vía
  `user_tenants.role`), igual que el resto del módulo financiero-china.

### No incluye (diferido)

- **Asiento contable real del forex revenue** → depende de **SDD-0110** (keystone de posting). Acá
  se deja el registro + KPI; el posteo se enchufa cuando 0110 esté.
- **Ingesta automática WeChat/Excel** del Administrador China → Fase 6 del plan macro. El parser
  de Slice C es upload manual.
- **Export de asiento para QuickBooks** → Bloque Fiscal aparte (ya diferido en SDD-0059 §3).
- **Reconciliación automática sin humano** → siempre hay paso de revisión (match asistido).

## 4. Flujos clave

### 4.1 Registrar conversión + revenue forex
1. Operador abre tab Conversiones → "Registrar conversión".
2. Ingresa `from_currency/to_currency`, montos, `effective_rate`, `market_rate` (referencia).
3. `addConversion` computa `spread_pct` + `commission_amount` (`computeConversionSpread`).
4. KPI "Ingreso por cambio de moneda" suma `getForexRevenue`.
5. **(con SDD-0110)** asiento DR Caja/Socio China / CR `4.6 Ingresos por cambio de moneda`.

### 4.2 Cruce contable (claim offset)
1. Cliente reclama a su fábrica → operador crea cruce (`reclamado`).
2. Avanza por la máquina: `reconocido_proveedor` → `pagado_en_china` → `aplicado_a_cliente`
   (descuento en `invoices`, sella `client_invoice_id`) → `cerrado`. Cada avance sella su
   fecha-hito.
3. El asiento neutraliza margen (no es pérdida; es devolución de valor ya cobrado).

### 4.3 Alerta PP/CA vencida
1. Bill `pp`/`ca` con crédito comercial 30-45d y `due_date` pasado con balance pendiente.
2. `listOverduePartnerBills` la detecta → fila de alerta con días de atraso + monto.
3. Operador resuelve (paga / marca resuelta).

### 4.4 Parser del estado de cuenta
1. Llega archivo del Administrador China (CSV/XLSX, formato variable).
2. Upload → `statement-parser.ts` lee filas + infiere mapeo de columnas.
3. Operador confirma/corrige el mapeo (descripción/monto/moneda/fecha).
4. Líneas pobladas entran al flujo existente: `reconcileStatement` corre el match auto.
5. Archivo crudo se adjunta al `partner_statement` (auditoría).

## 5. Modelo de datos propuesto

El grueso ya existe (Slice A). Lo nuevo de este slice es **opcional** y queda sujeto a las
decisiones de §9:

- **`partner_bill_alerts`** (solo si se persiste la alerta — Decisión D2).
- **`partner_statement_column_maps`** (solo si se recuerda el mapeo — Decisión D3).

Ambas, si existen, siguen el contrato del repo: `tenant_id` + RLS fail-closed + helper
`*_in_tenant()` + trigger same-tenant para las FKs polimórficas/cross-tenant. **Si las dos
decisiones caen en "derivar/no persistir", este slice no toca migraciones** y es 100% superficie
+ `lib` puro.

## 6. Slices / fases (para el harness `/feature`)

- **Slice C1 — Conversiones + revenue forex (UI, sin migración).** Tab Conversiones +
  `ConversionDrawer` + `createConversionAction` + KPI `getForexRevenue`. Reusa queries existentes.
  Tests sobre la action (validate*Input) + render. *Nota: el posteo del asiento queda
  diferido a SDD-0110 — el `journal_entry_id` arranca `null`.*
- **Slice C2 — Tablero de claim offsets (UI, sin migración).** Tab Cruces + drawer +
  `advanceClaimOffsetAction` (guard de máquina de estados). Reusa `transitionClaimOffset`.
- **Slice C3 — Alertas PP/CA.** `listOverduePartnerBills` + banner/cola de alertas. Migración
  **solo si** se persiste (Decisión D2).
- **Slice C4 — Parser CSV/XLSX.** `statement-parser.ts` (puro) + upload en `ImportStatementDrawer`
  + mapeo de columnas. Migración **solo si** se recuerda el mapeo (Decisión D3). Adjunta el
  archivo crudo (`documents` 0049).

> Orden sugerido: C1 → C2 → C3 → C4 (independientes; C1/C2 son puro frontend sobre lib existente,
> arrancan sin bloqueo). C4 es el de mayor esfuerzo (parser de formatos heterogéneos).

## 7. Dependencia del keystone de posting (SDD-0110)

**El revenue forex no contabiliza de verdad hasta que aterrice SDD-0110.** `posting.ts` ya tiene
la lógica del asiento de conversión (DR / CR a `4.6 Ingresos por cambio de moneda`), pero el
keystone de posting (SDD-0110) es lo que define **cómo y cuándo** se materializa un
`journal_entry` desde un evento del dominio de forma idempotente. Hasta entonces:

- Slice C1 **registra** la conversión y **reporta** el revenue en el KPI.
- El `journal_entry_id` de la conversión queda `null` (sin posteo al libro mayor).
- Cuando 0110 esté, se enchufa el posteo (idempotente por `conversion_id`, FK aditiva que 0114 ya
  dejó en `journal_entries`) sin tocar la UI de este slice.

Esta dependencia es **dura para la contabilidad**, **blanda para la operación**: el operador ya ve
y registra el forex; solo el asiento queda pendiente. Anotarlo explícito evita que se interprete
el KPI como "ya está en los libros".

## 8. Criterios de aceptación

- [ ] Tab Conversiones lista conversiones, registra una nueva vía drawer, y muestra el KPI de
      comisión forex como **revenue** (etiqueta "Ingreso por cambio de moneda", no costo).
- [ ] Tab Cruces muestra el tablero por estado y permite avanzar la máquina de estados con guard
      (transición inválida rechazada server-side).
- [ ] Las alertas PP/CA detectan bills `pp`/`ca` vencidas con balance pendiente y muestran días de
      atraso.
- [ ] El parser acepta un CSV/XLSX de muestra del socio, permite mapear columnas, y produce líneas
      que entran al match (`reconcileStatement`) sin alta manual.
- [ ] Toda tabla nueva (si la hay) tiene RLS fail-closed por tenant + defensa-en-DB cross-tenant
      (helper `*_in_tenant()` + trigger).
- [ ] Server actions con `validate*Input` propio (no Zod) + `revalidatePath`.
- [ ] Gating admin-only (roles financieros) en todas las vistas nuevas.
- [ ] Tokens `var(--*)` + `<NumericInput>` + `<ActionButton>` + trazabilidad visual
      (`useRowHighlight`/`useToast`) según estándar del Studio.
- [ ] UI/UX review (`ui-ux-designer`) antes del commit en C1/C2/C4 (tocan pantalla).
- [ ] `node scripts/verify.mjs` + `pnpm build` verdes (Director).
- [ ] La dependencia de SDD-0110 queda anotada: el forex registra/reporta pero no postea hasta 0110.

## 9. Decisiones pendientes (founder)

1. **¿El forex revenue espera a SDD-0110 o se postea provisional?** ⭐ Recomendado: registrar +
   KPI ahora, **diferir el asiento** a 0110 (no inventar posteo provisional que después haya que
   migrar). ¿O preferís bloquear C1 hasta que 0110 esté?
2. **(D2) Alertas PP/CA: ¿se persisten en tabla (`partner_bill_alerts`) o se derivan en query
   pura?** Persistir da historial de alertas + estados (`resuelta`/`descartada`) pero suma
   migración; derivar es más liviano pero no recuerda qué alertas se atendieron. ¿Querés
   historial de alertas o solo "qué está vencido hoy"?
3. **(D3) Parser: ¿se recuerda el mapeo de columnas por formato de socio
   (`partner_statement_column_maps`)?** Recordarlo evita re-mapear cada estado de cuenta del mismo
   socio, pero suma tabla. ¿Vale la tabla o el mapeo es per-upload?
4. **(D3-bis) Librería del parser XLSX.** El repo no tiene parser de Excel hoy. ¿Aprobás agregar
   una dependencia (ej. lectura XLSX) o el parser arranca **solo CSV** y XLSX se difiere? El CSV
   cubre el caso si el Administrador exporta a CSV.
5. **¿Cuál es el % real del spread forex** y cómo se define `market_rate` de referencia (fuente de
   la tasa de mercado contra la que se mide el spread)? El brief dice ~5% — confirmar el número y
   la fuente de la tasa (manual del operador vs. feed). *(Dato económico crudo → fuera de git por
   confidencialidad; acá solo se modela el mecanismo.)*
6. **Cruces (claim offsets): ¿el descuento al cliente se aplica automático sobre la `invoice` al
   llegar a `aplicado_a_cliente`, o el operador lo aplica a mano y solo se enlaza
   `client_invoice_id`?** Afecta si hay side-effect contable en la transición.
7. **¿El tablero de cruces es Kanban (columnas por estado) o lista filtrable?** El Norte tiene
   patrón de ambos; definir antes de construir C2.

## 10. Confidencialidad

`confidencial` (hereda de SDD-0059): el spec describe **estructura y flujos**, no cifras reales
(% de spread, tasas efectivas, montos del ledger, identidad del socio). Cualquier dato económico
crudo va **fuera de git** (Supabase + RLS, o Drive con puntero en `docs/legal/`) por regla de
`AGENTS.md`. La especificación operativa fuente vive bajo NDA fuera del repo.

---
<!-- Validar: node scripts/build-docs-index.mjs (docs:check). Índice en docs/specs/README.md se regenera con docs:index. -->
