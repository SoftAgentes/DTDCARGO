---
sdd: "0103"
title: "Nómina / RRHH — empleados y prestadores (Slice A) + roadmap LOTTT"
status: done
author: "Claude Code (lane sdd-0103-nomina) + founder"
created: 2026-06-22
updated: 2026-06-27
supersedes: null
superseded_by: null
related: ["0085","0024","0079","0080","0077"]
confidencialidad: interno
---

# SDD-0103 — Nómina / RRHH

> Módulo del Studio (**FINANZAS**) para Recursos Humanos: la ficha del **empleado** (datos, banco,
> sueldo indexado en USD) y los **prestadores** freelance (pagos por sesión, fuera de la nómina fija).
> Es el **hueco #1 del Norte v4.5**: un módulo entero diseñado (`_norte/erp/modules/nomina-data.jsx`,
> `_norte/HANDOFF-NOMINA.md`) pero **100 % mock en el navegador**, sin backend. Este SDD le pone la
> capa de datos real, tenant-scoped y con RLS estricta — empezando por las dos entidades base.

## 0. Por qué — y qué NO es (todavía)

El Norte trae un prototipo de nómina completo: reglas LOTTT, recibos, liquidación, asistencia,
préstamos, amonestaciones, auto-registro y app del empleado. Todo vive en `localStorage`. Migrarlo
de una sola vez sería un módulo gigante con cálculo fiscal sensible sin contador validándolo.

**Frontera de este SDD (Slice A): el sustrato, no el cálculo.** Construimos el modelo de datos y el
CRUD de las dos entidades que todo lo demás necesita como base — **empleados** y **prestadores** —
y el módulo `/studio/nomina` que los administra. **NO** se implementa en este Slice:

- ❌ Cálculo de recibo / nómina del período (LOTTT) — depende del **criterio del contador**
  (qué bonos son salariales, salario integral Art. 142). Ver `HANDOFF-NOMINA.md §3`.
- ❌ Liquidación / finiquito (legal vs contingente).
- ❌ Asistencia, feriados, préstamos con descuento automático.
- ❌ Amonestaciones, auto-registro con aprobación, comunicaciones al empleado, app del empleado.

Esas piezas son **Slice B+** (§6 Roadmap). Sacar el sustrato primero deja el cálculo fiscal para
una pasada dedicada con el contador, en vez de adivinar la ley.

**Es NÓMINA = dinero + PII de empleados.** Cédula, teléfono, salario y datos bancarios son datos
personales sensibles. Por eso (a) la RLS es **estricta por tenant Y por rol** (solo `admin` +
`accounting`, un escalón más cerrado que el resto del ERP, que solo aísla por tenant); (b) **cero PII
real en git** — el seed es demo ficticio.

## 1. Alcance — Slice A (ESTE entregable)

1. **Migración 0160** `nomina_employees` — ficha del empleado, tenant-scoped, soft-delete, RLS por
   tenant+rol, correlativo `next_employee_code` (`EMP-NNNN`), trigger de coherencia + `touch_updated_at`.
   Helper `nomina_can_access()` (admin/accounting) reutilizable por todas las tablas de nómina.
2. **Migración 0161** `nomina_contractors` + `nomina_contractor_payments` — prestadores freelance y
   sus pagos por sesión; RLS por tenant+rol (reusa `nomina_can_access()`); trigger de coherencia
   (el pago pertenece a un prestador del mismo tenant).
3. `lib/studio/nomina/{employee-types.ts, employee-queries.ts, contractor-types.ts, contractor-queries.ts}`
   — tipos, enums (`text + check`, **sin** Zod), validadores **puros**, KPIs y helpers de label/tono.
4. Módulo `/studio/nomina` — server component con `requireModuleView("nomina")`, **dos pestañas**
   (Empleados · Prestadores), KPIs, tablas, drawers de crear/editar (`DrawerShell` + `useActionState`),
   activar/desactivar y registrar pago de prestador.
5. `app/studio/(app)/nomina/actions.ts` — server actions con `moduleEditDenial("nomina")` como
   **primer paso de cada mutación** (backstop server-side; las actions son invocables como endpoint).
6. Registro en `lib/studio/modules.ts` (grupo **FINANZAS**) y `lib/studio/rbac.ts` (`["accounting"]`).
7. Tests Vitest de los validadores y helpers puros + nómina sumada al anti-drift de `rbac.test.ts`
   (`GUARDED_ACTIONS`, por ser módulo de dinero/sensible).

### Decisión de registro RBAC (conflicto resuelto)

La instrucción del lane decía «`adminOnly` + acceso `["accounting"]`», pero `rbac.test.ts` exige
**`adminOnly` ⇒ matriz vacía `[]`** (mutuamente excluyente). Nómina = dinero + PII encaja **exacto**
en el patrón de los demás módulos de dinero (`treasury`, `accounting`, `invoices`, `costing`…), que
usan `["accounting"]` **sin** el flag `adminOnly` (admin es implícito). Por coherencia con ese patrón
y para no romper el test, se registra **`nomina: ["accounting"]` sin `adminOnly`**. Efecto real =
idéntico a lo pedido: solo `accounting` + `admin` ven y editan nómina; `operations`, `commercial`,
`warehouse`, `support` quedan fuera (verificado por el candado de gobernanza del test).

## 2. Modelo de datos

### 2.1 `nomina_employees` (migración 0160)

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants` on delete cascade |
| `employee_code` | text not null | correlativo `EMP-NNNN` (`next_employee_code`) · `unique(tenant_id, employee_code)` |
| `full_name` | text not null | **PII** |
| `national_id` | text | cédula/pasaporte **PII** · `unique(tenant_id, national_id) where deleted_at is null` (no duplicar empleados) |
| `position_label` | text | cargo |
| `department` | text | área |
| `phone` | text | **PII** |
| `email` | text | **PII** |
| `salary_usd` | numeric(12,2) not null default 0 | sueldo mensual indexado USD · **dinero** |
| `hire_date` | date | ingreso |
| `birth_date` | date | opcional |
| `bank_name` | text | banco VE |
| `bank_account_type` | text | `check in ('corriente','ahorro')` nullable |
| `bank_account` | text | **PII** |
| `status` | text not null default `'activo'` | `check in ('activo','inactivo','egresado')` |
| `notes` | text | libre |
| `created_by` | uuid | FK `auth.users` on delete set null |
| `created_at`/`updated_at`/`deleted_at` | timestamptz | soft delete |

`numeric` → llega a TS como **string**; coercer con helper `num()`.

### 2.2 `nomina_contractors` (migración 0161)

`id`, `tenant_id` (FK), `full_name` (PII), `service` not null, `phone` (PII), `national_id` (PII,
opcional), `default_rate_usd numeric(12,2) default 0`, `status text check ('activo','inactivo')
default 'activo'`, `notes`, `created_by`, timestamps + `deleted_at`.

### 2.3 `nomina_contractor_payments` (migración 0161)

`id`, `tenant_id` (FK), `contractor_id` (FK `nomina_contractors` on delete cascade), `paid_on date
not null default current_date`, `concept text not null`, `amount_usd numeric(12,2) not null default
0`, `created_by`, timestamps + `deleted_at`. Trigger de coherencia: el `contractor_id` pertenece al
mismo tenant.

## 3. Seguridad (RLS + grants)

- **Helper `public.nomina_can_access()`** — `security definer`, `set search_path = public`, `stable`,
  body con `(select auth.uid())` (wrap de caching, FINDING-003); devuelve `true` si el caller tiene
  membership **activo** (`disabled_at is null`) con `role in ('admin','accounting')`. `revoke execute
  from public, anon` + `grant execute to authenticated`.
- **RLS `for all to authenticated`** en las 3 tablas, ambas cláusulas wrapeadas con `(select …)`:
  - `using (tenant_id = (select public.get_user_tenant_id()) and deleted_at is null and (select public.nomina_can_access()))`
  - `with check (tenant_id = (select public.get_user_tenant_id()) and (select public.nomina_can_access()))`
- **`next_employee_code(p_tenant_id uuid)`** — patrón `next_claim_code`: `assert_tenant_match`,
  MAX(num)+1 por tenant, `revoke … from public, anon` + `grant … to authenticated`. El `unique(tenant_id,
  employee_code)` protege la carrera (2.º insert → 23505).
- **Triggers de coherencia** `security definer` + `set search_path` + `revoke execute from public, anon`;
  `touch_updated_at` reutilizado de 0002/0012.
- **Grants explícitos** `select, insert, update, delete to authenticated` (auto-expose OFF en el
  proyecto). RLS = capa real; sin policy, nadie ve nada (fail-closed).
- **Defensa en profundidad de 3 capas**: (1) sidebar oculta el link (UX); (2) `requireModuleView` en la
  page + `moduleEditDenial` en cada action (rol); (3) **RLS por tenant+rol** en la DB (backstop ante
  PostgREST directo — el hueco que el auditor cazó en 0102). Un `operations` autenticado **no** puede
  leer salarios ni cédulas ni por la UI ni por la API.
- **PII en git = cero**: el seed es **demo ficticio** (nombres/cédulas/teléfonos inventados, no
  personal real de DTD). Datos reales viven solo en la DB con RLS.

## 4. UI / UX (Norte)

- Marca: solo tokens `var(--*)`, fuentes del sistema, sin AI slop, tuteo VE (ver `BRAND.md`).
- `/studio/nomina`: eyebrow «Finanzas · RRHH» + título «Nómina.» + KPIs (empleados activos, nómina
  mensual USD, prestadores activos) + pestañas Empleados / Prestadores (client `useState`, patrón
  `NavieraClient`). Tablas a mano con grid (no hay `<Table>` primitiva). Drawers con `DrawerShell` +
  `DrawerFooter` (form HTML5 `form="id"`, sin `requestSubmit`). `EmptyState` cuando no hay filas.
- Sueldo y montos en **JetBrains Mono** (`var(--f-mono)`); `Badge` para estado (activo=success,
  inactivo=neutral, egresado=warning).

## 5. Pruebas y gate

- Vitest: validadores de empleado (cédula/required/salario ≥ 0), validadores de prestador y pago,
  helpers de label/tono, formato de `employee_code`.
- `rbac.test.ts`: nómina entra en `GUARDED_ACTIONS` (obliga `moduleEditDenial` para siempre) y pasa
  el anti-drift matriz↔registro y el candado de gobernanza (dinero ⇒ nunca operations/commercial).
- Gate: `node scripts/verify.mjs` 🟢 (tsc + lint + vitest + build + frontera público↔ERP).
- DB: la `.sql` queda como **archivo**; **no se aplica a prod** (lo hace el founder).

## 6. Roadmap — Slice B+ (DIFERIDO, fuera de este entregable)

Migraciones reservadas para nómina: **0162, 0163, 0164** (el bloque del lane). Orden sugerido:

1. **`payroll_rules`** — única fuente de verdad de los parámetros LOTTT (SML, cestaticket, bono de
   guerra, %s SSO/RPE/FAOV, topes, recargos, provisiones). Cada corte **congela** las reglas usadas.
2. **`payroll_run` + `payroll_run_lines`** — corte del período (borrador → confirmado → pagado),
   `calcRecibo` server-side, asiento contable (integra SDD-0079), export Excel. **Requiere contador.**
3. **`attendance` + `holidays`** — calendario mensual (trabajado/ausente/libre/feriado + horas extra),
   feriados nacionales VE + propios. Alimenta el cálculo de horas extra del recibo.
4. **`loans`** — préstamos con cuota de descuento automático en el recibo.
5. **Liquidación** (`calcLiquidacion`, legal vs contingente, finiquito PDF) — Art. 76/78/79/92.
6. **`warnings`** (amonestaciones) — asistente por pasos, acta.
7. **`registrations` + `invites`** — auto-registro del empleado con aprobación del admin.
8. **`employee_comms`** — comunicaciones al empleado con acuse + WhatsApp; app del empleado (`/m`).

Cada uno entra como su propio Slice con su gate y, por ser dinero/PII, su auditoría adversarial.

## 7. Archivos

```
supabase/migrations/0160_nomina_employees.sql
supabase/migrations/0161_nomina_contractors.sql
lib/studio/nomina/employee-types.ts
lib/studio/nomina/employee-queries.ts
lib/studio/nomina/contractor-types.ts
lib/studio/nomina/contractor-queries.ts
lib/studio/nomina/employee-types.test.ts
lib/studio/nomina/contractor-types.test.ts
app/studio/(app)/nomina/page.tsx
app/studio/(app)/nomina/actions.ts
app/studio/(app)/nomina/_components/NominaClient.tsx
app/studio/(app)/nomina/_components/EmpleadoDrawer.tsx
app/studio/(app)/nomina/_components/PrestadorDrawer.tsx
app/studio/(app)/nomina/_components/PagoPrestadorDrawer.tsx
lib/studio/modules.ts        (editar: +fila nomina)
lib/studio/rbac.ts           (editar: +fila nomina)
lib/studio/rbac.test.ts      (editar: +nomina en GUARDED_ACTIONS)
```

## 8. Slice B — `payroll_rules` (parámetros LOTTT · ESTE entregable)

> Primera pieza del roadmap §6. **Es config, no cálculo:** almacena los parámetros LOTTT que
> la nómina del período usará. NO computa recibos (eso es `payroll_run`, Slice C, que **sí**
> requiere contador). Por eso **se construye sin esperar al contador** — él después llena/ajusta
> los valores desde *Reglas de cálculo*; el motor que los consume llega en C.

**Frontera:** una tabla + su capa de datos + una pestaña/panel "Reglas" en `/studio/nomina`.
Sin `calcRecibo`, sin asiento, sin liquidación.

### 8.1 `nomina_payroll_rules` (migración 0162)

Un **ruleset vigente por tenant** (versionado: editar archiva el anterior y sube `version`, para
que cada corte futuro pueda congelar el snapshot que usó). Reusa `nomina_can_access()` y el patrón
RLS por tenant+rol de 0160. Money/PII-adjacent → mismas 3 capas de seguridad.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants` on delete cascade |
| `version` | int not null default 1 | sube en cada edición; histórico = filas archivadas |
| `status` | text not null default `'vigente'` | `check in ('vigente','archivada')` · **un solo `vigente` por tenant** (índice parcial único) |
| `pay_frequency` | text not null default `'mensual'` | `check in ('mensual','quincenal','semanal')` — frecuencia de pago (prorrateo) |
| `day_method` | text not null default `'30'` | `check in ('30','real')` — método de días (30 fijos vs días reales) |
| `min_salary` | numeric(14,2) not null default 0 | SML vigente (Bs) |
| `cestaticket` | numeric(14,2) not null default 0 | cestaticket (Bs) |
| `bono_guerra` | numeric(14,2) not null default 0 | bono de guerra económica (Bs) |
| `sso_pct` | numeric(5,2) not null default 4 | % SSO/IVSS empleado |
| `rpe_pct` | numeric(5,2) not null default 0.5 | % RPE (Régimen Prestacional de Empleo) |
| `faov_pct` | numeric(5,2) not null default 1 | % FAOV (sin tope) |
| `sso_cap_sm` | numeric(6,2) not null default 5 | tope IVSS en nº de SM |
| `rpe_cap_sm` | numeric(6,2) not null default 10 | tope RPE en nº de SM |
| `overtime_pct` | numeric(5,2) not null default 50 | recargo hora extra diurna (LOTTT) |
| `night_pct` | numeric(5,2) not null default 30 | recargo bono nocturno |
| `holiday_pct` | numeric(5,2) not null default 50 | recargo día feriado |
| `utilidades_days` | int not null default 30 | días de utilidades/aguinaldo (mín. legal 30) |
| `bono_vacacional_days` | int not null default 15 | días de bono vacacional |
| `vacaciones_days` | int not null default 15 | días de vacaciones |
| `salarial_bonuses` | jsonb not null default `'[]'` | **(criterio contador)** qué bonos son salariales; la columna existe, el valor lo define el contador en C |
| `notes` | text | libre |
| `created_by` | uuid | FK `auth.users` on delete set null |
| `created_at` / `updated_at` | timestamptz | `touch_updated_at` |
| `deleted_at` | timestamptz | soft-delete |

Índice: `unique (tenant_id) where status = 'vigente' and deleted_at is null` (un vigente por tenant).
RLS `for all` por `tenant_id = get_user_tenant_id() and nomina_can_access()`. Grants explícitos a
`authenticated`. Seed: **1 ruleset DEMO ficticio** vigente para el tenant `dtd` (valores VE plausibles,
NO asesoría fiscal — el contador los valida).

### 8.2 Capa de datos · `lib/studio/nomina/payroll-rules-{types,queries}.ts`

- **types:** `PayrollRules` (números llegan como string de `numeric` → coercer con `num()`), enums
  `PAY_FREQUENCY` / `DAY_METHOD` (`text + check`, **sin Zod**), `validatePayrollRulesInput()` puro
  (rangos: %s 0–100, topes ≥0, días ≥0, `utilidades_days` ≥30), helpers de label/tono.
- **queries:** `getVigentePayrollRules(sb, tenantId)`, `upsertPayrollRules(sb, ...)` (archiva el
  vigente + inserta nueva versión en una transacción lógica), funciones puras que reciben `SupabaseClient`.
- **tests:** `payroll-rules-types.test.ts` — Vitest de los validadores puros (rangos, defaults, enums).

### 8.3 UI · pestaña "Reglas" en `/studio/nomina`

Tercera pestaña (Empleados · Prestadores · **Reglas**). Form de edición (`DrawerShell` o panel),
guard `moduleEditDenial("nomina")` como 1er paso de la action. Sin cálculo: solo lee/guarda params.

### 8.4 Fuera de Slice B (queda para C+)
`payroll_run`/`_lines`, `calcRecibo`, asiento contable, export Excel, liquidación, asistencia,
préstamos. El `salarial_bonuses` se almacena pero **no se consume** hasta C (con contador).

## 9. Slice C — insumos del motor (asistencia · préstamos · amonestaciones · ESTE entregable)

> Tres piezas del roadmap §6 (ítems 3, 4, 6) construidas **en paralelo** (forja de 3 lanes en
> worktrees aislados, consolidadas en un commit). **Son insumos del motor, no el motor:** alimentan
> el futuro `payroll_run`/`calcRecibo` (horas extra, descuento de cuota) pero **ninguna calcula
> recibo ni liquidación** — eso queda para el Slice del motor, con contador. Las tres reusan
> `nomina_can_access()` (0160) → RLS `for all to authenticated` por tenant **y** rol (admin/accounting),
> triggers de coherencia `security definer`, seed **DEMO ficticio** (cero PII real), grants explícitos,
> y `moduleEditDenial("nomina")` como **primer paso** de cada action (3 capas de seguridad).

### 9.1 Asistencia + Feriados (migración 0163)

`nomina_attendance` — registro diario por empleado: `status` (`trabajado`/`ausente`/`libre`/`feriado`)
+ `overtime_hours`/`night_hours`, único `(tenant_id, employee_id, work_date)`. `nomina_holidays` —
feriado `nacional`/`empresa`, único `(tenant_id, holiday_date)`; seed de feriados VE. Capa
`attendance-{types,queries}.ts` (enums `ATTENDANCE_STATUS`/`HOLIDAY_SCOPE` `text+check` sin Zod,
`validateAttendanceInput`/`validateHolidayInput` puros, `computeAttendanceKpis`). UI: pestaña
**"Asistencia"** (`AsistenciaTab` + `AsistenciaDrawer`/`FeriadoDrawer`). **Alimenta** el cálculo de
horas extra del recibo.

### 9.2 Préstamos (migración 0164)

`nomina_loans` + tabla hija `nomina_loan_installments` (cuotas/abonos). **Saldo derivado**
(`principal_usd − Σ amount_usd`) en la capa de queries, **nunca columna** (evita drift); cuando una
cuota lleva el saldo a 0 la action marca el préstamo `pagado`. Capa `loan-{types,queries}.ts`
(`LOAN_STATUS`, `validateLoanInput`/`validateLoanInstallmentInput`, `listLoansWithBalance`,
`getLoan`/`getLoanBalance`, `computeLoanKpis`). UI: pestaña **"Préstamos"** + `PrestamoDrawer`
(crear) + `CuotaPrestamoDrawer` (registrar cuota). Actions: `createLoanAction`,
`registerLoanInstallmentAction` (relee saldo, marca `pagado`), `cancelLoanAction`,
`softDeleteLoanAction`. **El descuento real en el recibo lo hará el motor**, no este Slice.

### 9.3 Amonestaciones (migración 0171)

`nomina_warnings` — acta disciplinaria Art. 79 LOTTT; correlativo `AM-NNNN` (`next_warning_code`,
patrón de `next_employee_code`, `unique(tenant_id, warning_code)`), `severity`
(`leve`/`grave`/`muy_grave`), `status` (`emitida`/`anulada` — no se borra, queda el rastro). Capa
`warning-{types,queries}.ts` (catálogo `ART79_CAUSES`, `validateWarningInput`, `computeWarningKpis`,
`isWarningCode`). UI: pestaña **"Amonestaciones"** + `AmonestacionDrawer` (asistente causa → relato →
testigos → acta). Actions: `emitirAmonestacionAction` (genera `AM-NNNN`) / `anularAmonestacionAction`.

### 9.4 Integración y numeración

Las 3 lanes salieron de worktrees aislados sobre la misma base y se consolidaron en **un commit**. La
migración de amonestaciones se renumeró **0170 → 0171** (0170 lo tomó SDD-0106 persons en otra rama).
`NominaClient`/`page.tsx`/`actions.ts` integran las 3 pestañas nuevas — orden final de tabs: Empleados
· Prestadores · Asistencia · Préstamos · Amonestaciones · Reglas. **Sigue pendiente el motor**
(`payroll_run`/`calcRecibo`/liquidación), que **requiere contador** (§3 ⚠️).

## 10. Slice motor — estructura de `payroll_run` (ESTE entregable)

> Ítem 2 del roadmap §6. **Es la ESTRUCTURA del motor, no la ley fiscal.** Construye el registro del
> corte + sus renglones (recibos) + el lifecycle, y un `calcReciboDraft()` **BORRADOR / ADVISORY**
> que computa SOLO lo MECÁNICO que el `HANDOFF-NOMINA §3` marca como «✅ ya resuelto». El criterio
> salarial, la liquidación y el asiento contable quedan **fuera** (otra pasada, con contador).

### 10.1 Tablas (migración 0175)

- **`nomina_payroll_runs`** — corte del período: `period_label` + `period_start`/`period_end`,
  snapshot de `pay_frequency`/`day_method`, **`rules_snapshot jsonb`** (copia CONGELADA del
  `payroll_rules` vigente usado → editar las reglas después NO cambia un corte viejo), `status`
  (`borrador`/`confirmado`/`pagado`/`anulado`), totales `total_gross/deductions/net_usd`,
  `confirmed_at`/`paid_at`, soft-delete. Índice único parcial: **un corte vivo no-anulado por
  `(tenant_id, period_label)`**.
- **`nomina_payroll_run_lines`** — renglón = recibo por empleado: snapshots `employee_code`/`name`/
  `base_salary_usd`, insumos `worked_days`/`overtime_hours`/`night_hours`, componentes
  `overtime_pay`/`night_pay`/`loan_deduction`/`statutory_deductions_usd`, totales
  `gross`/`total_deductions`/`net_usd`, **`breakdown jsonb`** (renglones transparentes del recibo).
  **Sin soft-delete**: los renglones se regeneran mientras el corte esté en borrador (se borran y
  recomputan).
- Seguridad idéntica al resto de nómina: RLS `for all to authenticated` por
  `tenant_id = get_user_tenant_id() and nomina_can_access()` (reusa el helper de 0160, no se
  redefine); triggers de coherencia `security definer` + `set search_path = public` +
  `revoke execute … from public, anon` (el run y el empleado del renglón son del mismo tenant);
  grants explícitos; `touch_updated_at`. **Sin seed** (el corte lo genera el usuario; EmptyState
  cubre el vacío).

### 10.2 Cálculo advisory · `calcReciboDraft()` (PURO)

En `lib/studio/nomina/payroll-run-types.ts`. Computa SOLO lo mecánico (HANDOFF §3 «✅»):

1. **Prorrateo** por frecuencia de pago + método de días (`day_method` 30 fijos vs días reales).
2. **Horas extra** = `horas × valor_hora × (1 + overtime_pct/100)`; **bono nocturno** =
   `horas × valor_hora × (night_pct/100)` (`valor_hora = base/30/8`).
3. **Deducciones SSO/RPE/FAOV sobre el SUELDO BASE** prorrateado, con tope = `cap_sm × min_salary`
   (FAOV sin tope). HANDOFF §3: las deducciones van solo sobre el sueldo base.
4. **Cuota de préstamo** = `min(installment, saldo)` (no descuenta de más).
5. `breakdown[]` transparente (deducciones en negativo).

**Frontera (lo diferido):**
- ❌ **NO consume `rules.salarial_bonuses`** — qué bonos son salariales es **criterio del contador**;
  el subconjunto `CalcRules` ni siquiera tipa ese campo (test lo verifica: el recibo no cambia aunque
  las reglas traigan bonos).
- ❌ **NO calcula liquidación** (Art. 142 / salario integral).
- ❌ **NO genera asiento contable** — `// TODO: asiento al confirmar (slice motor + contador)`,
  integra SDD-0079 en una pasada posterior.
- Cada recibo se marca **borrador/advisory**: el contador valida antes de pagar.

### 10.3 Capa de datos, actions y UI

- `payroll-run-queries.ts`: `listPayrollRuns`/`getPayrollRun`/`listPayrollRunLines` +
  `findLivePayrollRunForPeriod` + lectores del generador (`aggregateAttendanceByEmployee` en
  `[start,end]`, `activeLoanByEmployee` reusando `listLoansWithBalance`).
- `actions.ts`: `generatePayrollRunAction` (snapshot de reglas → crea run borrador → computa renglones
  con `calcReciboDraft` para empleados activos → rollup; error claro si ya hay corte vivo),
  `regeneratePayrollRunLinesAction` (solo borrador), `setPayrollRunStatusAction` (transiciones válidas
  `borrador→confirmado→pagado` y `→anulado`; rechaza saltos; marca `confirmed_at`/`paid_at`),
  `softDeletePayrollRunAction`, `listPayrollRunLinesAction` (lectura). Todas con `moduleEditDenial("nomina")`
  como 1er paso (las de mutación). Quedan cubiertas por el anti-drift de `rbac.test.ts`
  (`app/studio/(app)/nomina/actions.ts` ya estaba en `GUARDED_ACTIONS` por archivo).
- UI: **7ª pestaña "Recibos"** en `NominaClient` (orden final: Empleados · Prestadores · Asistencia ·
  Préstamos · Amonestaciones · Recibos · Reglas) — lista de cortes con KPIs + Badge de estado, drawer
  «Generar corte» (período + fechas; frecuencia/método de las reglas vigentes) y vista de detalle del
  corte = tabla de renglones (los recibos: base, extras, deducciones, cuota, neto en `var(--f-mono)`).
- Tests: `payroll-run-types.test.ts` (prorrateo, hora extra, deducciones con topes, cuota capada al
  saldo, `salarial_bonuses` IGNORADO, transiciones, KPIs, validadores).

**Sigue diferido (otra pasada, con contador):** asiento contable al confirmar (SDD-0079), criterio
salarial (`salarial_bonuses`), salario integral / liquidación (Art. 142), export Excel del recibo.
