---
sdd: "0113"
title: "Onboarding y app self-service del empleado — invites + registrations + employee_comms + app /m/emp"
status: draft
author: "Claude Code (redactor de specs) + founder"
created: 2026-06-26
updated: 2026-06-26
supersedes: null
superseded_by: null
related: ["0103", "0085", "0042", "0106"]
confidencialidad: interno
---

# SDD-0113 · Onboarding y app self-service del empleado

> **Continuación del roadmap de [SDD-0103 §6](../0103-nomina/spec.md) (ítems 7 y 8).** SDD-0103
> construyó el sustrato de nómina (empleados, prestadores, reglas LOTTT, asistencia, préstamos,
> amonestaciones, motor `payroll_run`) — pero **el empleado nunca aparece**: se crea y administra
> **solo desde el admin** (`/studio/nomina`). No existe ninguna superficie del lado del empleado.
> Esta spec abre esa superficie: **auto-registro con aprobación**, **app self-service** (recibo +
> mensajes + perfil editable) y la tabla **`employee_comms`** que hoy no existe.

## 0. Por qué — y qué NO es

**El hueco:** el Norte trae una App del Empleado completa y diseñada
(`_norte/empleado/app.jsx`, `_norte/App del Empleado.html`) — login propio, recibo de pago con
PDF + envío por WhatsApp, inbox de comunicaciones con acuse de recibo, perfil con datos bancarios
editables, y auto-registro por link de invitación con aprobación del admin. **Todo vive en
`localStorage`** (mock en el navegador). No hay backend, no hay tabla `employee_comms`, no hay
flujo de registro real. El empleado es hoy un objeto pasivo que solo el admin toca.

**Frontera de esta spec: la superficie del empleado y su onboarding, NO el cálculo fiscal.** El
recibo que el empleado ve **reusa** `calcReciboDraft()` / `payroll_run` de SDD-0103 (ya existe,
advisory); esta spec **no toca la ley fiscal** ni el criterio salarial del contador. Lo que agrega
es: cómo entra un empleado nuevo (invites + registrations + aprobación), cómo recibe y confirma
comunicaciones (employee_comms), y la app `/m/emp` que consume todo eso.

**NO entra en esta spec:**
- ❌ Cálculo de recibo / liquidación / asiento contable — son de SDD-0103 (motor) + contador. El
  empleado **lee** un recibo ya computado; no se recalcula acá.
- ❌ Cambiar la RLS de las tablas de nómina existentes (employees, payroll_run, etc.). Se **leen**
  vía RPC/queries acotadas al propio empleado, sin abrir la RLS admin/accounting.
- ❌ Push notifications al empleado (VAPID) — se reusa la infra de `/m` si se decide, pero el envío
  push es Fase posterior. El acuse de recibo es **in-app** (toca "Acuso recibo").
- ❌ Editar **sueldo, cargo, cédula, estado** desde el perfil del empleado — esos campos los define
  la empresa. El gate server-side (§4) define **exactamente** qué puede tocar el empleado.
- ❌ Auto-registro **sin** aprobación (acceso automático). Todo registro pasa por el admin.

## 1. Superficie nueva: `/m/emp` (distinta de `/m/erp`)

> ⚠️ **`/m/erp` NO es la app del empleado.** `/m/erp` es la vista móvil del **admin/comercial/
> operaciones** (full Studio, misma sesión que `/studio`). La app del empleado es **una superficie
> nueva y separada**: `/m/emp`. Un empleado **no** es un usuario full Studio — es un rol acotado que
> solo ve su propio recibo, sus mensajes y su perfil.

| | `/m/erp` (existe) | `/m/emp` (NUEVO) |
|---|---|---|
| Para | admin/comercial/ops | **el empleado** |
| Auth | Supabase email+pw = sesión Studio | login propio del empleado (§3) |
| Alcance de datos | todo el tenant (RLS por rol) | **solo su propia ficha** |
| Tabs | Home/Tracking/Clients/Expenses/More | Inicio · Recibo · Mensajes · Perfil |

`/m/emp` vive bajo `app/m/emp/` (reusa `app/m/m.css`, `_components/`, `_lib/` de la PWA existente;
permitido por AGENTS.md — `/m` reusa `lib/studio`). Layout móvil con tab bar de 4, igual al Norte.

## 2. Modelo de datos propuesto

Tres piezas nuevas, todas tenant-scoped, RLS estricta, defensa-en-DB. Migraciones reservadas:
**0178, 0179** (confirmar correlativo con el Director — pueden moverse si otra rama tomó números).

### 2.1 `nomina_employee_invites` (migración 0178)

Link de invitación que genera el admin para que un candidato se auto-registre. Equivale a
`regLinkByToken` del mock.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `tenant_id` | uuid not null | FK `tenants` on delete cascade |
| `token` | text not null | aleatorio (`encode(extensions.gen_random_bytes(16),'hex')`) · `unique` |
| `cargo` | text | cargo sugerido (precarga el form) |
| `department` | text | área sugerida |
| `status` | text not null default `'activa'` | `check in ('activa','usada','revocada','expirada')` |
| `expires_at` | timestamptz | vencimiento (default +14 días) |
| `used_at` | timestamptz | cuándo se consumió |
| `created_by` | uuid | FK `auth.users` on delete set null |
| `created_at` / `updated_at` | timestamptz | `touch_updated_at` |

El link público es `/m/emp/registro?inv=<token>`. **El token solo precarga y marca "invitación
válida"; NO autentica** — el registro siempre pasa por aprobación del admin (§3).

### 2.2 `nomina_employee_registrations` (migración 0178)

Solicitud de registro que el candidato envía. Es **staging**: NO es todavía un `nomina_employees`.
El admin la revisa y, al aprobar, se materializa la ficha (con el sueldo que define la empresa).

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid not null | FK `tenants` |
| `invite_id` | uuid | FK `nomina_employee_invites` on delete set null (nullable: registro sin invitación) |
| `full_name` | text not null | **PII** |
| `national_id` | text not null | cédula **PII** · validación cédula-aware (§4, reusa SDD-0106) |
| `birth_date` | date | |
| `phone` | text | **PII** |
| `email` | text not null | login futuro · **PII** |
| `cargo` | text | propuesto |
| `start_date` | date | |
| `bank_name` / `bank_account_type` / `bank_account` | text | **PII** bancaria |
| `photo_path` | text | **Supabase Storage** (`{tenant}/employee-registrations/{id}/...`), nunca en git |
| `status` | text not null default `'pendiente'` | `check in ('pendiente','aprobada','rechazada')` |
| `reviewed_by` | uuid | FK `auth.users` |
| `reviewed_at` | timestamptz | |
| `employee_id` | uuid | FK `nomina_employees` on delete set null — se setea al aprobar (materialización) |
| `rejection_reason` | text | |
| `created_at` / `updated_at` | timestamptz | |

**Sin `deleted_at`**: una solicitud rechazada queda como rastro (no se borra). Índice único parcial
sugerido: una solicitud `pendiente` por `(tenant_id, lower(email))` (evita doble envío) — **decisión
de negocio abierta** (§9).

### 2.3 `nomina_employee_comms` (migración 0179)

La tabla que **no existe**. Comunicación de RRHH dirigida a UN empleado, con acuse de recibo.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid not null | FK `tenants` |
| `employee_id` | uuid not null | FK `nomina_employees` on delete cascade |
| `type` | text not null | `check in ('recibo','aviso','llamado','amonestacion')` — espeja `COMM_TYPES` del Norte |
| `title` | text not null | |
| `body` | text not null | |
| `ref_kind` / `ref_id` | text / uuid | puntero opcional a la entidad origen (un `payroll_run_line`, una `nomina_warnings`) — **polimórfico** |
| `requires_ack` | boolean not null default false | `llamado`/`amonestacion` → true |
| `read_at` | timestamptz | el empleado lo abrió |
| `acked_at` | timestamptz | el empleado tocó "Acuso recibo" |
| `created_by` | uuid | FK `auth.users` (quién lo envió desde RRHH) |
| `created_at` / `updated_at` | timestamptz | |
| `deleted_at` | timestamptz | soft-delete |

**Defensa-en-DB (`ref_kind`/`ref_id` polimórfico):** helper `employee_in_tenant(p_employee_id,
p_tenant_id)` (SECURITY DEFINER, fail-closed, `set search_path = public`, `revoke execute from
public, anon` + `grant to authenticated`) + trigger `employee_comms_same_tenant` BEFORE INSERT/UPDATE
que rechaza un `employee_id` de otro tenant. Si `ref_id` apunta a otra tabla, el trigger valida que
esa fila sea del mismo tenant (patrón `*_in_tenant()` + trigger del repo, igual que SDD-0102/0107).

## 3. Auth y onboarding del empleado

> **Decisión de arquitectura abierta (§9):** ¿el empleado es un `auth.users` real de Supabase (como
> el portal cliente, magic-link de SDD-0042) o un login derivado por email+pin contra su ficha? El
> Norte muestra email+contraseña. Lo propuesto: **reusar el patrón portal cliente** (Supabase auth +
> RPC `get_employee_id_for_user()` que resuelve `auth.uid()` → `nomina_employees.id`), que ya tiene
> RLS probada. Esto se confirma con el founder antes de implementar.

Flujo de onboarding (espeja el Norte):

1. **Admin genera invitación** (`/studio/nomina`, nueva acción) → fila en `employee_invites` con
   token + cargo sugerido. Comparte el link `/m/emp/registro?inv=<token>` por WhatsApp.
2. **Candidato abre el link** → form de registro (datos personales, contacto, banco, foto). El token
   precarga cargo/área y marca "invitación válida". `submitRegistrationAction` → fila `pendiente` en
   `employee_registrations` (+ foto a Storage). **No gana acceso todavía.**
3. **Admin revisa** en `/studio/nomina` (pestaña/bandeja "Solicitudes"): aprueba → **materializa**
   `nomina_employees` (con el **sueldo que define la empresa**, no el que pidió el candidato),
   genera/enlaza el login, setea `registrations.employee_id` + `status='aprobada'`; o rechaza con
   motivo. Al aprobar: opcionalmente crea un `employee_comms` de bienvenida + aviso WhatsApp/email.
4. **Empleado entra** a `/m/emp` con su credencial → ve recibo, mensajes, perfil.

## 4. App self-service `/m/emp` — alcance funcional

Cuatro tabs (Norte): **Inicio · Recibo · Mensajes · Perfil**.

### 4.1 Inicio
Saludo + card del recibo del último período (link a Recibo), banner "tienes N comunicaciones por
confirmar", resumen de préstamo activo (saldo + cuota, **derivado** de SDD-0103, nunca columna),
resumen de asistencia del mes, últimas comunicaciones. Todo **read-only** salvo navegación.

### 4.2 Recibo — PDF + WhatsApp
- Desglose del recibo del período: asignaciones (sueldo, bono, horas extra), deducciones de ley
  (SSO/RPE/FAOV), cuota de préstamo, neto salarial, no salariales (cestaticket, bono de guerra),
  total a cobrar en Bs a tasa BCV. **Los números vienen de `payroll_run_lines` (SDD-0103), no se
  recalculan** — el empleado lee el `breakdown jsonb` del renglón que le corresponde.
- **Descargar PDF**: render server-side del recibo (HTML→PDF). El mock usa `reciboHtml`/`printDoc`;
  la versión real genera el PDF en una route o reusa el patrón de export del repo. **Decisión §9:**
  generación de PDF (lib/route) — confirmar mecanismo.
- **Enviar por WhatsApp**: `wa.me` deep-link con resumen + (opcional) link al PDF firmado. Solo abre
  WhatsApp del empleado; no envía nada server-side.
- **Visibilidad:** el empleado solo ve recibos de cortes `confirmado`/`pagado` (no `borrador`). Un
  recibo en borrador advisory NO se le muestra (regla de negocio: §9 confirma).

### 4.3 Mensajes — inbox con acuse
- Lista de `employee_comms` del empleado (no leídos resaltados, badge en el tab bar).
- Abrir un mensaje lo marca `read_at`. Los `requires_ack` (llamado/amonestación) muestran botón
  **"Acuso recibo"** → `ackCommAction` setea `acked_at`. El acuse es **in-app** (timestamp en DB),
  NO firma legal cualificada (eso sería otra spec). El admin ve en `/studio/nomina` quién acusó y
  cuándo (valor legal-light: rastro de notificación).

### 4.4 Perfil — editable con GATE server-side
El empleado ve su ficha completa (cargo, cédula, departamento, banco). **Puede editar SOLO un
subconjunto**; el resto es read-only. Esto **no se hace solo en la UI** — se fuerza server-side:

- **Editable por el empleado:** `phone`, `email`, `bank_name`, `bank_account_type`, `bank_account`.
- **NO editable (lo define la empresa):** `full_name`, `national_id`, `cargo`/`position_label`,
  `department`, `salary_usd`, `status`, `hire_date`.
- **Gate server-side (`updateMyProfileAction`):** un `EMPLOYEE_EDITABLE_FIELDS` (allowlist) +
  `validateEmployeeProfileInput()` propio (**no Zod**) que **descarta** cualquier campo fuera de la
  lista antes del UPDATE. Aunque el cliente mande `salary_usd` en el FormData, el server lo ignora.
  Las queries del empleado se acotan a `employee_id = get_employee_id_for_user()` (RLS), así un
  empleado **nunca** toca la ficha de otro. **Defensa en 2 capas:** allowlist en la action + RLS por
  empleado en la DB.
- Cambios bancarios: **decisión §9** — ¿el cambio de cuenta entra directo o queda "pendiente de
  verificación" por el admin? (impacta el pago de nómina).

## 5. Capa app (convenciones del repo)

- **Queries puras** (reciben `SupabaseClient`):
  - `lib/studio/nomina/invite-{types,queries}.ts` — generar/listar/revocar invitaciones.
  - `lib/studio/nomina/registration-{types,queries}.ts` — submit/list/approve/reject; validadores
    puros (cédula-aware reusando `normalizeCedula`/`RIF_REGEX` de SDD-0106/`client-types.ts`).
  - `lib/studio/nomina/comms-{types,queries}.ts` — listar comms por empleado, marcar leído/acuse,
    crear desde RRHH; `COMM_TYPES` (label/tono/icon) espejando el Norte.
  - `lib/studio/nomina/employee-self-queries.ts` — lecturas acotadas al propio empleado (mi ficha,
    mi recibo del período, mis comms, mi asistencia, mi préstamo) vía `get_employee_id_for_user()`.
- **Server Actions** (`"use server"` + `useActionState` + parsing manual de `FormData` +
  `validate*Input()` propio, **no Zod**, `revalidatePath()`):
  - Admin (`app/studio/(app)/nomina/actions.ts`, ya en `GUARDED_ACTIONS`): `createInviteAction`,
    `revokeInviteAction`, `approveRegistrationAction`, `rejectRegistrationAction`, `sendCommAction`
    — cada una con `moduleEditDenial("nomina")` como **primer paso**.
  - Empleado (`app/m/emp/actions.ts`): `submitRegistrationAction` (público con token, sin sesión),
    `markCommReadAction`, `ackCommAction`, `updateMyProfileAction` (gate allowlist §4). Estas
    **no** llevan `moduleEditDenial("nomina")` (el caller es el empleado, no un rol Studio); su
    candado es la RLS por empleado + el allowlist.
- **Tipos** (`*-types.ts`): enums `text + check` (validators propios), helpers de label/badge tone.
- **UI:** `/m/emp` reusa `app/m/_components/` (MobileHeader, BigButton, KpiCard) + `m.css`; tokens
  `var(--*)` desde `app/studio/tokens.css`; sobre navy usar `--ink-inv-soft`/`--ink-inv-mute`, nunca
  `rgba(255,255,255,X)` inline (el mock los usa — al portar se reemplazan). Pasar por `ui-ux-designer`
  antes del commit (superficie nueva). Terminología: si aparece un MARKBOX, "Shipping Mark".

## 6. Seguridad / RLS

- **`employee_invites` / `employee_registrations`:** RLS por tenant + rol admin/accounting
  (reusa `nomina_can_access()` de SDD-0103) para el **lado admin**. El **submit del candidato** es
  un caso especial: el candidato **no tiene sesión** → `submitRegistrationAction` corre con un
  cliente de servicio acotado (valida token + tenant del token) e inserta SOLO en `registrations`
  con `status='pendiente'`. Nunca lee/escribe otra tabla. (Patrón "lead público con service client",
  como el registro de cliente público.) **Riesgo a cubrir:** rate-limit / anti-spam del endpoint
  público de registro (§9).
- **`employee_comms`:** doble lado de RLS —
  - admin/accounting (vía `nomina_can_access()`): crear/listar/soft-delete para gestión RRHH;
  - el **empleado dueño**: `using (employee_id = (select get_employee_id_for_user()))` para leer y
    para marcar `read_at`/`acked_at` **solo de los suyos**. `with check` impide que escriba comms.
- **Lectura del recibo:** el empleado **no** recibe RLS abierta sobre `payroll_run_lines` (eso
  expondría sueldos de todos). En su lugar, una **RPC `get_my_payslip(p_period)`** (SECURITY DEFINER,
  fail-closed, resuelve `auth.uid()`→empleado, devuelve solo SU renglón) o una policy de fila por
  empleado. **Decisión §9:** RPC vs policy directa.
- **Storage (foto de registro):** bucket privado, ruta `{tenant}/employee-registrations/{id}/...`,
  signed URL. PII de candidatos **nunca en git**.
- **PII en git = cero:** seed = demo ficticio (igual que SDD-0103). Cédulas/teléfonos/cuentas reales
  solo en DB con RLS.
- **Defensa en profundidad:** (1) la UI del perfil oculta campos no editables; (2) el allowlist
  server-side los descarta; (3) la RLS acota al propio empleado. Las tres capas, no una sola.

## 7. Slices propuestos

| Slice | Entregable | Migración |
|---|---|---|
| **A — Onboarding (admin)** | `employee_invites` + `employee_registrations` + bandeja "Solicitudes" en `/studio/nomina` + generar invitación + aprobar/rechazar (materializa ficha) | 0178 |
| **B — Comunicaciones** | `employee_comms` + helper/trigger same-tenant + enviar comm desde RRHH + (admin ve acuses) | 0179 |
| **C — App empleado** | `/m/emp` (auth + Inicio + Recibo lectura + Mensajes/acuse + Perfil con gate) + queries self + RPC recibo | sin migración nueva (o policy en C) |
| **D — Recibo PDF + WhatsApp** | generación PDF del recibo + deep-link WhatsApp | sin migración |

Slice A es el cimiento (sin empleados nuevos no hay a quién darle app). B y C pueden ir en paralelo
tras A. D es additivo sobre C. Por ser **dinero + PII**, cada Slice lleva su gate (`node
scripts/verify.mjs` 🟢) y **auditoría adversarial** (patrón del repo para módulos sensibles).

## 8. Criterios de aceptación

- Un admin genera un link de invitación; un candidato abre `/m/emp/registro?inv=<token>`, ve el
  cargo precargado y "invitación válida", y envía su registro → aparece `pendiente` en la bandeja.
- Aprobar la solicitud **crea** un `nomina_employees` con el sueldo que tipea el admin (NO el que
  pidió el candidato), enlaza el login y marca la solicitud `aprobada`.
- Rechazar deja la solicitud con motivo, sin crear ficha; el candidato no obtiene acceso.
- El empleado entra a `/m/emp` y ve **solo su** recibo, mensajes y perfil; intentar leer otro
  empleado (manipulando el request) → **denegado por RLS**.
- En Perfil, el empleado edita teléfono/correo/banco y guarda; mandar `salary_usd`/`cargo` en el
  FormData **no los cambia** (allowlist server-side los descarta). Test que lo prueba.
- Un `llamado`/`amonestacion` aparece con "Falta confirmar"; "Acuso recibo" setea `acked_at`; el
  admin lo ve confirmado con timestamp.
- El recibo en borrador advisory **no** es visible para el empleado; solo confirmado/pagado.
- Vitest: validadores de invitación/registro/comm (cédula-aware, required, enums), allowlist del
  perfil, paridad `normalizeCedula` ↔ índice SQL. `app/m/emp/...` no importa nada prohibido (la
  frontera público↔ERP no aplica a `/m`, pero sí el lint general).
- Migraciones aplicadas en **branch efímero de Supabase** (no prod); el agente **no aplica a prod**.

## 9. Decisiones pendientes (founder)

1. **Auth del empleado:** ¿`auth.users` real (patrón portal cliente magic-link, SDD-0042) o login
   email+pin derivado contra la ficha? Define toda la capa de sesión y RLS.
2. **Sueldo en el auto-registro:** confirmado que el candidato **NO** propone sueldo y la empresa lo
   fija al aprobar — ¿o el candidato puede sugerir una pretensión salarial (informativa)?
3. **Cambio de datos bancarios desde el perfil:** ¿entra directo o queda "pendiente de verificación"
   por el admin antes de usarse en la nómina? (riesgo: empleado cambia cuenta justo antes del pago).
4. **Visibilidad del recibo:** ¿solo cortes `confirmado`/`pagado`, o también el borrador advisory
   (con sello "provisional")? Lo propuesto: solo confirmado/pagado.
5. **Acuse de recibo — valor legal:** ¿basta el timestamp in-app (`acked_at`) como rastro, o RRHH
   necesita firma/evidencia más fuerte (PIN, geo, foto) para amonestaciones Art. 79 LOTTT?
6. **Generación del PDF del recibo:** ¿lib server-side (qué motor), route dedicada, o reusar un
   patrón de export existente? ¿El PDF lleva membrete legal / datos fiscales del empleador?
7. **Anti-spam del registro público:** el endpoint de `submitRegistration` es público (sin sesión).
   ¿Rate-limit por IP, captcha, o solo aceptar con token de invitación válido (cerrar el registro
   "abierto" sin invitación)?
8. **Expiración / un-registro-por-email:** ¿caducidad del link de invitación (propuesto 14 días)?
   ¿índice único que impida dos solicitudes `pendiente` con el mismo email?
9. **Notificación al empleado:** al aprobar/enviar comm, ¿se avisa por WhatsApp (deep-link manual
   del admin), email (Resend, ya en prod) o push (`/m` VAPID)? Define si entra infra de envío.
10. **Numeración de migraciones (0178/0179):** confirmar con el Director que no colisionan con otra
    rama viva (SDD-0103 ya llegó a 0177; persons/academia hicieron out-of-order).

## 10. Archivos (propuesta)

```
supabase/migrations/0178_employee_invites_registrations.sql   (nuevo)
supabase/migrations/0179_employee_comms.sql                   (nuevo)
lib/studio/nomina/invite-{types,queries}.ts                   (nuevo)
lib/studio/nomina/registration-{types,queries}.ts             (nuevo)
lib/studio/nomina/comms-{types,queries}.ts                    (nuevo)
lib/studio/nomina/employee-self-queries.ts                    (nuevo)
lib/studio/nomina/*-types.test.ts                             (nuevo · validadores puros)
app/studio/(app)/nomina/actions.ts                            (editar: +invite/registration/comm)
app/studio/(app)/nomina/_components/*                         (editar: bandeja Solicitudes + enviar comm)
app/m/emp/page.tsx                                            (nuevo · app del empleado)
app/m/emp/actions.ts                                          (nuevo · submit/ack/perfil)
app/m/emp/registro/page.tsx                                  (nuevo · auto-registro por link)
app/m/emp/_components/*                                       (nuevo · Inicio/Recibo/Mensajes/Perfil)
lib/studio/rbac.test.ts                                       (editar: nuevas actions admin en GUARDED_ACTIONS)
docs/specs/0113-empleado-self-service/spec.md                 (este archivo)
```

## 11. Referencias

- Diseño norte: `docs/design/studio/_norte/empleado/app.jsx` · `App del Empleado.html`.
- Sustrato nómina: [SDD-0103](../0103-nomina/spec.md) (empleados, payroll_run, calcReciboDraft, RLS
  `nomina_can_access()`).
- Patrón auth acotado al dueño: [SDD-0042 Portal Cliente](../0042-portal-cliente/spec.md)
  (`get_portal_client_id`, magic-link).
- Identidad por cédula: [SDD-0106](../0106-persons-identidad/spec.md) (`normalizeCedula`, validación
  cédula-aware).
- RBAC por módulo: [SDD-0085](../0085-rbac-modulos/spec.md) (`moduleEditDenial`, `requireModuleView`).
