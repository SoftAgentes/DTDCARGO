---
sdd: "0048"
title: "Dirección · Tablero ejecutivo — vista consolidada read-only, admin-only (Bloque 5)"
status: done
author: "Claude Code (carril Bloque 5 · Norte v2.4)"
created: 2026-06-03
updated: 2026-06-03
supersedes: null
superseded_by: null
related: ["0040", "0041", "0044", "0047", "0043", "0014"]
confidencialidad: interno
---

# DTD-0048 — Dirección · Tablero ejecutivo

> **Bloque 5 (primer entregable).** La **cabina del dueño**: una vista **consolidada, read-only,
> admin-only** que cruza finanzas + operación + comercial leyendo lo que los demás módulos ya
> producen. Es el capstone de la simetría: con finanzas (Bloques 1-2) y logística (Bloque 4 ✅) maduros,
> falta el lugar donde el founder ve el estado integral del negocio en una pantalla. Diseño en el
> Norte v2.4 (`erp/modules/direccion.jsx`).

## 1. Resumen en una línea

Pantalla `/studio/direccion` (admin-only, solo lectura) que **compone agregados existentes** (P&L,
caja, CxC/CxP, KPIs de naviera y operación, pipeline) en KPIs + tarjetas + alertas accionables que
deep-linkean al módulo de origen. **Sin tablas nuevas, sin migración, sin mutaciones.**

## 2. Por qué (grounding)

- El Norte la diseñó como "cabina del dueño" que **lee** Contabilidad/Tesorería/Naviera/CRM y arma
  KPIs financieros + salud financiera + proyección de caja + operación + comercial + alertas.
- **Todo el dato base ya existe** tras los Bloques 1-2-4: P&L (`accounting/reports.ts`), balances de
  cuenta (`account-queries.ts`), CxC (cobranzas/`accounts`), CxP + caja (`treasury/*-queries.ts`),
  KPIs de naviera (`naviera/queries.ts` `navieraKpis`), conteos operativos (`dashboard-queries.ts`),
  pipeline (`kommo_leads`, SDD-0043). Dirección **no genera dato nuevo — lo cruza.**
- Es read-only: cero riesgo de mutación; el valor es la **síntesis** + las **alertas** que ahorran
  al dueño abrir 6 módulos.

## 3. Approach — un solo slice (no hay foundation de DB que separar)

Como NO toca schema (solo lee), va en **una corrida del harness**. La complejidad es de
**composición de queries** + **gating admin** + **UI de tarjetas**, no de datos.

### Scope V1 — secciones con backend real

- **KPIs financieros** (4): Ingresos del período · Utilidad neta (+ margen %) · Caja + bancos
  (consolidado multi-moneda, USD funcional) · Posición neta (caja + CxC − CxP).
- **Salud financiera** (tarjeta): CxC · CxP · Vencido · **cobertura de pagos con caja** (barra %,
  reusa el patrón de `UtilizationBar` de 0047 o `Progress` del sistema).
- **Operación** (tarjeta): embarques activos (+ valor en ruta) · contenedores consolidando (+ %
  ocupación medio vía `containerStats`) · carga suelta CN (CBM) · próximo cut-off (días).
- **Comercial** (tarjeta): pipeline CRM (suma de `kommo_leads` en etapas abiertas) · # leads activos.
- **Proyección de caja · 4 semanas** (decisión founder): **versión simple** = CxP venciendo por
  semana, derivada de `supplier_bills.due_date` (barras por semana). El forecast con ingresos
  esperados = V2.
- **Alertas · requieren atención** (lista derivada, deep-link al módulo): pagos vencidos · cut-off
  ≤ 3 días · carga suelta > 20 CBM · (extensible). Si no hay nada → "Todo en orden".

### Diferido (módulos aún no construidos)

- **Servicio al cliente** (conversaciones abiertas / casos) → **Conversaciones no existe** (futuro
  Bloque 5). Se **omite** la tarjeta en V1 (no placeholder muerto).
- **Comercial · tiers/referidos** (Fidelización) → **Fidelización no existe**. El bloque Comercial
  V1 muestra solo pipeline + leads; las mini-barras de tier se difieren.

## 4. Decisiones de diseño

### 4.1 Read-only, sin migración, sin server actions
Dirección solo **lee**. No hay `actions.ts`, no hay tablas nuevas. Toda la lógica vive en
`lib/studio/direccion/queries.ts` (funciones puras que reciben `SupabaseClient` y **componen** las
queries existentes) + el Server Component que las pinta. Esto la hace de **bajo riesgo**.

### 4.2 Admin-only (gating real)
La cabina es del dueño. Se gatea por rol `admin` (o el rol más alto del tenant) — patrón de gating
del repo (`user_tenants.role` / `ROLE_MODULES`). Si un no-admin entra a `/studio/direccion` → redirect
o 403. El item de sidebar solo aparece para admin.

### 4.3 Reusar agregados, no recalcular
P&L, balances, aging, navieraKpis, etc. **ya están implementados y testeados**. Dirección los
**importa y compone**; no reimplementa cálculo financiero. Si falta un agregado puntual (ej. "caja
consolidada USD"), se agrega como función chica en el módulo dueño del dato, no en direccion.

### 4.4 Alertas derivadas, no persistidas
Las alertas se calculan en el render desde los mismos agregados (no hay tabla de alertas). Cada una
deep-linkea al módulo de origen (`/studio/tesoreria`, `/studio/naviera`, etc.).

### 4.5 Solo lo que tiene dato real
No se pintan tarjetas de módulos inexistentes (Conversaciones/Fidelización) — se omiten hasta que
existan, y se re-agregan cuando se construyan (la spec lo deja anotado). Evita "datos fantasma".

## 5. Acceptance

- [ ] `/studio/direccion` accesible **solo para admin**; no-admin → redirect/403; item de sidebar
      solo visible para admin.
- [ ] KPIs financieros muestran P&L real (ingresos/utilidad/margen), caja, posición neta —
      consistentes con lo que muestran Contabilidad/Tesorería por separado.
- [ ] Salud financiera: CxC/CxP/vencido + barra de cobertura, con deep-links correctos.
- [ ] Operación: conteos reales de embarques activos + naviera (consolidando, % ocupación, carga
      suelta, cut-off) — consistentes con `/studio/naviera`.
- [ ] Comercial: pipeline derivado de `kommo_leads` (etapas abiertas).
- [ ] Alertas: aparecen las que correspondan (vencidos, cut-off ≤3d, carga suelta >20 CBM); si no
      hay → "Todo en orden". Cada alerta deep-linkea.
- [ ] Tests (Vitest) de las funciones de composición de `direccion/queries.ts` (con stub Supabase).
- [ ] `node scripts/verify.mjs` verde; `ui-ux-designer` sin hallazgos Alta.

## 6. Archivos a crear / editar (estimado)

```
lib/studio/direccion/queries.ts            ← composición de agregados (NEW)
lib/studio/direccion/__tests__/*.test.ts   ← tests de composición (NEW)
app/studio/(app)/direccion/page.tsx        ← Server Component admin-gated (NEW)
app/studio/(app)/direccion/_components/*   ← tarjetas/alertas (NEW, mín. client)
app/studio/(app)/_components/StudioSidebar.tsx  ← item admin-only (EDIT)
docs/architecture/module-sdd-map.md        ← fila Dirección (al cerrar)
docs/specs/README.md                       ← reindex
```
**NO** se crea migración (read-only).

## 7. Decisiones resueltas (founder · 2026-06-03)

1. **Proyección de caja 4 semanas:** ✅ **incluida en V1, versión simple** (CxP venciendo por semana
   desde `supplier_bills.due_date`). Forecast con ingresos esperados = V2.
2. **"Exportar resumen":** diferido a V2 (el valor está en la vista).
3. **Período de KPIs financieros:** mes en curso (selector = V2).
4. **Definición de "admin":** rol `admin` de `user_tenants` (consistente con el resto del Studio).

## 8. Out of scope (V1) / Deferred

- Tarjeta Servicio al cliente (Conversaciones no existe).
- Mini-barras de tiers + referidos (Fidelización no existe).
- Forecast de caja con ingresos esperados (V2).
- Export CSV/PDF del resumen (V2).
- Selector de período / comparativas mes-a-mes (V2).
- Report builder / constructor (es otro módulo del Norte: `reports.jsx`, SDD futuro).

## 9. Notas de implementación (2026-06-03)

Implementado vía harness (`/feature`), read-only, sin migración ni server actions.

**Agregados compuestos (nombres reales · NO se recalcula nada):**
- P&L del mes → `profitAndLoss(accounts, balances)` (`accounting/reports.ts`) sobre
  `listAccounts` + `accountBalances(supabase, { fromDate: 1°-del-mes })`.
- Caja consolidada USD → suma de `balance` (saldos vivos) de las cuentas
  `isCashAccount` (`payment-queries.ts`).
- CxC + vencido CxC → `collectionKpis` (`payment-queries.ts`, módulo Cobranzas).
- CxP + vencido CxP + caja → `treasuryKpis` (`treasury/bill-queries.ts`); forecast
  desde `listBills` agrupado por `due_date` (4 ventanas de 7 días).
- Naviera → `navieraKpis` (`naviera/queries.ts`) + `listSailings({status:'abierto'})`
  para el próximo cut-off.
- Operación → `getOperationalCounts` (`dashboard-queries.ts`, RPC); activos =
  `enTransito + enAduana`.
- Pipeline comercial → `listKommoLeads` (`kommo-queries.ts`); abiertos = `closed_at`
  null; pipeline = suma de `price`.

Derivados puros (testeados): posición neta (`netPosition`), cobertura%
(`paymentCoveragePct`), margen (`netMarginPct`), forecast (`buildForecast`),
alertas (`deriveAlerts`) — todo en `lib/studio/direccion/queries.ts`.

**Gating admin:** ruta `app/studio/(app)/direccion/page.tsx` resuelve `user_tenants.role`;
no-admin → `redirect('/studio/dashboard')` (mismo patrón que `/studio/usuarios`). El
item de sidebar lleva `adminOnly: true` y solo se muestra si `isAdmin` (pasado por el
layout). Grupo FINANZAS (no existe grupo "Inteligencia" en el sidebar actual).

**Omitido (módulos inexistentes, §8):** tarjeta Servicio al cliente (Conversaciones) y
mini-barras de tiers/referidos (Fidelización) — no se pintan placeholders muertos.

**Tests:** `lib/studio/direccion/__tests__/queries.test.ts` (28) — posición neta,
cobertura%, forecast por semana, derivación de alertas + 2 smokes de composición con
stub de SupabaseClient. Cubren Acceptance §5.

**Cierre (2026-06-03):** shippeado vía harness (implement → verify → review). Reviewer
**APPROVED** y `ui-ux-designer` **sin hallazgos Alta**. Nits aplicados en el pase de
cierre: (1) spacing → tokens `var(--s-*)` (snap al grid de 4px) en los 7 archivos del
módulo; (2) dedup de `fmtUsd` (4 copias con signo negativo inconsistente → una sola en
`lib/studio/direccion/queries.ts`, con minus tipográfico U+2212, importada por page y
cards); (3) verificación de deep-links de salud financiera (CxC→Cobranzas, CxP/Vencido→
Tesorería · sensato porque el vencido agrega CxP, que es pago urgente). Status →
`done` (V1 completo). **V2** (forecast con ingresos esperados + export CSV/PDF +
selector de período) queda en §8.

**Tech-debt anotado (no bloqueante · pase de consistencia futuro):**
- Primitiva `<Card>` del Studio: las 5 tarjetas repiten el mismo bloque inline
  (`bg-surface` + `border` + `r-lg` + `padding`). Extraer a `_components/ui/Card.tsx`.
- Clase `.studio-eyebrow` para el eyebrow uppercase (`700 10px/1 · letterSpacing 0.14em
  · uppercase · var(--wine)/var(--ink-soft)`), hoy repetido inline en cada card.
