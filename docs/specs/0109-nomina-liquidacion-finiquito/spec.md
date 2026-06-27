---
sdd: "0109"
title: "Liquidación y finiquito de nómina (LOTTT) — prestaciones, vacaciones/utilidades fraccionadas e indemnización por causa de terminación"
status: draft
author: "Claude Code (lane sdd-0109-nomina-liquidacion) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0103", "0079", "0080", "0104", "0085"]
confidencialidad: interno
---

# SDD-0109 — Liquidación y finiquito de nómina (LOTTT)

> **Cierra el hueco keystone de Nómina ([SDD-0103](../0103-nomina/spec.md)).** El motor de corte
> (migración 0175, `nomina_payroll_runs` + `calcReciboDraft`) computa el recibo del período pero
> **declara explícito que NO calcula liquidación** (`spec.md §10.2`: «❌ NO calcula liquidación
> (Art. 142 / salario integral)»). Esta spec modela el **finiquito de egreso**: prestaciones sociales,
> vacaciones / bono vacacional / utilidades fraccionadas e indemnización según la **causa de
> terminación LOTTT** — con el **salario integral** y **qué bonos son salariales** modelados como
> **parámetro configurable**, no como ley hardcodeada (gate del contador).

## 0. Por qué — y qué NO es

**Objetivo:** que al egresar un empleado, el módulo `/studio/nomina` genere un **finiquito**
(liquidación) que liquide lo que la ley manda según la **causa de terminación**, con un desglose
transparente, un PDF a Supabase Storage y un **asiento contable** (integra SDD-0079) — todo
**advisory hasta que el contador valide el criterio salarial**.

**El punto más delicado del módulo (HANDOFF-NOMINA §3).** El número clave de una liquidación es el
**salario integral** (Art. 142 LOTTT): salario normal + alícuota de bono vacacional + alícuota de
utilidades + los bonos que el contador considere **salariales**. *Qué* bonos entran y *cómo* se
calcula la alícuota es **criterio del contador**, no del programador. Por eso esta spec **no
hardcodea la ley**: modela el salario integral como un **cálculo parametrizado** que lee la config
(`nomina_payroll_rules.salarial_bonuses` de SDD-0103 §8.1 + alícuotas) — cuando el contador defina
el criterio, **solo se cablea el valor**, sin tocar el motor.

**Regla de oro:** la liquidación es **BORRADOR / ADVISORY** hasta que un usuario `accounting`/`admin`
la confirme. La confirmación dispara el PDF inmutable + el asiento. **El contador valida antes de
pagar.**

**NO entra en esta spec:**
- ❌ Definir *qué* bonos son salariales ni el % de alícuota (es valor de config, lo llena el contador).
- ❌ Recalcular cortes de período viejos (`nomina_payroll_runs` no se toca).
- ❌ Pago real / transferencia bancaria del finiquito (eso es Tesorería; aquí solo se calcula y asienta).
- ❌ Reportes ante el Ministerio del Trabajo / planilla oficial de egreso (futuro).
- ❌ App del empleado / acuse del finiquito por WhatsApp (Slice posterior del roadmap de 0103).

## 1. Contexto LOTTT (modelo, no asesoría)

El finiquito de un trabajador venezolano se compone de varios renglones cuya **presencia y monto
dependen de la causa de terminación**:

| Renglón | Base | Cuándo aplica |
|---|---|---|
| **Prestaciones sociales** (garantía / retroactivo) | salario integral · Art. 142 | **siempre** (lo acumulado durante la relación) |
| **Vacaciones fraccionadas** | salario normal | siempre (la fracción del año en curso no disfrutada) |
| **Bono vacacional fraccionado** | salario normal | siempre |
| **Utilidades fraccionadas** (aguinaldo) | salario normal | siempre |
| **Indemnización Art. 92** (= monto de prestaciones) | salario integral | **solo despido injustificado** o retiro justificado |
| **Intereses sobre prestaciones** | tasa BCV | siempre (acumulado) |

**Causas de terminación (LOTTT):**
- **Art. 76 — renuncia (retiro voluntario):** prestaciones + fracciones, **sin** indemnización Art. 92.
- **Art. 78 — causas ajenas a la voluntad de las partes:** prestaciones + fracciones (+ indemnización según supuesto).
- **Art. 79 — despido justificado** (causa imputable al trabajador, normalmente con amonestación previa Art. 79 ya modelada en SDD-0103 §9.3): prestaciones + fracciones, **sin** Art. 92.
- **Art. 92 — despido injustificado** (o retiro justificado por causa del patrono): prestaciones + fracciones **+ indemnización = monto de las prestaciones** (la duplica).

**Lo MECÁNICO vs lo de CRITERIO:**
- ✅ *Mecánico* (lo computa el motor): las **fracciones** (días devengados × salario normal / 12),
  el **mapa causa → renglones** (qué se incluye/excluye), la **duplicación Art. 92**.
- ⚠️ *Criterio del contador* (parámetro): el **salario integral** (qué bonos son salariales + alícuota
  de bono vacacional + alícuota de utilidades), la **fórmula de prestaciones** (garantía trimestral vs
  retroactivo, cuál rige), y la **tasa de interés** acumulada.

## 2. Alcance — ESTE entregable

1. **Migración (reservar siguiente libre, ≥ 0178)** `nomina_settlements` + `nomina_settlement_lines`
   — el finiquito (cabecera por empleado/causa) y sus renglones desglosados. RLS por **tenant + rol**
   reusando `nomina_can_access()` (SDD-0103 §3), triggers de coherencia same-tenant `security definer`,
   correlativo `next_settlement_code` (`LIQ-NNNN`), soft-delete, `touch_updated_at`.
2. **`calcLiquidacion()` PURO** en `lib/studio/nomina/settlement-types.ts` — recibe insumos +
   un subconjunto `SettlementRules` (parámetros salariales/alícuotas) → devuelve el desglose
   `lines[]` + totales. **No** toca la DB. **No** hardcodea qué bonos son salariales: los recibe.
3. **`buildSalarioIntegral()` PARAMETRIZADO** — helper puro que arma el salario integral a partir de
   `salario_normal + Σ(bonos marcados salariales en config) + alícuota_bono_vac + alícuota_utilidades`.
   El criterio (cuáles bonos, qué %) llega como **parámetro**, leído de `nomina_payroll_rules`.
4. Capa de datos `lib/studio/nomina/settlement-{types,queries}.ts` — tipos, enums
   (`TERMINATION_CAUSE`, `SETTLEMENT_STATUS`, **`text + check`, sin Zod**), `validateSettlementInput()`
   **puro**, queries que reciben `SupabaseClient`, KPIs y helpers de label/tono.
5. **Generación de finiquito en PDF** a Supabase Storage (bucket `nomina` o `documents`,
   `{tenant_id}/settlement/{id}/finiquito.pdf`, signed URL) al **confirmar** la liquidación.
6. **Asiento contable** al confirmar (integra **SDD-0079**): DR cuentas de gasto/pasivo laboral /
   CR pasivo por pagar (o caja-banco si se paga en el acto). Mapa de cuentas configurable.
7. UI: **8ª pestaña "Liquidaciones"** en `NominaClient` (orden: Empleados · Prestadores · Asistencia ·
   Préstamos · Amonestaciones · Recibos · **Liquidaciones** · Reglas) — lista con KPIs + Badge de
   estado, drawer «Generar finiquito» (empleado + causa + fecha de egreso) y vista de detalle =
   desglose de renglones + botón confirmar + descargar PDF.
8. Actions en `app/studio/(app)/nomina/actions.ts` con `moduleEditDenial("nomina")` como **primer
   paso** de cada mutación (ya cubierto por `GUARDED_ACTIONS` de `rbac.test.ts`).
9. Tests Vitest de `calcLiquidacion`/`buildSalarioIntegral` y validadores puros (incluyendo el test
   anti-drift: «el criterio salarial es parámetro → cambiar la causa cambia el resultado; el integral
   se mueve solo cuando cambia la config, no el código»).

## 3. Modelo de datos

### 3.1 `nomina_settlements` (cabecera)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants` on delete cascade |
| `settlement_code` | text not null | correlativo `LIQ-NNNN` (`next_settlement_code`) · `unique(tenant_id, settlement_code)` |
| `employee_id` | uuid not null | FK `nomina_employees` on delete restrict |
| `employee_code` | text not null | **snapshot** (Shipping Mark del empleado: `EMP-NNNN`) |
| `employee_name` | text not null | **snapshot PII** |
| `termination_cause` | text not null | `check in ('renuncia_76','ajena_78','despido_justificado_79','despido_injustificado_92')` |
| `hire_date` | date not null | ingreso (snapshot, para antigüedad) |
| `termination_date` | date not null | egreso · `>= hire_date` (trigger) |
| `base_salary_usd` | numeric(14,2) not null | salario normal mensual al egreso (snapshot) |
| `rules_snapshot` | jsonb not null | **copia CONGELADA** del criterio salarial usado (bonos salariales + alícuotas) — editar Reglas después NO cambia un finiquito viejo |
| `status` | text not null default `'borrador'` | `check in ('borrador','confirmado','anulado')` |
| `total_prestaciones_usd` | numeric(14,2) not null default 0 | rollup |
| `total_fracciones_usd` | numeric(14,2) not null default 0 | vac + bono vac + utilidades fraccionadas |
| `total_indemnizacion_usd` | numeric(14,2) not null default 0 | Art. 92 (0 si no aplica) |
| `total_intereses_usd` | numeric(14,2) not null default 0 | intereses sobre prestaciones |
| `total_deductions_usd` | numeric(14,2) not null default 0 | saldo de préstamos pendientes, etc. |
| `total_net_usd` | numeric(14,2) not null default 0 | neto a pagar |
| `salario_integral_usd` | numeric(14,2) not null default 0 | **snapshot** del integral computado (transparencia) |
| `pdf_path` | text | ruta en Storage del finiquito (null hasta confirmar) |
| `journal_entry_id` | uuid | FK al asiento generado al confirmar (null hasta confirmar) |
| `confirmed_at` | timestamptz | sello de confirmación |
| `notes` | text | libre |
| `created_by` | uuid | FK `auth.users` on delete set null |
| `created_at` / `updated_at` / `deleted_at` | timestamptz | soft-delete |

Índice único parcial: **un finiquito vivo no-anulado por `(tenant_id, employee_id)`** (un empleado se
liquida una vez; si se anula puede re-generarse). `numeric` → llega a TS como **string**; coercer con `num()`.

### 3.2 `nomina_settlement_lines` (renglones del desglose)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants` on delete cascade |
| `settlement_id` | uuid not null | FK `nomina_settlements` on delete cascade |
| `kind` | text not null | `check in ('prestaciones','vacaciones_frac','bono_vacacional_frac','utilidades_frac','indemnizacion_92','intereses','deduccion_prestamo','otro')` |
| `label` | text not null | descripción legible del renglón |
| `days` | numeric(8,2) | días devengados (cuando aplique) |
| `base_usd` | numeric(14,2) | base de cálculo (salario normal o integral según renglón) |
| `amount_usd` | numeric(14,2) not null default 0 | monto (negativo = deducción) |
| `created_at` | timestamptz | |

**Sin soft-delete**: los renglones se regeneran mientras el finiquito esté en **borrador** (se borran
y recomputan). Una vez confirmado, son inmutables (el `status` bloquea la regeneración).

### 3.3 Criterio salarial — parámetro, NO columna nueva de ley

El salario integral **lee** de `nomina_payroll_rules` (SDD-0103 §8.1), que ya tiene:
- `salarial_bonuses jsonb` — **(criterio contador)** qué bonos son salariales.
- `bono_vacacional_days` / `utilidades_days` — base de las alícuotas.

Si el contador necesita parámetros adicionales (p. ej. tasa de interés sobre prestaciones, método
garantía-vs-retroactivo), se agregan **a `nomina_payroll_rules`** como columnas de config (additivo),
**no** a la lógica del motor. El finiquito **congela** el snapshot del ruleset que usó en
`rules_snapshot` (mismo patrón que `nomina_payroll_runs.rules_snapshot`).

## 4. Cálculo · `calcLiquidacion()` (PURO)

En `lib/studio/nomina/settlement-types.ts`. Firma conceptual:

```
calcLiquidacion({ cause, hireDate, terminationDate, baseSalaryUsd,
                  rules: SettlementRules, loanBalanceUsd }) → { lines[], totals }
```

`SettlementRules` = **subconjunto** de `PayrollRules` con SOLO lo que el cálculo necesita
(bonos salariales, días de bono vacacional, días de utilidades, alícuotas, tasa de interés). Lo
**mecánico** que computa:

1. **Antigüedad** = `terminationDate − hireDate` (años + fracción de año/meses).
2. **Salario integral** = `buildSalarioIntegral(baseSalaryUsd, rules)`:
   `salario_normal_diario + alícuota_bono_vacacional + alícuota_utilidades + Σ(bonos salariales)`.
   ⚠️ Qué bonos y qué alícuota = **de `rules`** (config), nunca constantes en el código.
3. **Prestaciones sociales** sobre el **salario integral** según la fórmula que el contador fije
   (parámetro `prestaciones_method`); mientras no esté definida → `// TODO: fórmula del contador`,
   computa la aproximación documentada y la marca advisory.
4. **Fracciones** (vacaciones, bono vacacional, utilidades) = `días_anuales × meses_trabajados/12 ×
   salario_normal_diario` — **mecánico**.
5. **Indemnización Art. 92** = `total_prestaciones` **solo si** `cause = 'despido_injustificado_92'`
   (o `'ajena_78'` según supuesto configurable); en otra causa = 0. **Mapa causa→renglones mecánico.**
6. **Intereses** sobre prestaciones a la `tasa` de config.
7. **Deducción** = `min(loanBalanceUsd, …)` (préstamos pendientes de SDD-0103 §9.2, en negativo).
8. `lines[]` transparente + `totals` (rollup por grupo + neto).

**Frontera (lo diferido / de criterio):**
- ❌ **NO hardcodea qué bonos son salariales** — `SettlementRules.salarialBonuses` se recibe;
  un test verifica que con la misma causa y distinto `salarialBonuses` el integral cambia (y con el
  mismo config el resultado es estable).
- ❌ **NO fija la fórmula de prestaciones** (garantía vs retroactivo): es parámetro; el motor expone
  el gancho y deja el valor por defecto marcado advisory hasta que el contador lo cablee.
- Cada finiquito nace **borrador/advisory**; el contador valida antes de confirmar.

## 5. Confirmación: PDF + asiento (integra SDD-0079)

`confirmSettlementAction` (transición `borrador → confirmado`):
1. Re-valida que el finiquito siga en borrador y que los renglones estén computados.
2. **Genera el PDF** del finiquito (cabecera + desglose de renglones + neto + firma) y lo sube a
   Supabase Storage: `{tenant_id}/settlement/{settlement_id}/finiquito-{settlement_code}.pdf`;
   guarda `pdf_path`. La descarga es por **signed URL** (PII → nunca público).
3. **Genera el asiento contable** (SDD-0079): por cada grupo de renglón, DR la cuenta de gasto/pasivo
   laboral correspondiente / CR el pasivo «finiquitos por pagar» (o caja-banco si se paga en el acto).
   El **mapa renglón→cuenta** es config (reusa el patrón de mapeo de cuentas de SDD-0079/0105). Guarda
   `journal_entry_id`. Si el período fiscal está **cerrado** (SDD-0080), rechaza con error claro.
4. Sella `confirmed_at`. A partir de aquí el finiquito es **inmutable** (renglones no se regeneran).

`anularSettlementAction` (`confirmado → anulado` o `borrador → anulado`): revierte el asiento con un
contra-asiento (no borra el original — rastro contable), conserva el PDF, libera el índice único
parcial para re-generar si hace falace. **Solo admin.**

## 6. Seguridad (RLS + grants + defensa-en-DB)

Idéntica al resto de Nómina (SDD-0103 §3) — **dinero + PII de egreso**:
- **RLS `for all to authenticated`** en ambas tablas, ambas cláusulas wrapeadas con `(select …)`:
  `using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.nomina_can_access()))`
  / `with check (… and (select public.nomina_can_access()))`. Reusa el helper `nomina_can_access()`
  de 0160 (admin/accounting); **no se redefine**.
- **Triggers de coherencia same-tenant** `security definer` + `set search_path = public` +
  `revoke execute from public, anon`: (a) `nomina_settlement_lines.settlement_id` pertenece a un
  finiquito del mismo tenant (helper `*_in_tenant()`); (b) `employee_id` pertenece a un empleado del
  mismo tenant; (c) `termination_date >= hire_date`.
- **`next_settlement_code(p_tenant_id uuid)`** — patrón `next_employee_code` (`assert_tenant_match`,
  MAX(num)+1, `revoke … from public, anon` + `grant … to authenticated`); el `unique(tenant_id,
  settlement_code)` protege la carrera.
- **Grants explícitos** `select, insert, update, delete to authenticated` (auto-expose OFF).
- **Defensa en 3 capas**: sidebar (UX) → `requireModuleView`/`moduleEditDenial` (rol) → **RLS por
  tenant+rol** (backstop ante PostgREST directo). Un `operations` no ve ni un salario de finiquito.
- **Storage:** el bucket es privado; el `pdf_path` se sirve por signed URL con TTL corto. RLS de
  Storage por prefijo `{tenant_id}/`. **PII de egreso jamás en git** — seed = demo ficticio.

## 7. UI / UX (Norte)

- Marca: solo tokens `var(--*)`, fuentes del sistema, sin AI slop, tuteo VE neutro (ver `BRAND.md`).
  Terminología ERP: el código del empleado se muestra como **«Shipping Mark»** donde aplique (markbox
  es interno); montos en **JetBrains Mono** (`var(--f-mono)`).
- **8ª pestaña "Liquidaciones"** en `NominaClient`: KPIs (finiquitos del año, monto liquidado USD,
  pendientes de confirmar) + tabla con `Badge` de estado (borrador=neutral, confirmado=success,
  anulado=warning).
- Drawer **«Generar finiquito»** (`DrawerShell` + `DrawerFooter`, form HTML5 `form="id"`, sin
  `requestSubmit`): selector de empleado activo, **causa de terminación** (radio con las 4 causas
  LOTTT y una nota corta de qué incluye cada una), fecha de egreso. Al guardar → corre
  `calcLiquidacion` y crea el borrador.
- **Vista de detalle** del finiquito: desglose de renglones (label · días · base · monto), el
  **salario integral** explícito (transparencia), neto, y un **aviso visible** «Borrador advisory —
  el contador valida antes de pagar» mientras esté en borrador. Botones: **Confirmar** (genera PDF +
  asiento), **Descargar PDF** (signed URL, solo confirmado), **Anular** (solo admin).
- `EmptyState` cuando no hay finiquitos.

## 8. Pruebas y gate

- **Vitest** (`settlement-types.test.ts`): `buildSalarioIntegral` (con/ sin bonos salariales; el
  integral se mueve **solo** al cambiar la config); `calcLiquidacion` por las 4 causas (Art. 92
  duplica; renuncia/justificado no incluyen indemnización; fracciones proporcionales a los meses);
  deducción capada al saldo del préstamo; validadores (`termination_date >= hire_date`, causa válida).
- **Test anti-criterio-hardcodeado:** el subconjunto `SettlementRules` tipa `salarialBonuses`/
  alícuotas; un test verifica que el motor **no** trae constantes salariales propias (el resultado
  cambia con la config, no con una rama del código).
- **`rbac.test.ts`:** las actions de liquidación quedan cubiertas por `app/studio/(app)/nomina/actions.ts`
  ya presente en `GUARDED_ACTIONS`; pasan el anti-drift matriz↔registro (dinero ⇒ nunca operations/commercial).
- **Gate:** `node scripts/verify.mjs` 🟢 (tsc + lint + vitest + build + frontera público↔ERP).
- **DB:** la `.sql` queda como **archivo** en la rama; **no se aplica a prod** (lo hace el Director/founder).
- Por ser dinero + PII + cálculo legal → **auditoría adversarial en paralelo** al reviewer (regla del repo).

## 9. Archivos (propuesto)

```
supabase/migrations/0178_nomina_settlements.sql           (nº real lo fija el Director)
lib/studio/nomina/settlement-types.ts                     (calcLiquidacion + buildSalarioIntegral + validadores)
lib/studio/nomina/settlement-queries.ts                   (queries puras que reciben SupabaseClient)
lib/studio/nomina/settlement-types.test.ts                (Vitest)
lib/studio/nomina/settlement-pdf.ts                       (armado del finiquito PDF)
app/studio/(app)/nomina/_components/LiquidacionTab.tsx
app/studio/(app)/nomina/_components/GenerarFiniquitoDrawer.tsx
app/studio/(app)/nomina/_components/FiniquitoDetalle.tsx
app/studio/(app)/nomina/actions.ts                        (editar: +generate/confirm/anular settlement)
app/studio/(app)/nomina/_components/NominaClient.tsx      (editar: +pestaña Liquidaciones)
```

## 10. Decisiones pendientes (founder)

> Borrador para revisión. Estas son decisiones de **negocio / contador** que NO resuelvo en la spec —
> las dejo expuestas para que las definas (o las marques como «el contador en la pasada de cálculo»).

1. **¿Qué bonos son salariales?** El campo `salarial_bonuses` existe (SDD-0103 §8.1) pero está vacío.
   ¿Quién lo llena y cuándo — el contador antes de la primera liquidación real, o lo dejamos en demo
   hasta entonces? (El motor funciona advisory sin esto, pero el integral será aproximado.)

2. **Fórmula de prestaciones: garantía trimestral vs retroactivo.** LOTTT Art. 142 manda calcular
   ambas y pagar **la que más favorezca al trabajador**. ¿Modelamos las dos y comparamos, o arrancamos
   con una y lo marcamos advisory? (Impacta el monto principal del finiquito.)

3. **Tasa de interés sobre prestaciones.** ¿De dónde sale — tasa BCV manual que el contador carga por
   período, o un campo fijo en Reglas? ¿Se actualiza con qué frecuencia?

4. **Causa Art. 78 (causas ajenas):** ¿incluye o no la indemnización Art. 92 en tu operación? El
   supuesto legal varía; lo dejé como **configurable** (mapa causa→incluye_92). ¿Cuál es el default?

5. **¿El finiquito paga o solo calcula?** ¿El asiento al confirmar es contra **pasivo «finiquitos por
   pagar»** (se paga luego en Tesorería) o contra **caja-banco** (se paga en el acto)? ¿O ambos según
   un toggle al confirmar?

6. **Vacaciones ya disfrutadas / adelantos.** ¿El motor debe descontar vacaciones tomadas por
   adelantado o adelantos de utilidades? Hoy no hay tabla de ese histórico — ¿lo cargamos a mano en el
   finiquito o lo difiere a otro Slice?

7. **Salario de cálculo en USD vs Bs.** El sueldo está indexado en USD (SDD-0103) pero la ley se
   liquida en Bs a la tasa del egreso. ¿El finiquito se calcula en USD y se convierte para el PDF
   oficial, o necesitas el desglose legal en Bs con la tasa del día?

8. **¿Quién firma el PDF?** ¿Lleva firma digital / cargo del firmante, o es un borrador que se imprime
   y se firma a mano? ¿Necesita el RIF/razón social en el documento (van solo en schema, no en copy
   visible — confirmar para el PDF legal)?

9. **Antigüedad: ¿cuenta el preaviso?** En despido injustificado, ¿se suma el preaviso a la antigüedad
   para el cálculo, o va aparte? (Afecta días de prestaciones e indemnización.)

10. **Período de retención.** ¿Cuánto tiempo se conserva el PDF y los datos del finiquito en Storage
    (PII de ex-empleados)? ¿Hay obligación legal de archivo que debamos respetar antes de cualquier purga?
