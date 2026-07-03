---
sdd: "0140"
title: "Perfiles de puesto en nómina + alta unificada (empleado + usuario con rol)"
status: draft
author: "Claude Code (ventana secundaria · worktree perfiles-puesto) + founder"
created: 2026-07-02
updated: 2026-07-02
supersedes: null
superseded_by: null
related: ["0103", "0085", "0139", "0113", "0024"]
confidencialidad: interno
---

# SDD-0140 · Perfiles de puesto + alta unificada de integrante

> Lleva la **Capa 2 (perfiles de puesto)** del doc del founder `estructura-perfiles-dtdcargo.md`
> a la nómina del ERP como una **tabla en la DB** (el follow-up que ese doc dejó escrito en
> §7 y §9), y unifica el alta de un integrante: **empleado de nómina + usuario con rol** en un
> solo flujo, con el rol RBAC **derivado del puesto**.

## Contexto

Hoy en el Studio conviven dos conceptos **desconectados**:

1. **Empleado de nómina** (`nomina_employees`, SDD-0103) — la persona a la que se le paga
   (ficha, sueldo, banco). No sabe nada del sistema de usuarios.
2. **Usuario con rol** (`user_tenants` + invitaciones, SDD-0085/0024) — la cuenta con acceso
   RBAC. No sabe nada de nómina.

No hay llave compartida (`nomina_employees` no tiene `user_id`; `user_tenants` no apunta a un
empleado). Y **el perfil del puesto** — "¿qué necesita Contabilidad, independientemente de
quién lo ocupe hoy?" — no existe en ningún lado del app; solo vive en un `.md` del founder en
Downloads (fuera de git).

El founder ya trabajó y validó ese modelo (2026-06-14) en `estructura-perfiles-dtdcargo.md`:
tres capas — **personas / roles-perfiles / asignación** — más el mapeo perfil→RBAC (§7) y el
`owner_role` del motor de flujo (§8–§9). Ese doc dejó un follow-up explícito:

> "La **Matriz §2 (rol→persona, titular+suplente) debe volverse una TABLA en la DB** por
> tenant, no un `.md`." (§7, §9)

Este SDD implementa ese follow-up y cierra el lazo empleado↔usuario.

## Objetivo

- **El perfil de cada puesto queda establecido en la nómina**, desacoplado de la persona: hoy
  Contabilidad la lleva Yolimar, mañana otra persona — el perfil no cambia.
- **Un solo flujo de alta**: crear el empleado, asignarle un puesto, y (opcional) invitar al
  usuario con el rol RBAC que el puesto sugiere.
- Respetar los **candados de gobernanza** del doc (separación de poderes del dinero).

## No-objetivos (V1)

- No se crean roles RBAC nuevos: se reusan los de SDD-0024/0085
  (`admin·commercial·operations·accounting·warehouse·support·marketing`). El doc confirma que
  los ~18 roles de negocio colapsan en esos.
- No se toca la matriz módulo×rol (`lib/studio/rbac.ts`) — sigue en código (decisión founder,
  SDD-0139). El `rbac_role` del puesto es **sugerencia/plantilla** para el alta, no una nueva
  fuente de permisos.
- No entra el motor de flujo (`owner_role` por servicio) — queda para SDD-0091/futuro; este
  spec solo deja el vocabulario listo (rol del puesto = mismo enum).
- No se le da acceso al ERP a externos (operador China / proveedores) — candado permanente.

---

## Diseño

### Capa 2 — `nomina_positions` (perfil de puesto)

Tabla nueva, por tenant, RLS por `tenant_id` + gate de rol del módulo `nomina`
(accounting/admin) igual que el resto de nómina.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `tenant_id` | uuid | RLS |
| `slug` | text | kebab-case, unique por tenant (`contabilidad`, `ventas-crm`, …) |
| `title` | text | "Administración / PMO / Tesorería" |
| `area` | text | agrupador: "Administración", "Comercial", "Operaciones", … |
| `rbac_role` | text null | rol RBAC sugerido (enum StudioUserRole) o null (marketing sin asiento) |
| `triggers` | text | disparadores (los que enruta el AI, §6 del doc) |
| `responsibilities` | text | responsabilidades |
| `skills` | text | skills duras + blandas |
| `kpi` | text | KPI principal |
| `owner_note` | text null | titular/suplente sugerido (referencial; la asignación real = empleados) |
| `governance_note` | text null | candado (ej: "mueve plata pero NO admin") |
| `sort_order` | int | orden en la UI |
| `active` | bool | default true |
| `created_by` / `created_at` / `updated_at` / `deleted_at` | | patrón nómina |

**Seed inicial (migración):** los ~18 puestos del doc §3/§4, con su `rbac_role` del mapeo §7.
Se siembra para el tenant DTD. Ejemplos:

- **Contabilidad** (Administración / PMO / Tesorería) → `accounting` · candado: NO admin.
- **Ventas / CRM** (Comercial) → `commercial`.
- **Marketing / Contenido** → `marketing`.
- **Operador de ERP / Data-entry** (Administración/Tecnología) → `operations` · candado:
  verifica pero NO mueve plata, nunca admin.
- **Logística / Bodega VE** (Operaciones) → `warehouse`.
- **Dirección / Coordinación China** → `admin`.
- (resto: Aduanas, Sourcing, Reclamos, QA, Trámites, Formación, Last Mile, Tesorería…)

**UI:** tab nuevo **"Puestos"** en `/studio/nomina` (`NominaClient`), con listado por área +
drawer de perfil (crear/editar). Read = accounting/admin (igual que el módulo). Cada card
muestra área, rol RBAC (badge), disparadores, responsabilidades, KPI, y el titular actual
(derivado de empleados asignados).

### Capa 3 — vínculo empleado ↔ puesto ↔ usuario

Migración añade a `nomina_employees`:

- `position_id uuid null references nomina_positions(id)` — a qué puesto pertenece.
- `user_id uuid null references auth.users(id)` — la cuenta del sistema, si tiene acceso.
  **Se completa cuando la persona acepta la invitación** (match por email en el accept flow,
  `app/invitar/[token]/actions.ts`). No todo empleado es usuario (un bodeguero puede no
  loguear) y no todo usuario es empleado.

### Alta unificada (un solo drawer)

Nuevo flujo "Nuevo integrante" (en nómina o usuarios — a decidir en impl) que en un submit:

1. Crea el `nomina_employees` (ficha; sueldo default $0 = borrador, editable después).
2. Asigna `position_id` → precarga el `rbac_role` sugerido del puesto.
3. Si se marca "dar acceso al sistema" → dispara la invitación de usuario
   (`inviteUserRPC`, reusa SDD-0085) con ese rol + region.

Al aceptar la invitación, se hace backfill de `nomina_employees.user_id` por email.
Todo pasa por `moduleEditDenial` (gate de rol) — es dinero + acceso.

### Candados de gobernanza (del doc §5.11/§7 — respetar)

- **Separación de poderes del dinero:** un puesto `accounting` mueve plata pero NO entra a
  Usuarios/Admin; `operations` verifica pero no mueve plata. El seed marca `governance_note`.
- **Externos jamás:** operador China (Candy) / proveedores → sin puesto con acceso ERP.
- El `rbac_role` del puesto es plantilla; el control real de permisos sigue siendo
  `lib/studio/rbac.ts` (matriz en código) + los gates server-side.

---

## Fases

- **Fase 1** — `nomina_positions` (migr 0204) + RLS + seed ~18 perfiles + types/queries + tab
  "Puestos" en nómina. *Entrega: "el perfil de Contabilidad establecido".*
- **Fase 2** — `position_id` + `user_id` en `nomina_employees` + alta unificada + backfill del
  vínculo en el accept flow.
- **Fase 3** — carga de los 5 integrantes actuales (empleado + puesto + usuario con rol). Como
  ventana secundaria, se entrega como **datos + pasos para el Director** (prod = nube); no se
  aplica a prod desde el lane.

## Roster a cargar (Fase 3)

Mapeo puesto → rol (org, sin PII):

| Puesto (slug) | Rol RBAC | Sede |
|---|---|---|
| `contabilidad` | `accounting` | VE-Valencia |
| `atencion-cliente-crm` (Ventas/CRM) | `commercial` | VE-Valencia |
| `contenido-social` / `direccion-marketing` (Marketing) | `marketing` | VE-Valencia |
| `operador-erp` (Administración/data) | `operations` | VE-Valencia |
| `almacen-bodega-ve` (Logística) | `warehouse` | VE-Valencia |

> **PII fuera de git (regla founder):** nombres, cédulas, emails y teléfonos de las 5 personas
> **NO se commitean** (igual que el seed ficticio de 0160). El founder/Director los carga en
> **prod** por la UI del alta unificada: `/studio/nomina → Nuevo empleado → elegir puesto →
> "Dar acceso al sistema" (el rol se autocompleta del puesto) → crear`. Sueldos en $0
> (borrador), editables. La invitación va por correo (Resend) + link de fallback; al aceptar,
> el login se enlaza a la ficha (`auth_user_id`, backfill en el accept). Telegram → notas de la
> ficha (el drawer no tiene campo Telegram; el link real se hace desde el perfil, SDD-0036).

## Gate

`node scripts/verify.mjs` verde + `pnpm build` (Turbopack) + UI/UX review del tab "Puestos"
antes del commit. Migración se escribe como archivo (0204); la aplica el Director.
