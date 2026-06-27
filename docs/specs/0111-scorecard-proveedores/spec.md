---
sdd: "0111"
title: "Scorecard de proveedores — captura de desempeño + reclamo al proveedor (señales A/B/C/D)"
status: draft
author: "Claude Code (session context) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0057", "0105", "0124", "0102", "0059", "0066", "0049", "0085"]
confidencialidad: interno
---

# SDD-0111 · Scorecard de proveedores (captura de desempeño + reclamo al proveedor)

> Módulo del Studio (**OPERACIÓN · COMPRAS**) para medir el desempeño de los **proveedores chinos**
> (`suppliers_cn`) con señales reales — puntualidad, calidad, tasa de rechazo, órdenes históricas — y
> derivar un **rating A/B/C/D** auditable. Incluye un **reclamo al proveedor** (entidad nueva, distinta del
> reclamo del cliente de SDD-0102 y del ajuste contable de SDD-0059) como una de las fuentes de señal.
> Implementa el handoff del Norte `docs/design/studio/_norte/proveedores/scorecard.js` +
> `Scorecard de Proveedores · DTD-Cargo.html`.

## 0. Por qué — y qué NO es

**El problema real (audit de huecos v4.5):** hoy el rating A/B/C/D del proveedor **no es derivable**. La
tabla `suppliers_cn` (migr **0105** — `portal_compras`, no la fila que el doc viejo afirmaba) **NO tiene
columna `rating`/`score`**, y tampoco existen las señales crudas de las que un score saldría:

```sql
-- suppliers_cn (0105) — lo que HAY hoy:
id · tenant_id · client_markbox · supplier_seq · name · city · wechat · contact · notes
deleted_at · created_at · updated_at
-- NO hay: rating, on_time_pct, quality_pct, defect_pct, orders_count, ni nada derivable.
```

El Norte ya diseñó el scorecard (`scorecard.js`) con la fórmula exacta y las 5 señales, pero **es 100%
mock** — los números (`onTime:96, quality:94, defect:1.8`) están hardcodeados en el JS. Para que el ERP
muestre un rating **real** hay que decidir **dónde y cómo se capturan esas señales** y persistirlas.

**Lo que ESTE SDD hace:** define el **modelo de señales** (de dónde salen los datos crudos), la entidad
**reclamo-al-proveedor** (una fuente de señal distinta de lo existente), y el **cálculo del score**
(derivado, auditable, no un número suelto editable a mano).

**Frontera dura — tres "reclamos" que NO se mezclan:**

| Entidad | SDD | Sujeto | Naturaleza | Existe hoy |
|---|---|---|---|---|
| `client_claims` | **0102** | el **cliente** nos reclama a nosotros | incidencia operativa post-venta | ✅ |
| `supplier_claim_offsets` | **0059** | el **proveedor** nos reconoce un ajuste | cruce **contable** bilateral DTD↔socio | ✅ |
| **`supplier_claims`** (este SDD) | **0111** | **nosotros le reclamamos al proveedor** chino | incidencia **operativa de desempeño** (daño/faltante/calidad/retraso de origen) | ❌ **NUEVO** |

El `supplier_claim` de este SDD es una **señal negativa de desempeño** sobre `suppliers_cn`, no un asiento
contable ni un reclamo del cliente. Si un reclamo al proveedor termina en recuperación de plata, ese
**puente al lado contable (0059) es Fase futura**, fuera de alcance aquí.

**NO entra en este SDD:**
- ❌ Recuperación contable del reclamo (eso es 0059 — solo dejamos un `offset_id` FK suave nullable).
- ❌ Tocar `client_claims` (0102) ni su flujo del portal.
- ❌ Editar el rating a mano. El score es **derivado**; nunca una columna que un operador teclea.
- ❌ Exponer el scorecard al cliente o al proveedor (es interno · OPERACIÓN · COMPRAS).
- ❌ Mostrar el nombre del proveedor de inspección ("Canopy") — reportes white-label (SDD-0066).

## 1. Decisión de modelado · ¿de dónde salen las señales?

Tres caminos posibles para capturar la señal cruda. **No los resuelvo — los expongo** (ver §6); pero el
modelo propuesto soporta **A + C** como base y deja **B** opt-in:

| | A · por ORDEN (recepción) | B · por EVENTO de bodega | C · por RECLAMO al proveedor |
|---|---|---|---|
| Granularidad | 1 fila por OC recibida (`purchase_orders`, 0124) | 1 fila por evento de recepción WMS (0081) | 1 fila solo cuando hay incidencia |
| Captura | el operador marca on-time / conforme al recibir la OC | el bodeguero CN registra al ingresar | el operador abre un reclamo cuando algo falla |
| Costo de captura | **bajo** (1 toque por OC) | alto (requiere flujo WMS atado a proveedor) | bajo (solo en el caso malo) |
| Da señal de | puntualidad + conformidad | defectos por pieza/caja | tasa de defecto/rechazo + monto expuesto |
| Riesgo | sesgo si el operador no marca | acopla scorecard a WMS (deuda) | sin denominador → defect% inflado |

**Recomendación del redactor (sujeta a founder):** señal **por ORDEN** (A) como denominador estable
(cuántas OC, cuántas a tiempo, cuántas conformes) + **reclamo al proveedor** (C) como numerador de las
señales negativas. **B se deja para una fase posterior** para no acoplar el scorecard al WMS desde el día 1.

## 2. Modelo de datos propuesto

> Todo aditivo. Tres piezas nuevas + UNA columna en `suppliers_cn`. RLS por `tenant_id`, fail-closed,
> defensa-en-DB con helper `*_in_tenant()` + trigger same-tenant para los FK polimórficos/cruzados (patrón
> 0102/0096). Sin Zod. Migración numerada por el Director (placeholder **0179**, renumera si colisiona).

### 2.1 `supplier_order_signals` — señal por orden recibida (camino A)

Una fila por OC de compra (`purchase_orders`, 0124) que se recibe, capturando las dos señales positivas:

```
supplier_order_signals
  id                 uuid pk
  tenant_id          uuid not null → tenants(id) cascade
  supplier_cn_id     uuid not null → suppliers_cn(id) cascade        -- el proveedor evaluado
  purchase_order_id  uuid          → purchase_orders(id) set null    -- OC origen (nullable: señal manual)
  client_markbox     text                                            -- Shipping Mark (interno; ayuda al filtro)
  on_time            boolean not null default true                   -- ¿llegó dentro del plazo prometido?
  conforming         boolean not null default true                   -- ¿conforme a lo pedido (sin reclamo)?
  expected_at        date                                            -- fecha prometida (para auditar on_time)
  received_at        date                                            -- fecha real de recepción
  notes              text
  created_by         uuid → auth.users(id)
  created_at         timestamptz default now()
  updated_at         timestamptz default now()
  unique (tenant_id, purchase_order_id)                              -- 1 señal por OC (parcial si PO null)
```

- `on_time` / `conforming` son los **booleanos atómicos** que alimentan los porcentajes (% on-time =
  `count(on_time) / count(*)`). No se guarda el porcentaje — se **deriva**.
- Trigger same-tenant: `purchase_order_id` y `supplier_cn_id` deben pertenecer al `tenant_id` de la fila
  (helper `purchase_order_in_tenant()` + `supplier_cn_in_tenant()`).

### 2.2 `supplier_claims` — reclamo al proveedor (camino C · entidad nueva)

```
supplier_claims
  id                  uuid pk
  tenant_id           uuid not null → tenants(id) cascade
  claim_code          text not null                                  -- "RP-2026-NNN" (RPC next_supplier_claim_code)
  supplier_cn_id      uuid not null → suppliers_cn(id) cascade       -- proveedor reclamado
  purchase_order_id   uuid          → purchase_orders(id) set null   -- OC afectada (nullable)
  client_markbox      text                                           -- Shipping Mark afectado (interno)
  kind                supplier_claim_kind not null                   -- enum: dano | faltante | calidad | retraso | otro
  status              supplier_claim_status not null default 'abierto'
                        -- enum: abierto | en_revision | resuelto | rechazado
  amount_usd          numeric(14,2) not null default 0               -- monto expuesto (advisory)
  description         text not null
  offset_id           uuid                                           -- FK SUAVE futura → supplier_claim_offsets (0059); sin constraint
  resolved_at         timestamptz
  created_by          uuid → auth.users(id)
  created_at          timestamptz default now()
  updated_at          timestamptz default now()
  deleted_at          timestamptz
  unique (tenant_id, claim_code)
```

- **Enums propios** (`supplier_claim_kind`, `supplier_claim_status`) con su validador `validateSupplierClaimInput()`
  en `claims-types.ts` (sin Zod). `kind` mapea a las categorías del Norte (Daño/Faltante/Calidad).
- **RPC `next_supplier_claim_code(p_tenant_id)`** → `RP-YYYY-NNN` ("RP" = Reclamo a Proveedor; **no** colisiona
  con `RC-` de 0102 ni `OC-` de 0124). Patrón `next_claim_code` (0102) / `next_purchase_order_code` (0124):
  `security definer`, `set search_path = public`, cuenta solo `'RP-%'`, padding 3.
- Máquina de estados: `abierto → en_revision → (resuelto | rechazado)`. Reusa el patrón stepper + `ActionButton`
  + trazabilidad visual de 0102.
- `offset_id` queda **sin FK** hasta que se construya el puente a 0059 (FK suave, igual que `sales_order_id`
  en 0124).
- Cada `supplier_claim` cuenta como **una señal negativa** sobre el proveedor (entra en el cálculo de
  tasa de rechazo, §3).

### 2.3 `supplier_scorecards` — snapshot derivado (cache opcional, recalculable)

El score se **deriva** de las señales; para no recalcular en cada render y poder auditar el rating del día,
guardamos un snapshot recalculable (patrón snapshot inmutable de libros fiscales 0104, pero aquí **mutable
por upsert** porque es cache, no libro):

```
supplier_scorecards
  id                 uuid pk
  tenant_id          uuid not null → tenants(id) cascade
  supplier_cn_id     uuid not null → suppliers_cn(id) cascade
  orders_count       int not null default 0          -- # señales por orden (denominador)
  on_time_pct        numeric(5,2)                    -- derivado: % on_time
  quality_pct        numeric(5,2)                    -- derivado: % conforming
  defect_pct         numeric(5,2)                    -- derivado: reclamos / órdenes * 100
  score              int                             -- 0..100 (fórmula §3)
  grade              char(1)                          -- 'A'|'B'|'C'|'D' (umbrales §3)
  computed_at        timestamptz not null default now()
  unique (tenant_id, supplier_cn_id)
```

> **Alternativa (decisión §6.5):** en vez de tabla snapshot, una **VIEW** `supplier_scorecard_v` que
> agrega en vivo desde `supplier_order_signals` + `supplier_claims`. Más simple, siempre fresco, sin cron;
> a cambio recalcula en cada query. Para los volúmenes de DTD (decenas de proveedores por tenant) la VIEW
> probablemente alcanza — **el redactor se inclina por la VIEW** y dejar la tabla snapshot solo si el
> founder quiere "congelar el rating del cierre de mes".

### 2.4 `suppliers_cn` · columna mínima (opcional)

Para no recalcular el grade en cada listado, **opcionalmente** denormalizar el último grade:

```sql
alter table public.suppliers_cn add column last_grade char(1);  -- 'A'..'D' · espejo de scorecard, nullable
```

Es **solo cache de lectura** — la fuente de verdad sigue siendo la VIEW/snapshot. Nullable hasta que haya
señales. (Decisión §6.6: con la VIEW esto sobra.)

## 3. Cálculo del score (copiado del Norte, hecho auditable)

El Norte (`scorecard.js`) ya fijó la fórmula y los umbrales — los adoptamos **tal cual** para que el ERP
coincida con el diseño aprobado:

```
score = round( on_time_pct * 0.40
             + quality_pct * 0.40
             + max(0, 100 - defect_pct * 6) * 0.20 )

grade = score >= 90 ? 'A'
      : score >= 82 ? 'B'
      : score >= 72 ? 'C'
      :               'D'
```

Donde — y esta es la parte que el Norte **no** define y este SDD sí:

```
on_time_pct  = 100 * count(on_time = true)  / nullif(orders_count, 0)
quality_pct  = 100 * count(conforming = true) / nullif(orders_count, 0)
defect_pct   = 100 * count(supplier_claims vivos) / nullif(orders_count, 0)
orders_count = count(supplier_order_signals del proveedor)
```

- **Tono del grade** (badge): A=`success`, B=`info`, C=`warning`, D=`danger` (mapeo `gradeTone` del Norte →
  tonos del Studio).
- **Sin denominador** (`orders_count = 0`): grade = `null` / "Sin datos" — NO mostrar 'D' a un proveedor
  nuevo sin historial (bug clásico de division-by-zero). El Norte mock no lo cubre; acá sí.
- La fórmula vive en **un solo lugar**: `lib/studio/proveedores/scorecard-types.ts` (`computeScore()`,
  `computeGrade()`) — funciones **puras** testeables con Vitest, espejo exacto de la SQL de la VIEW. Si la
  VIEW y el TS divergen es un bug.

## 4. Capa de aplicación (convenciones del repo)

- **Queries puras** `lib/studio/proveedores/scorecard-queries.ts` — `(supabase: SupabaseClient) => …`:
  `listSupplierScorecards`, `getSupplierScorecard(id)`, `listSupplierClaims`, `supplierClaimStats`.
- **Types/validators** `lib/studio/proveedores/scorecard-types.ts` — enums, `validateSupplierClaimInput()`,
  `validateOrderSignalInput()`, `computeScore`/`computeGrade`/`gradeBadgeTone`, máquina de estados del reclamo.
- **Server actions** `app/studio/(app)/proveedores/scorecard-actions.ts` — `"use server"` + `useActionState`
  + parse manual de `FormData` + `validate*Input()` + `revalidatePath("/studio/proveedores")`. Resuelve
  tenant desde `user_tenants`. Acciones: crear señal de orden, crear/editar reclamo, avanzar estado del
  reclamo (con `ActionButton`).
- **UI** dentro del módulo existente `/studio/proveedores` (SDD-0057, hoy solo-lectura): **tab "Scorecard"**
  (tabla rankeada por score + KPIs: # proveedores, rating promedio, on-time promedio, reclamos abiertos) +
  **tab "Reclamos"** + **detalle por proveedor** (barras de puntualidad/calidad/rechazo + lista de reclamos),
  espejo del Norte. Tokens `var(--*)`, `NumericInput` para montos, terminología **Shipping Mark**.
- **RBAC**: gated por módulo `suppliers` (ya existe, `requireModuleView("suppliers")`). RLS por **tenant**,
  no por rol (regla SDD-0085).
- **Trazabilidad visual**: crear reclamo → highlight warm + toast; avanzar estado → highlight success + toast
  (las 3 reglas del Studio).

## 5. Slices / fases

### Slice A — señales + score derivado (núcleo)
1. Migración: `supplier_order_signals` + VIEW `supplier_scorecard_v` (o tabla snapshot, §6.5) + RLS +
   helpers `*_in_tenant()` + triggers same-tenant + FK indexes + GRANTS explícitos.
2. `scorecard-types.ts` + `scorecard-queries.ts` (`computeScore`/`computeGrade` puras + tests Vitest contra
   los mismos casos del Norte: s1=A, s5=D, etc.).
3. Tab "Scorecard" en `/studio/proveedores` (read del derivado) + acción "marcar recepción on-time/conforme"
   por OC (captura de la señal A).

### Slice B — reclamo al proveedor (apilado sobre A)
1. Migración: enums `supplier_claim_kind`/`supplier_claim_status` + tabla `supplier_claims` + RPC
   `next_supplier_claim_code` (RP-YYYY-NNN) + RLS + trigger same-tenant.
2. Tab "Reclamos" + drawer crear/editar + máquina de estados (stepper + `ActionButton`).
3. El reclamo vivo entra como señal negativa en `defect_pct` (la VIEW lo cuenta).

### Slice C — puente contable (DIFERIDO, fuera de este SDD)
- FK real `offset_id → supplier_claim_offsets` (0059) cuando un reclamo recupera plata. Solo se documenta.

## 6. Decisiones pendientes (founder)

1. **¿Cuál es el modelo de señal canónico?** El redactor propone **por ORDEN (A) + reclamo (C)**, dejando el
   evento de bodega (B) para después. ¿Te sirve, o querés capturar la señal directamente en el flujo WMS
   (0081) desde el día 1, aunque acople el scorecard a la bodega?

2. **¿Quién y cuándo marca `on_time` / `conforming`?** La señal A necesita un humano que diga "esta OC llegó
   a tiempo y conforme". ¿Lo hace el operador de COMPRAS al cerrar la OC (`recibida`), o el bodeguero CN al
   ingresar la mercancía? ¿Default optimista (`on_time=true` salvo que marquen lo contrario) o exigir marca
   explícita (más fiel, más fricción)?

3. **¿Qué define "a tiempo"?** Hoy no guardamos fecha prometida por OC. ¿Capturamos `expected_at` en la OC
   (0124 no la tiene) y derivamos `on_time = received_at <= expected_at`, o lo dejamos como booleano que el
   operador juzga "a ojo"? La primera es auditable; la segunda es subjetiva pero arranca sin tocar 0124.

4. **¿El proveedor se evalúa por tenant o por cliente?** `suppliers_cn` es **por cliente**
   (`unique (tenant_id, client_markbox, supplier_seq)`): el MISMO proveedor físico (ej. "Yiwu Star") puede
   tener N fichas, una por cada cliente que le compra. ¿El scorecard mide cada **ficha** por separado (simple,
   pero "Yiwu Star" aparece 5 veces con 5 ratings distintos), o consolidamos por **identidad del proveedor**
   (requiere desduplicar `suppliers_cn` por nombre/ciudad — deuda nueva)? **Esto es la decisión más pesada.**

5. **VIEW en vivo vs. tabla snapshot.** El redactor se inclina por la **VIEW** (siempre fresca, sin cron, sin
   columna que se desincronice). La tabla `supplier_scorecards` solo aporta si querés **congelar el rating del
   cierre de mes** para auditoría histórica. ¿Te interesa ese congelado, o VIEW pura?

6. **¿`suppliers_cn.last_grade` denormalizado, sí o no?** Con la VIEW probablemente sobra. Lo pongo como
   opción si el listado de proveedores necesita pintar el grade sin joinear. ¿Lo agregamos o lo dejamos fuera?

7. **Pesos de la fórmula.** Adopté los del Norte (on-time 40% · calidad 40% · rechazo 20%) tal cual. ¿Los
   confirmás como canónicos, o querés mover los pesos (ej. castigar más el defecto)? Si los movés, lo cambio
   en `computeScore()` + la VIEW a la vez (un solo lugar lógico, dos archivos físicos).

8. **Umbrales de grade.** Norte usa A≥90 · B≥82 · C≥72 · D<72. ¿Confirmás, o ajustamos la severidad?

9. **¿Visibilidad del reclamo para el proveedor?** Hoy es 100% interno. ¿En algún momento querés que el
   proveedor chino vea/responda su reclamo (portal de proveedor), o se queda como herramienta interna de
   COMPRAS para siempre?

10. **Monto del reclamo (`amount_usd`): ¿advisory o contable?** En V1 lo dejo **advisory** (informativo, no
    genera asiento), igual que 0102 en su V1. ¿Correcto, o querés que desde el inicio ate al puente 0059?
