---
sdd: "0103"
title: "Nómina / RRHH — empleados y prestadores (Slice A) + roadmap LOTTT"
status: in-progress
author: "Claude Code (lane sdd-0103-nomina) + founder"
created: 2026-06-22
updated: 2026-06-22
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
