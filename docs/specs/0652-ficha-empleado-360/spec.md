---
sdd: "0652"
title: "Ficha 360° del empleado en el Studio: datos, nómina, acceso, inicios de sesión y lo que hizo"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0103", "0113", "0136", "0140", "0166", "0174", "0201", "0273", "0274", "0275", "0505", "0600", "0622", "0635", "0650"]
confidencialidad: interno
---

# SDD-0652 — Ficha 360° del empleado en el Studio

> Quien abre a una persona del equipo en Nómina ve en una sola página quién es, cuánto gana y qué debe, si tiene acceso al sistema, cuándo entró y qué hizo, con enlaces para profundizar. Toma la estructura de la ficha 360° del cliente (SDD-0650).
> **Esta PR es solo la spec (fase de análisis).** No implementa nada. Las fases F1 a F5 las asigna el Director General después de que Sam responda las decisiones de §8.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Medido en `main` `26a9a911e` (2026-11-16). Las líneas citadas se vencen si alguien edita arriba: copia el nombre de la función o del bloque al buscar.
> **Corregida tras la revisión independiente del DG** sobre `18441e8b7` (CHANGES REQUESTED, 2026-11-16): catálogo de auditoría en vez de CHECK, retención dentro de AUD-02 y del calendario v1.0, preflight y permisos de la 0555, reutilización de cuentas en `ensureEmployeeAuthUser`, auditoría existente de finiquitos y clasificación de gobernanza (§10).

## 1. Pedido

Sam, 2026-11-16, en la sesión del Director General (texto literal):

- «así como hicimos…con el formato del cliente (…360, donde reestructuramos toda la ficha), quiero que activemos la ficha de empleado»
- «se pueda subir su foto de perfil y tenga más información del empleado»
- «como admin, quiero poder ver todos los logins que han hecho y aparte todo el seguimiento»
- «Ahorita el perfil de nómina es el mismo que el perfil de usuario. No siempre es así…todas las personas que están ahí sí van a tener usuario. Más adelante, cuando meta empleados que no tienen acceso al sistema, será otro tema»
- «Si esos empleados tienen acceso al sistema, que me abra sus logins y la información de qué han hecho (el seguimiento que antes solo teníamos en usuario)»
- «En la ficha de empleados no me aparece el correo y no tengo manera de entrar a ver al empleado a ese nivel…Deseo rediseñarla otra vez 360.»

## 2. Lo que hay hoy

### 2.1 Ficha de empleado (Nómina)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| `nomina_employees` guarda nombre, cédula, cargo, departamento, teléfono, **correo**, sueldo en USD, ingreso, nacimiento, banco, tipo y número de cuenta, estado y notas | `supabase/migrations/0160_nomina_employees.sql:21-49` | C |
| La RLS deja leer y escribir solo a `admin` y `accounting` del tenant (`nomina_can_access`) | `0160_nomina_employees.sql:71-85`, `:136-147` | C |
| **Ya existe el enlace al usuario:** `nomina_employees.auth_user_id` (FK a `auth.users`), único por usuario vivo | `supabase/migrations/0181_employee_comms.sql:37-46` | C |
| Ese enlace abre la app del empleado `/m/emp`: `get_employee_id_for_user()` devuelve la ficha del `auth.uid()` | `0181_employee_comms.sql:48-62`, `app/m/emp/page.tsx:6` | C |
| `position_id` enlaza con el puesto (SDD-0140) | `supabase/migrations/0205_nomina_employee_position.sql:17-21` | C |
| Hay tablas por empleado: asistencia, préstamos y cuotas, amonestaciones, corridas y líneas de nómina, finiquitos, comunicaciones, cambios de banco | `0163:25`, `0164:21,44`, `0171:21`, `0175:39,102`, `0179:93,203`, `0181:117`, `0182:112` | C |
| La pantalla es `/studio/nomina` con 11 pestañas; «Empleados» es la primera | `app/studio/(app)/nomina/_components/NominaClient.tsx` (`TABS`, línea 115) | C |
| La fila del empleado muestra iniciales, nombre, código, cargo, departamento, sueldo y estado. **No muestra el correo.** La fila no navega: sus dos controles son el interruptor activo/inactivo (`StatusToggle`, oculto para egresados) y el lápiz que abre el formulario de edición | `NominaClient.tsx` (`EMP_COLS` :580, `EmpleadoRow` :636, `StatusToggle` :712, lápiz :722) | C |
| El correo solo aparece como campo del formulario de edición | `app/studio/(app)/nomina/_components/EmpleadoDrawer.tsx:219-226` | C |
| **No hay ruta de detalle:** no existe `app/studio/(app)/nomina/empleados/` ni otra página por empleado | `find app/studio/(app)/nomina` (solo `page.tsx` y `finiquito/[id]`) | C |
| La consulta de empleados **no trae `auth_user_id`** | `lib/studio/nomina/employee-queries.ts` (`EMPLOYEE_COLUMNS`, :13-17) | C |
| El Norte sí dibuja un **Expediente** por empleado: KPIs (sueldo, neto, saldo de préstamo, asistencia), ficha, banco, documentos y línea de tiempo (ingreso, comunicaciones, préstamos). El Studio nunca lo portó | `docs/design/studio/_norte/erp/modules/nomina.jsx` (`ExpedienteView`, :1476), `docs/design/studio/_norte/HANDOFF-NOMINA.md:16` | D |
| **La ficha del empleado no deja eventos** en `entity_audit_log`: no hay tipo de entidad de empleado en el catálogo `audit_entity_types` ni inserciones desde `nomina/actions.ts`. Un cambio de sueldo, banco o estado solo mueve `updated_at` | `grep` de `nomina_employee` en `supabase/migrations` y de `entity_audit_log` en `app/studio/(app)/nomina/actions.ts` (sin resultados) | C |
| Lo que sí se audita en Nómina es la **anulación de finiquitos**: tipo `payroll_settlement` (dominio `finance`), evento `payroll_settlement_voided`, por la RPC gobernada `void_payroll_settlement_governed`. La Línea de tiempo los usa | `supabase/migrations/0316_nomina_settlement_void_governance.sql:26-32`, `:191`, `:261`, `:320` | C |
| `entity_audit_log.entity_type` **ya no tiene CHECK**: desde la 0261 es una FK al catálogo `public.audit_entity_types` (`entity_type`, `status`, `domain_code`, `contract_version`). Un tipo nuevo se agrega con `insert … on conflict` en el catálogo | `supabase/migrations/0261_audit_entity_catalog_validate.sql:119-133`; patrón en `0538_studio_user_module_grants.sql:292-299` y `0316:26-32`; AUD-01 §3 | C · D |
| El `domain_code` decide la clase de retención: `finance` es `fiscal`; `governance`, `security`, `access`, `integration` y `ai` son `security`; `operations`, `commercial` y `procurement` son `operational` | `supabase/migrations/0304_audit_retention_batches.sql:68-69`; `docs/legal/retention-schedule-v1.md` §3 | C · D |
| `nomina_employee_registrations.photo_path` (foto del candidato) existe y ningún código la escribe | `supabase/migrations/0180_employee_invites_registrations.sql:90`; `grep photo_path` en `app` y `lib` | C |

### 2.2 Ficha de usuario (Usuarios)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La ficha de usuario es un panel lateral con tres pestañas: Perfil, Acceso y Actividad | `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx:14-17`, `:139-155` | C |
| Muestra y edita el correo (de `auth.users`) | `UserDetailDrawer.tsx:214`; `app/studio/(app)/usuarios/page.tsx:95-129` | C |
| «Actividad» es la línea de tiempo **de lo que se le hizo al acceso** de la persona: extras dados o quitados, cambios de rol y de almacén, suspensiones. Sale de `entity_audit_log` y `user_role_audit` | `app/studio/(app)/usuarios/_components/acceso/ActividadAcceso.tsx:1-13`; `supabase/migrations/0201_user_role_audit.sql:16` | C |
| El último ingreso combina `user_tenants.last_login_at` (trigger sobre `auth.sessions`, con falsos negativos medidos) y `auth.users.last_sign_in_at` | `usuarios/page.tsx:96-129`; `supabase/migrations/0019_users_roles.sql:313-333`; SDD-0275 | C |
| `user_profiles` tiene `avatar_url` (texto), sin subida en el Studio. La leen el dueño y todo miembro activo del tenant | `0019_users_roles.sql:62-71`; `supabase/migrations/0200_rbac_disabled_enforcement.sql:414-424` | C |
| Ni Usuarios ni `lib/studio/user-queries.ts` mencionan Nómina: la ficha de usuario no sabe si la persona es empleado | `grep -i "nomina\|empleado"` en `usuarios/` y `user-queries.ts` (sin resultados) | C |
| Usuarios es solo de admin; Nómina, de admin y Contabilidad | `lib/studio/rbac.ts:136` (`nomina: ["accounting"]`), `:152` (`users: []`) | C |
| Un **acceso extra** a `nomina` (SDD-0635) pasa la puerta de la página, porque `requireModuleView` mira los extras; pero la RLS (`nomina_can_access`) solo deja a `admin` y `accounting`, así que esa persona ve la lista **vacía** | `lib/studio/rbac-guard.ts:156-157`; `0160_nomina_employees.sql:71-85` | C |

En esta spec, **«admin»** es el rol `admin` en `user_tenants` con `disabled_at is null`, comprobado en la base, igual que `audit_list_events` (`0398_audit_comment_action_summary.sql:105-120`). No es «tiene el módulo visible» ni un acceso extra. «Contabilidad» es el rol `accounting`.

### 2.3 Dónde vive hoy «el seguimiento»

| Hecho | Fuente | Etiqueta |
|---|---|---|
| `entity_audit_log` tiene `actor_type` y `actor_id`: cada evento auditado dice quién lo hizo | `supabase/migrations/0066_foundation_v3.sql:64-80` | C |
| El visor gobernado es la RPC `audit_list_events`, solo para admin, en `/studio/admin` | `supabase/migrations/0398_audit_comment_action_summary.sql:63-120`; `lib/studio/audit-queries.ts:169-188`; `app/studio/(app)/admin/page.tsx:57` | C |
| **La RPC no filtra por `actor_id`** (filtra por tipo de actor, entidad, evento, fuente, resultado, sensibilidad, correlación y fecha). AUD-02 §4 sí pide filtro por actor | `0398_audit_comment_action_summary.sql:63-75`, `:288-300`; `docs/governance/policies/aud-02.md` §4 | C · D |
| Por eso hoy **no hay ninguna pantalla con «lo que hizo esta persona»**. Lo que Sam llama «el seguimiento que antes solo teníamos en usuario» es, medido, la pestaña Actividad: lo que se le hizo a su acceso, no lo que hizo ella | §2.2 | I |
| AUD-01 obliga a auditar mutaciones de negocio, no lecturas: «lo que hizo» cubre lo que se auditó (cambios), no las páginas que vio | `docs/governance/policies/aud-01.md:22-34` | D |

### 2.4 Inicios de sesión

| Hecho | Fuente | Etiqueta |
|---|---|---|
| No hay tabla propia de inicios de sesión. Solo existe la fecha del último (`last_login_at`, `last_sign_in_at`) | §2.2; `grep login_events\|sign_in_events` (sin resultados) | C |
| GoTrue es `supabase/gotrue:v2.197.0` | `infra/dtd-cargo/compose.supabase.yml:176` | C |
| GoTrue guarda su bitácora en `auth.audit_log_entries` y las sesiones vivas en `auth.sessions`. El repo las trata como datos de red con IP | `docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md:47`; `infra/ops/migrate/import-from-cloud.sh:78-87` | D |
| Qué columnas y qué IP tienen en esta versión | — | NV: medir en el stack local, nunca en producción |
| **El login del Studio es una server action**: el navegador le manda la contraseña a Next.js y Next.js llama a GoTrue | `app/studio/(auth)/login/actions.ts:45` (`signInWithPassword`) | C |
| Por eso GoTrue vería la IP y el agente del servidor de Next, no los de la persona | — | I, a comprobar en F3 |
| `auth.sessions` se borra al cerrar sesión o vencer: no es un historial | — | I (comportamiento de GoTrue) |
| Ya existe `getRequestIp()`, que toma la IP del header que fija el proxy (`REQUEST_IP_HEADER`, hoy `x-real-ip` de Traefik) | `lib/http/request-ip.ts:1-40`, `:74`, `:109`; `infra/dtd-cargo/compose.yml:64-67` | C |
| Si Cloudflare hace de proxy delante de Traefik, `x-real-ip` es la IP del borde y no la de la persona. Esta SDD no toca el borde ni Cloudflare | `lib/http/request-ip.ts` (comentario sobre `cf-connecting-ip`) | D · NV |

## 3. Respuestas directas

### 3.1 ¿Por qué la ficha no muestra el correo?

Por tres causas, medidas:

1. **La fila no lo pinta.** `EmpleadoRow` muestra nombre, código, cargo, departamento, sueldo y estado. El correo no está en las columnas (`NominaClient.tsx`, `EMP_COLS` y `EmpleadoRow`). Solo se ve al abrir el formulario de edición (`EmpleadoDrawer.tsx:219-226`).
2. **El correo de la ficha y el del usuario son datos distintos.** `nomina_employees.email` es un texto que se teclea en Nómina. El correo con el que la persona entra vive en `auth.users` y lo muestra Usuarios (`usuarios/page.tsx:95-129`). Si la ficha se creó a mano sin correo, ese campo está vacío aunque la persona tenga usuario (I: no se leyó producción).
3. **La ficha no sabe cuál es su usuario.** La consulta no trae `auth_user_id` (`employee-queries.ts:13-17`), así que no puede ir a buscar el correo de login.

### 3.2 ¿Por qué no se puede entrar al detalle del empleado?

Porque **no existe**. El Studio implementó la lista y el formulario, pero no el Expediente que dibuja el Norte (`_norte/erp/modules/nomina.jsx:1476`). No hay ruta por empleado y la fila no navega: solo tiene el interruptor de estado y el lápiz de editar (`NominaClient.tsx:712`, `:722`). Lo que tiene un empleado (préstamos, amonestaciones, recibos, comunicaciones) vive en pestañas separadas de Nómina, filtrado por persona a mano.

### 3.3 ¿Por qué «el perfil de nómina es el mismo que el de usuario» no se nota en el sistema?

El enlace existe (`auth_user_id`, 0181), pero solo se llena en dos caminos:

- al **aprobar una solicitud** de alta del empleado (`approveRegistrationAction`), con `ensureEmployeeAuthUser` (`app/studio/(app)/nomina/actions.ts:1891-1927`);
- al **aceptar una invitación**, si el correo de la ficha coincide exactamente con el de la invitación (`app/invitar/[token]/actions.ts:151-180`, endurecido por la SDD-0600).

**Lo que hace de verdad `ensureEmployeeAuthUser`** (C):

1. Intenta crear un `auth.users` nuevo con el correo de la solicitud, ya confirmado (`:1895-1900`).
2. Si el correo ya existe, **reutiliza ese usuario** (`:1902-1927`). Solo lo rechaza en dos casos: si ya está enlazado a otra ficha viva (`:1912-1918`) o si es miembro de `user_tenants`, es decir, usuario del Studio (`:1920-1924`).
3. **No mira `client_users`.** Un cliente del portal con el mismo correo queda enlazado a la ficha, y con eso abre `/m/emp`. Ahí ve los recibos, las comunicaciones y el contacto de esa ficha, porque `get_employee_id_for_user()` solo mira `auth_user_id` (`0181:48-62`) y `/m/emp` solo exige sesión (`app/m/emp/page.tsx:30`).
4. Busca el correo solo en la **primera página de 200 usuarios** (`listUsers({ page: 1, perPage: 200 })`, `:1910`). Con más de 200, no lo encuentra y la ficha queda sin acceso (falla cerrado).

El caso del punto 3 pide una solicitud aprobada con el correo de un cliente: por error de tipeo o porque alguien escribió un correo ajeno en el formulario público de alta. El enlace no lo ve nadie en el Studio (§2.1), así que pasaría sin que nadie lo note. Se cierra en la F5 (§4, punto 6).

Una persona que ya era usuaria del Studio antes de tener ficha, o cuya ficha se creó con otro correo o sin correo, queda **sin enlace** (I: cuántas son en producción se mide solo con OK, §12). Y aunque esté enlazada, la pantalla no lo usa.

## 4. Enlace explícito empleado ↔ usuario

**Propuesta:** se conserva la columna que ya existe, `nomina_employees.auth_user_id`. No se agrega una tabla de uniones: la relación es una persona, un usuario, y el índice único de 0181 ya lo garantiza (`0181:43-46`).

Lo que cambia es **cómo se llena**: por una decisión explícita, nunca por adivinar.

1. **«Enlazar con usuario»** en la ficha 360, solo para admin. Abre un selector con los usuarios activos del tenant que no tienen ficha (por `user_id`; el correo solo se muestra para reconocerlos). Pide motivo. Lo hace una RPC `security definer` que exige admin, valida el tenant, que el usuario esté activo, que **sea miembro de Studio de ese tenant** y que ninguno de los dos esté enlazado. Deja un evento en `entity_audit_log` con el tipo nuevo `nomina_employee_access` (dominio `access`), eventos `user_linked` y `user_unlinked`, con los dos ids y el motivo, sin correo. Migración 0555.
2. **«Quitar enlace»**, igual, con motivo.
3. **Sugerencia, no enlace:** si el correo de la ficha coincide exactamente con el de un usuario del Studio sin ficha, la ficha muestra «Este correo es el de [usuario]. ¿Enlazar?». La coincidencia **propone** y enlaza el admin. Si las sugerencias se confirman una por una o en lote, lo decide D13.
4. **Alta nueva con acceso** (el «dar acceso» de la SDD-0140): la invitación lleva el id de la ficha, y al aceptarla se enlaza esa ficha, no la que tenga el mismo correo. Reemplaza el relleno por correo de `app/invitar/[token]/actions.ts:151-180`. Necesita que la invitación guarde `employee_id`: va en la F5 con su propia migración (D2).
5. **Usuario sin ficha** (por ejemplo, una cuenta externa o de prueba): la ficha de usuario dice «No tiene ficha de empleado» y, para admin, ofrece «Crear ficha» con el usuario ya enlazado.
6. **Aprobar una solicitud ya no reutiliza usuarios por correo** (F5, cierra el punto 3 de §3.3). Si el correo no existe en Auth, crea el usuario nuevo como hoy. Si ya existe, la ficha se crea **sin acceso** y avisa: «Ese correo ya tiene una cuenta. Si es la misma persona, enlázala desde la ficha». El enlace pasa por el punto 1, que solo acepta miembros de Studio. Si la cuenta solo era de `/m/emp` (por ejemplo, un empleado que vuelve), la F5 agrega «Reenlazar su cuenta de empleado»: la confirma el admin y **se niega si esa cuenta está en `client_users`**. Los enlaces que ya existen no se tocan por su cuenta: la F5 cuenta en producción, con OK y sin nombres, cuántas fichas tienen un `auth_user_id` que también está en `client_users`. Lo que salga se revisa con Sam caso por caso.

### 4.1 Empleado sin usuario (previsto, se implementa después)

- La ficha 360 funciona entera sin usuario: cabecera, datos, nómina y línea de tiempo. La zona «Acceso al sistema» dice **«Sin acceso al sistema»** y, para admin, ofrece «Dar acceso» (punto 4) o «Enlazar con usuario» (punto 1).
- Las pestañas «Inicios de sesión» y «Lo que hizo» no aparecen: no hay usuario del que hablar. No se muestran vacías.
- Si un usuario enlazado se suspende o se borra, la ficha sigue (la FK es `on delete set null`, `0181:38`) y muestra «Acceso suspendido» o «Sin acceso al sistema».
- Al enlazar un usuario a una ficha, esa persona **también entra a su app del empleado** `/m/emp` (recibos, comunicaciones, contacto), porque `get_employee_id_for_user()` la resuelve por `auth_user_id`. Es un efecto que Sam tiene que aceptar (D3).

## 5. Diseño de la ficha 360°

Ruta propia, como la del cliente: **`/studio/nomina/empleados/[codigo]`** con el código `EMP-NNNN` (no es dato personal). Se entra al hacer clic en la fila de Empleados, que pasa a mostrar también el correo. La ficha de usuario enlaza a ella con «Ver ficha de empleado» para quien tiene Nómina.

Reutiliza de la SDD-0650: la grilla `.studio-ficha-grid` y sus columnas (`app/studio/studio.css`, en la PR #629), la cabecera con acciones rápidas que no rebotan (un botón que el rol no puede usar no aparece), los avisos a todo el ancho y la regla «sin dato, se dice, no se inventa». Componentes del Studio: `Avatar`, `Badge`, `Aviso`, `KpiCard`, `EmptyState`, las pestañas `.studio-tabs` (SDD-0603) y `ActividadAcceso`. Densidad del Studio y solo tokens de `app/studio/tokens.css` (`BRAND.md`, `docs/design/README.md`). La forma sigue el Expediente del Norte (`nomina.jsx:1476`).

| Zona | Contenido | Quién la ve | Fase |
|---|---|---|---|
| Cabecera | Foto (o iniciales), nombre, `EMP-NNNN`, puesto y departamento, estado, **correo de la ficha** y, si hay usuario, **correo de acceso** (si difieren, los dos, con su nombre), teléfono. Acciones: Editar, Registrar préstamo, Amonestación, Generar finiquito | Admin y Contabilidad | F1. Foto en F2 |
| Avisos | Solicitud de cambio de banco o de contacto pendiente; usuario suspendido; sugerencia de enlace (§4, punto 3) | Admin y Contabilidad | F1. Sugerencia en F2 |
| KPIs | Sueldo mensual (USD), saldo de préstamos, asistencia del mes, amonestaciones del año | Admin y Contabilidad | F1 |
| Columna Datos | Personales (cédula, nacimiento, ingreso), banco con la cuenta **enmascarada** (últimos 4), notas. «Mostrar» la cuenta completa con evento de consulta (D9) | Admin y Contabilidad | F1 enmascarada. «Mostrar» en F2 |
| Columna Nómina | Préstamos y cuotas, recibos recientes, amonestaciones, finiquito si existe, comunicaciones. Cada bloque enlaza a su pestaña de Nómina filtrada | Admin y Contabilidad | F1 |
| Columna Acceso al sistema | Rol, alcance, último ingreso, estado; «Ver ficha de usuario». Sin usuario: «Sin acceso al sistema» (§4.1) | Admin (Contabilidad ve «Tiene acceso» o «Sin acceso», sin detalle) | F1 (lectura). Enlazar en F2 |
| Pestaña Resumen | Lo de arriba | — | F1 |
| Pestaña Línea de tiempo | Ingreso, comunicaciones, préstamos, amonestaciones, recibos y finiquito, en orden, más la anulación de finiquitos que ya se audita (`payroll_settlement_voided`, 0316). Con F2, enlaces y foto; con F5, los cambios de la ficha | Admin y Contabilidad | F1. Enlaces en F2, cambios en F5 |
| Pestaña Inicios de sesión | Fecha y hora (Caracas), resultado, IP, navegador y sistema; filtro por fecha | **Solo admin** | F3 |
| Pestaña Lo que hizo | Eventos de `entity_audit_log` donde la persona es el actor, con el visor gobernado (resumen permitido, payload oculto) | **Solo admin** | F4 |
| Pestaña Acceso | La «Actividad» de hoy: lo que se le hizo al acceso (`ActividadAcceso`) | Solo admin | F1 (reuso) |

Por ancho: tres columnas desde 1.441 px, dos (Acceso abajo) hasta 900 px, una debajo, igual que la 0650. Sin acceso a «Acceso al sistema» (Contabilidad), dos columnas. Las pestañas solo de admin se filtran **en el servidor**: a Contabilidad no le llegan ni el componente ni los datos.

## 6. Fases

### F1 — Ficha 360° de lectura (sin migración)

1. La consulta de empleados trae `auth_user_id`. `getEmployeeByCode` nueva.
2. La fila de Empleados muestra el correo. El nombre pasa a ser un `<a href>` a la ficha: no se hace clicable el `div` de la fila (BTN-01). El interruptor de estado y el lápiz siguen siendo `<button type="button">` y no cambian de lugar según el estado (TBL-01). El enlace tiene un nombre accesible («Abrir ficha de …») y foco visible (A11Y-01).
3. Ruta `/studio/nomina/empleados/[codigo]` con `requireModuleView("nomina")`. Si el código no existe, está borrado o es de otro tenant: 404. Quien entra solo con un acceso extra a `nomina`, sin rol `admin` ni `accounting`, recibe también 404, porque la RLS no le devuelve la fila. La lista le sale vacía, como hoy (§2.2).
4. Cabecera, avisos, KPIs, columnas y pestañas Resumen, Línea de tiempo y Acceso de §5, leyendo lo que ya existe por `employee_id`.
5. Correo de acceso: si hay `auth_user_id`, se lee de `auth.users` con el cliente admin **solo en el servidor y solo para admin** (como `usuarios/page.tsx:90-129`). A Contabilidad le llega «Tiene acceso» sin correo de login.
6. En la ficha de usuario, «Ver ficha de empleado» cuando existe la ficha enlazada.

### F2 — Enlace explícito y foto (migración **0555**, reservada)

Contenido de la 0555, en este orden:

1. **Topes:** `set lock_timeout = '5s'` y `set statement_timeout = '30s'`, como la 0261 (`0261_audit_entity_catalog_validate.sql:19-20`).
2. **Preflight que aborta** (`do $$ … raise exception`) si falta algo de lo que da por hecho o si ya existe algo de lo que va a crear:
   - existen `public.nomina_employees`, `public.entity_audit_log` y `public.audit_entity_types` (`to_regclass`);
   - existen la FK `entity_audit_log_entity_type_fkey` y la columna `nomina_employees.auth_user_id`;
   - **no** existen la columna `nomina_employees.photo_path` ni el bucket `employee-photos`;
   - **no** existen en el catálogo los tipos que agrega, o existen con el mismo `domain_code`. Si alguno existe con otro dominio, aborta: cambiar el dominio cambia la clase de retención.
3. **Catálogo de auditoría**, con `insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref) … on conflict (entity_type) do update`, el patrón de `0538_studio_user_module_grants.sql:292-299`:

   | `entity_type` | `domain_code` | Clase (calendario v1.0) | Eventos | Fase |
   |---|---|---|---|---|
   | `nomina_employee_access` | `access` | `security`, 2 años | `user_linked`, `user_unlinked` | F2 |
   | `nomina_employee_photo` | `governance` | `security`, 2 años | `photo_set`, `photo_removed` (sin la imagen ni la ruta) | F2 |
   | `nomina_employee_sensitive_view` | `security` | `security`, 2 años | `bank_account_revealed` (sin el número) | F2 |
   | `studio_login_events` | `security` | `security`, 2 años | `login_events_viewed` (sin IP ni agente; solo de quién y qué rango) | F3, en su migración |
   | `nomina_employee` | `finance` | `fiscal`, 10 años | cambios de sueldo, banco, estado y puesto | F5, en su migración |

   La foto va en `governance` y no en `operations` porque es un dato de la persona, no un hecho operativo: así se purga a los 2 años y no a los 5. Los cambios de sueldo son nómina, y por eso `finance`, como `payroll_settlement` (`0316:26-32`).
4. **RPC** `nomina_link_employee_user(p_employee_id uuid, p_user_id uuid, p_reason text)` y `nomina_unlink_employee_user(p_employee_id uuid, p_reason text)`:
   - `security definer`, `set search_path = ''`;
   - solo un admin de un único tenant (el chequeo de `0398:105-120`);
   - ficha y usuario del mismo tenant; usuario miembro activo de Studio de ese tenant; ninguno de los dos ya enlazado; ficha viva y no egresada;
   - motivo obligatorio, de 3 a 500 caracteres;
   - evento en la misma transacción (AUD-01).

   Después: `revoke all … from public, anon` y `grant execute … to authenticated` explícito, porque el `revoke` a `public` también le quita el permiso a `authenticated`.
5. **Foto:** `nomina_employees.photo_path text` y el bucket **privado** `employee-photos`, con `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('employee-photos', 'employee-photos', false, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing`, el patrón de `0457_document_import_workspaces.sql:103-105`. Ruta `{tenant_id}/{employee_id}/{uuid}.webp`. No hay policies para `authenticated`. Se sube y se firma en el servidor con el cliente admin, después de comprobar el rol. La URL firmada dura poco (por ejemplo, 10 minutos).
6. **Postcondiciones** que abortan si el catálogo, las RPC con su `grant`, la columna o el bucket no quedaron como se pidió.
7. Prueba de contrato SQL en PGlite (`.test.sql`) y prueba negativa: Contabilidad, un usuario de otro tenant, un usuario suspendido, un cliente del portal y un acceso extra a `nomina` no pueden enlazar.

Reglas de la foto (UPL-01 y MP-01):

- El selector dice tipo, tamaño máximo (2 MB) y para qué es antes de elegir. Hay botón además de arrastrar. El estado del archivo es visible: subiendo, procesando, lista o falló.
- El servidor vuelve a validar tipo (por contenido, no por extensión), tamaño, tenant y permiso.
- Se reescala a 512 px, se guarda en WebP y **se quitan los metadatos EXIF** (pueden traer ubicación).
- **Reemplazar** o **quitar** la foto borra el archivo anterior (P0 de MP-01: la foto no es evidencia) y deja el evento `photo_set` o `photo_removed`. «Quitar» es destructivo y pide confirmación (BTN-01: Cancelar con el foco, la acción a la derecha).
- Ficha **egresada**: la foto se sigue viendo y no se puede cambiar. Ficha **borrada** (`deleted_at`): el archivo se borra junto con la ficha. El borrado de la ficha se agrega al mapa de borrado.

«Mostrar» la cuenta bancaria (D9): lo hace una RPC solo para Admin y Contabilidad, que devuelve el número completo y en la misma transacción deja `bank_account_revealed`, sin el número. Es el revelado sensible de AUD-02 §3 llevado a Nómina.

En pantalla: «Enlazar con usuario», «Quitar enlace» y la sugerencia por correo (§4), «Subir foto», «Cambiar» y «Quitar», y «Mostrar» la cuenta. La foto sale en la cabecera de la ficha y en la fila de Empleados. Si sale o no en el resto del Studio, lo decide D4.

**Puertas:** aplicar la 0555 en producción con OK nominal de Sam y el runbook. Crear el bucket va en la misma migración.

### F3 — Registro propio de inicios de sesión (migración nueva, la asigna el DG)

- Tabla `studio_login_events`: `id, tenant_id, user_id, occurred_at, result ('ok', 'fallido'), method ('password', 'invitacion'), ip text, ua_browser text, ua_os text, ua_device text, minimized_at timestamptz`. Sin correo, sin contraseña y sin el user agent crudo: se guarda resumido (navegador, sistema, tipo de equipo). El Studio no tiene magic link (`app/studio/(auth)/login/actions.ts:45`): ese método no entra.
- La escribe el servidor en dos lugares, con `getRequestIp()` y una función append-only estrecha (AUD-02 §7; nada de `insert` crudo):
  - `app/studio/(auth)/login/actions.ts`, después de `signInWithPassword`, solo si la persona es miembro de Studio;
  - el acceso por invitación (`app/invitar/[token]/actions.ts:129`).
- **No** se registra la reconfirmación de contraseña de `lib/db/password-confirmed.ts:70`: es un segundo factor dentro de una sesión abierta, no un inicio de sesión.
- Si escribir falla, el login sigue: es evidencia, no control.
- Intentos fallidos (D7): solo cuando el correo es de un miembro de Studio del tenant. Si no lo es, no se guarda nada: no se guardan correos tecleados. Para que la pantalla no delate qué correos existen, la escritura se hace **después de responder** (`after()` de Next), así el tiempo de respuesta es el mismo exista o no el correo. El mensaje de error sigue siendo el mismo de hoy. Queda un límite de ritmo por IP (huella SHA-256, como `portal_registro_throttle`) para que no se pueda tantear correos a ritmo alto.
- RLS: sin acceso directo para `anon` ni `authenticated`. Se lee por una RPC solo de admin, con paginación por cursor y límite (AUD-02 §4 y §7).
- Ver los inicios de sesión de otra persona es una consulta de datos personales (AUD-01 §2, AUD-02): cada vez que el admin abre la pestaña queda `login_events_viewed`, sin las IP.
- **Retención (D6), dentro de AUD-02.** Es un dato de seguridad, de clase A en AUD-02 §5. El calendario aprobado `docs/legal/retention-schedule-v1.md` §3 le da a la clase `security` **2 años** desde `occurred_at`, «por investigación de incidentes y control de acceso». Pero hoy su alcance es solo `entity_audit_log`, y AUD-02 §5 dice que **nada se purga solo** sin un calendario con fundamento. Por eso la F3 no corre con un cron propio. Hace dos cosas:
  1. **Enmienda del calendario a v1.1**, con aprobación de Sam registrada y revisión del abogado: incluye `studio_login_events` en la clase `security`, 2 años, con **minimización escalonada** a los 90 días. Esa minimización vacía `ip` y `ua_*` y marca `minimized_at`; quedan fecha, resultado y método.
  2. **Ejecución con el mismo control que la E5** (AUD-02 §8; `0304_audit_retention_batches.sql`): la minimización y la purga a 2 años corren como **lote** con dry-run, conteo y hash, aprobado por un segundo actor y revalidado al ejecutar. Respetan un hold de `0301`. Dejan un evento de lote sin valores.

  Mientras la enmienda no esté aprobada, la tabla **se conserva sin purga**, que es el default seguro de AUD-02 §5. La F3 puede salir igual.
- **Medir antes de construir**, en el stack local: qué IP y qué agente llegan a la action detrás de Traefik, y qué guarda `auth.audit_log_entries` en v2.197. Si hay Cloudflare delante, la IP será la del borde mientras el borde no cambie; la pestaña lo dice («IP del borde») en vez de mostrar una IP falsa como real. Esta SDD no toca el borde.
- Prueba: login correcto deja una fila; login sin membresía de Studio no deja fila de Studio; Contabilidad recibe `42501` al leer; la purga vacía IP y agente.

### F4 — «Lo que hizo» (migración nueva, la asigna el DG)

- Nueva versión de `audit_list_events` con `p_actor_id uuid default null`: el mismo contrato de 0398, solo admin, filtro por actor aplicado después de autorizar y antes de serializar (AUD-02 §4).
- La firma cambia: la migración hace `drop function` de la firma vieja de 11 parámetros (`0398:63-75`) antes de crear la nueva, y repite el `revoke` y el `grant execute … to authenticated`. Si convivieran dos firmas con valores por defecto, PostgREST no sabría a cuál llamar. `listGovernedAuditEvents` y `/studio/admin` se actualizan en la misma PR.
- El índice `(tenant_id, actor_id, occurred_at desc)` se crea si el plan de consulta lo pide.
- La pestaña «Lo que hizo» usa `listGovernedAuditEvents` con `actorId` y la misma presentación del visor de `/studio/admin`: resumen permitido, payload oculto.
- Cubre solo lo auditado (AUD-01): cambios, no páginas vistas. La pestaña lo dice. Registrar navegación queda fuera (D8).

### F5 — Historial de la ficha y alta con acceso

- Auditar en Nómina los cambios de sueldo, banco, estado, puesto y enlace, con antes y después de los campos no sensibles y solo «cambió» para la cuenta bancaria (AUD-01 §5, PII por identificador). Salen en la Línea de tiempo.
- «Dar acceso» desde la ficha de un empleado sin usuario: invitación con `employee_id` (§4, punto 4). Retira el relleno por correo del accept.
- `ensureEmployeeAuthUser` deja de reutilizar cuentas por correo (§4, punto 6). Agrega «Reenlazar su cuenta de empleado», que se niega con `client_users`. Pruebas: un correo de cliente del portal, un correo de usuario del Studio y más de 200 usuarios en Auth.
- Migración propia, la asigna el DG.

## 7. Lista exacta de archivos por fase

### F1

| Archivo | Cambio |
|---|---|
| `lib/studio/nomina/employee-queries.ts` | `auth_user_id` en `EMPLOYEE_COLUMNS`; `getEmployeeByCode` |
| `lib/studio/nomina/employee-types.ts` | `auth_user_id` en `Employee` |
| `lib/studio/nomina/ficha-empleado.ts` | Nuevo. Reglas puras: línea de tiempo, correo a mostrar, KPIs, máscara de cuenta |
| `lib/studio/nomina/ficha-empleado-queries.ts` | Nuevo. Lee préstamos, asistencia, amonestaciones, recibos, finiquito y comunicaciones de un `employee_id` |
| `app/studio/(app)/nomina/empleados/[codigo]/page.tsx` | Nuevo |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/FichaEmpleado*.tsx` | Nuevos (cabecera, columnas, pestañas) |
| `app/studio/(app)/nomina/_components/NominaClient.tsx` | Fila con correo y enlace a la ficha |
| `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx` | «Ver ficha de empleado» |
| `app/studio/(app)/usuarios/page.tsx` | Pasar el código de la ficha enlazada |
| `app/studio/studio.css` | Solo si la grilla de la 0650 no alcanza |
| `lib/studio/nomina/__tests__/ficha-empleado.test.ts` | Nuevo |
| `app/studio/(app)/nomina/empleados/__tests__/ficha-empleado-page.test.tsx` | Nuevo: 404, Contabilidad sin correo de login ni pestañas de admin, sin usuario |
| `docs/specs/0652-ficha-empleado-360/spec.md` | Estado y aceptación |
| `.agents/handoffs/sdd-0652-ficha-empleado-360.md` | Handoff |

### F2

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0555_nomina_enlace_usuario_y_foto.sql` | Nuevo (§F2) |
| `supabase/tests/0555_nomina_enlace_usuario_y_foto.test.sql` | Nuevo, contrato en PGlite (misma carpeta que `0551`-`0553`) |
| `app/studio/(app)/nomina/empleados/[codigo]/actions.ts` | Nuevo: enlazar, quitar enlace, subir y quitar foto, mostrar la cuenta |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/*` | Enlace, sugerencia y foto |
| `lib/studio/nomina/employee-photo.ts` | Nuevo: validación, reescalado y limpieza de EXIF |
| `app/studio/(app)/nomina/_components/NominaClient.tsx` | Foto en la fila |
| `lib/studio/nomina/__tests__/*` | Pruebas nuevas |
| `docs/legal/privacidad/registro-tratamiento.md` | Filas de la foto |
| `docs/legal/privacidad/mapa-de-borrado.md` | Borrado de la foto |

F3, F4 y F5 fijan su lista al asignarse, con su número de migración.

## 8. Decisiones para Sam

| ID | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| D1 | ¿Cómo se une una ficha de empleado con su usuario? | (a) Con la columna que ya existe (`auth_user_id`), por decisión explícita de un admin con motivo y auditoría, y solo con miembros de Studio; el correo igual solo **sugiere**. (b) Seguir enlazando por coincidencia de correo. (c) Una tabla de uniones nueva | **(a)**: ya existe y es única por persona. (b) falla cuando el correo de la ficha es otro o está vacío, y hoy puede enlazar a un cliente del portal (§3.3) |
| D2 | Al dar acceso a un empleado nuevo o aprobar una solicitud, ¿cómo se enlaza? | (a) La invitación lleva el id de la ficha, y aprobar una solicitud nunca reutiliza una cuenta que ya existe (F5, §4 punto 6). (b) Como hoy: por correo al aceptar, y reutilizando la cuenta del correo al aprobar | **(a)**: cierra el caso del cliente del portal que abre `/m/emp` |
| D3 | Una persona enlazada, ¿entra también a la app del empleado (`/m/emp`) a ver sus recibos? | (a) Sí, es su propia información. (b) No: solo el Studio | **(a)**. Ojo: hoy enlazar ya lo hace automático |
| D4 | ¿Quién ve la foto? | (a) Solo quien ve Nómina (Admin y Contabilidad), en la ficha y la lista. (b) Además, como avatar en todo el Studio (todo el equipo) | **(a)** por ahora. (b) cuando el propio empleado la suba desde su app, que es su consentimiento |
| D5 | ¿Quién sube la foto? | (a) Admin y Contabilidad. (b) Solo admin. (c) También el empleado desde `/m/emp` | **(a)**, con (c) más adelante |
| D6 | ¿Cuánto se guardan los inicios de sesión? Es un dato de seguridad: AUD-02 no deja purgarlo solo, sin un calendario aprobado. | (a) Enmendar el calendario de retención a v1.1: clase `security`, 2 años como el resto de los eventos de seguridad, con IP y navegador vaciados a los 90 días. Todo por lote controlado, con segundo actor, y revisado por el abogado. (b) Clase `security`, 2 años, sin vaciar antes la IP. (c) No enmendar: se guarda sin purga hasta que haya calendario | **(a)**: es el plazo que ya aprobaste para seguridad, y la IP no se guarda más de lo que hace falta para revisar un incidente. Mientras no se apruebe, rige (c) |
| D7 | ¿Se registran los intentos fallidos? | (a) Sí, solo de correos que son usuarios del Studio, sin delatar qué correos existen (mismo tiempo y mismo mensaje) y con límite de ritmo. (b) No, solo los que entraron | **(a)**: un intento fallido es lo que avisa de un ataque |
| D8 | ¿«Lo que hizo» incluye las páginas que visitó? | (a) No: solo lo que cambió (lo auditado). (b) Sí, también lo que vio | **(a)**: vigilar la navegación es desproporcionado y pesa mucho |
| D9 | ¿Se ve la cuenta bancaria completa en la ficha? | (a) Enmascarada (últimos 4). «Mostrar» la abre y queda registrado quién la vio. (b) Completa, como hoy en el formulario | **(a)**. Pregunta aparte: ¿«Mostrar» pide motivo? Recomiendo que no: Contabilidad la ve para pagar todos los meses, y el registro ya dice quién y cuándo |
| D10 | Contabilidad abre la ficha. ¿Qué ve del acceso? | (a) Solo «Tiene acceso» o «Sin acceso». (b) También rol y último ingreso | **(a)**: Sam pidió logins y seguimiento solo para admin |
| D11 | ¿En qué orden se construye? | (a) F1 → F2 → F3 → F4 → F5. (b) Adelantar F3 (inicios de sesión) antes de F2 | **(a)**: F1 resuelve ya el correo y la entrada; F3 necesita su medida primero |
| D12 | ¿Hay que avisar al equipo que se registran sus inicios de sesión? | (a) Sí: una línea en la pantalla de login del Studio y un párrafo en el aviso interno, revisado por el abogado. (b) No | **(a)**: es lo que la persona espera saber de su propio dato |
| D13 | Cuando el correo de varias fichas coincide con el de un usuario, ¿cómo se confirman los enlaces? | (a) Uno por uno, desde cada ficha, con su motivo. (b) En lote: una lista con todas las coincidencias exactas, marcas las que sí y un solo motivo; queda un evento por enlace | **(b)** para la primera vez, porque hoy casi todo el equipo tiene usuario. Después, (a) |

## 9. Datos personales (`revisar-datos-ve`)

Alcance: Venezuela (CRBV arts. 28 y 60) para todo el equipo. **China (PIPL art. 3):** si se registran los inicios de sesión de personas del equipo que trabajan desde China, puede aplicar el supuesto extraterritorial (analizar el comportamiento de personas en China). Pregunta para el abogado; esta SDD no lo resuelve.

### 9.1 Inventario de lo que agrega

| Dato | Qué es | Finalidad | Dónde vive | Quién lo ve | Conservación | Estado |
|---|---|---|---|---|---|---|
| `nomina_employees.photo_path` + archivo | Foto de la persona (imagen, CRBV art. 60) | Reconocer a la persona en la ficha | Bucket privado propio, URL firmada | Admin y Contabilidad (D4) | Mientras la ficha viva; se borra al reemplazarla o al borrar la ficha | Diseño §F2 |
| `nomina_employees.auth_user_id` (ya existe) | Unión ficha ↔ usuario | Ver acceso y actividad en la ficha | Supabase propio, RLS de Nómina | Admin y Contabilidad | Igual que la ficha | CORRECTO en esquema (`0181:37-46`) |
| `studio_login_events.ip` | IP del inicio de sesión | Seguridad del acceso | Supabase propio, sin acceso directo | Solo admin | Vaciada a los 90 días si se aprueba la enmienda v1.1 (D6); hasta entonces, sin purga | Diseño §F3 |
| `studio_login_events.ua_*` | Navegador, sistema y tipo de equipo, resumidos | Reconocer un equipo extraño | Igual | Solo admin | Igual que la IP | Diseño §F3 |
| `studio_login_events.occurred_at`, `result`, `method` | Cuándo y cómo entró | Seguridad y seguimiento | Igual | Solo admin | Clase `security`, 2 años, por lote controlado (D6) | Diseño §F3 |
| Eventos de `entity_audit_log` del actor (ya existen) | Lo que cambió en el sistema | Seguimiento | Supabase propio | Solo admin (`audit_list_events`) | El calendario v1.0 según el `domain_code` | CORRECTO el acceso (`0398:105-120`) |
| Eventos nuevos (`user_linked`, `photo_set`, `bank_account_revealed`, `login_events_viewed`) | Quién hizo qué sobre la ficha, sin el dato | Trazabilidad (AUD-01) | `entity_audit_log` | Solo admin | Clase `security`, 2 años (§F2, tabla del catálogo) | Diseño §F2 y §F3 |
| Correo de login | Dato de `auth.users` | Reconocer a la persona | Ya existe | Solo admin en la ficha (D10) | La de Auth | Diseño §F1 |

### 9.2 Hallazgos

| # | Estado | Qué | Evidencia | Arreglo |
|---|---|---|---|---|
| H1 | ENCONTRADO | `nomina_employees` no tiene plazo de conservación en el registro | `docs/legal/privacidad/registro-tratamiento.md:55` | Fuera de esta SDD: lo fija Sam con el abogado (obligación laboral) |
| H2 | ENCONTRADO | La foto del candidato (`nomina_employee_registrations.photo_path`) existe sin escritor y con conservación indefinida | `0180:90`; `registro-tratamiento.md:56` | Fuera de alcance: no se reutiliza esa columna para la foto de perfil |
| H3 | ENCONTRADO | Los cambios de sueldo y banco no dejan rastro | §2.1 | F5 |
| H4 | NO VERIFICABLE | Qué IP y qué agente guarda GoTrue v2.197 en `auth.audit_log_entries` y `auth.sessions` en el VPS, y su retención | Necesita el stack local; producción no se lee | Medir en F3 en local |
| H5 | NO VERIFICABLE | Si la IP que llega al Studio es la de la persona o la del borde de Cloudflare | `infra/dtd-cargo/compose.yml:64-67` | Medir en F3; no se toca el borde |
| H6 | CORRECTO | Los datos de red y de auditoría no viajan a staging | `infra/ops/migrate/import-from-cloud.sh:78-87` | — |
| H7 | NO VERIFICABLE | Si el equipo fue informado de que se registran sus inicios de sesión | No hay aviso en el repo | D12 |
| H8 | NO VERIFICABLE | Base de licitud para registrar inicios de sesión del trabajador y su foto, y el fundamento de la enmienda v1.1 del calendario (D6) | — | Abogado |
| H9 | ENCONTRADO | Aprobar una solicitud reutiliza por correo una cuenta de Auth sin mirar `client_users`: un cliente del portal puede quedar enlazado a una ficha y abrir sus recibos en `/m/emp` | `app/studio/(app)/nomina/actions.ts:1902-1927`; `0181:48-62`; `app/m/emp/page.tsx:30` | F5 (§4 punto 6, D2) y el conteo con OK de §12 |
| H10 | ENCONTRADO | La ficha muestra hoy la cuenta bancaria completa en el formulario, sin registro de quién la vio | `EmpleadoDrawer.tsx` (campo «Número de cuenta», :272-280) | F1 enmascara en la ficha; «Mostrar» con evento en F2 (D9). El formulario de edición queda como está |

### 9.3 Reglas que la implementación cumple

- La foto se limpia de EXIF (puede traer la ubicación). Sin geolocalización en ningún dato nuevo.
- No se guardan correos tecleados en intentos fallidos, ni el user agent crudo, ni contraseñas.
- Las pestañas y los datos solo de admin se cortan en el servidor y en la RPC, no con CSS.
- Nada de esto sale a terceros: Studio y Supabase corren en el servidor propio (`docs/runbooks/servidor-contabo.md`). No hay IA.
- En Git van roles, nunca nombres del equipo, fotos ni datos reales.

Esto no es asesoría legal. Conviene que otro modelo revise este mismo análisis.

## 10. Gobernanza (AGENT-BRIEF, paso 4)

Clasificación de cada política aplicable, según lo que propone esta spec. La implementación de cada fase la vuelve a revisar contra el código.

| Política | Dónde toca | Clasificación | Cómo |
|---|---|---|---|
| AUD-01 | Enlazar, quitar enlace, foto, «Mostrar» la cuenta, ver inicios de sesión, cambios de la ficha | **Cumplimiento** propuesto | Evento en la misma transacción, con tipo del catálogo y motivo donde cambia el acceso (§F2, §F3, §F5) |
| AUD-01 (estado actual) | Cambios de sueldo, banco y estado de la ficha | **No conformidad** hoy | Sin evento (§2.1). La cierra la F5 |
| AUD-02 | Inicios de sesión y «lo que hizo» | **Cumplimiento** propuesto | Solo admin, RPC con cursor y límite, sin acceso directo, consulta auditada, filtro por actor (§F3, §F4) |
| AUD-02 §5 y §8 | Retención de `studio_login_events` | **Excepción pendiente** hasta que Sam apruebe la enmienda v1.1 del calendario (D6). Mientras tanto, cumple el default: sin purga | §F3, retención |
| AUD-02 §4 (estado actual) | `audit_list_events` sin filtro por actor | **No conformidad** hoy | La cierra la F4 |
| UPL-01 | Subida de la foto | **Cumplimiento** propuesto | Tipo, tamaño y propósito antes de elegir; botón además de arrastrar; validación en el servidor; ruta por tenant y entidad; URL firmada; EXIF quitado (§F2) |
| MP-01 | Reemplazar o quitar la foto; quitar el enlace | **Cumplimiento** propuesto | Foto: P0 con evento (no es evidencia). Enlace: se quita con motivo y evento, y la ficha y el usuario quedan (P1 del vínculo). La ficha de empleado sigue con su P2 actual (`deleted_at`) |
| BTN-01 | Fila de Empleados; «Quitar foto»; «Quitar enlace» | **Cumplimiento** propuesto | El nombre es `<a href>`, los controles son `<button type="button">`; sin `div` clicable; las acciones destructivas en `danger`, con Cancelar enfocado (§F1, §F2) |
| TBL-01 | Fila con enlace y dos botones | **Cumplimiento** propuesto | Las acciones no cambian de lugar según el estado: el hueco del interruptor queda reservado para egresados. En el teléfono, lista y detalle |
| A11Y-01 | Pestañas, enlace de la fila, selector de usuario, carga de la foto | **Cumplimiento** propuesto | `.studio-tabs` con rol y teclado (SDD-0603), nombre accesible del enlace, foco visible, foto con texto alternativo, sin depender del arrastre |
| SGE-00 | Toda la SDD | **Cumplimiento** | SDD con allowlist exacta por fase (§7) |
| FRM-01, ERR-01, LOD-01 | Selector de enlace, motivo, carga de la foto, pestañas que cargan aparte | **Cumplimiento** propuesto | Estados de carga, vacío y error en cada pestaña; motivo con su error en el campo |
| CMP-01 | Componentes | **No aplica** en F1 (solo componentes existentes). Si una fase crea uno nuevo, pasa por el registro | — |
| IA-01 | — | **No aplica**: no hay IA | — |

## 11. Aceptación

### F1

- [ ] La fila de Empleados muestra el correo. El nombre es un enlace `<a href>` a la ficha; el interruptor y el lápiz siguen funcionando como botones y no cambian de lugar.
- [ ] `/studio/nomina/empleados/EMP-NNNN` muestra cabecera, KPIs, columnas y pestañas de §5 con los datos de esa persona, con la cuenta bancaria enmascarada.
- [ ] Código inexistente, borrado o de otro tenant: 404. Acceso extra a `nomina` sin rol `admin` ni `accounting`: 404.
- [ ] La Línea de tiempo incluye la anulación de un finiquito (`payroll_settlement_voided`).
- [ ] Sin `nomina`: redirige como hoy `requireModuleView`.
- [ ] Contabilidad no recibe el correo de login ni las pestañas de admin (prueba de la página sobre el HTML del servidor).
- [ ] Sin usuario enlazado: «Sin acceso al sistema», sin pestañas vacías.
- [ ] Desde la ficha de usuario, «Ver ficha de empleado» cuando está enlazada.
- [ ] Tres columnas, dos y una por ancho, como la 0650.
- [ ] CI de la PR en verde.

### F2

- [ ] La 0555 aborta en su preflight si falta el catálogo, la FK o `auth_user_id`, si ya existen `photo_path` o el bucket, o si un tipo del catálogo existe con otro dominio. Corre con `lock_timeout` y `statement_timeout`.
- [ ] Los tres tipos de F2 quedan en `audit_entity_types` con su `domain_code` (§F2, tabla) y las postcondiciones lo comprueban.
- [ ] Las RPC tienen `revoke` a `public` y `anon` y `grant execute` a `authenticated`; el bucket es privado, con `file_size_limit` de 2 MB y `allowed_mime_types` de imagen.
- [ ] Enlazar y quitar enlace exigen admin y motivo, y dejan un evento en la misma transacción.
- [ ] Contabilidad, otro tenant, un usuario suspendido, un cliente del portal y un acceso extra a `nomina` reciben error (prueba negativa en PGlite).
- [ ] La sugerencia por correo no enlaza sola; el lote de D13 deja un evento por enlace.
- [ ] La foto se sube, se reescala, pierde EXIF y se firma en el servidor; reemplazarla o quitarla borra el archivo y deja su evento. En una ficha egresada no se puede cambiar.
- [ ] «Mostrar» la cuenta deja `bank_account_revealed` sin el número.

F3, F4 y F5 fijan su aceptación al asignarse, con lo escrito en §6.

## 12. Fuera de alcance

- Leer filas de producción. Hay tres conteos útiles, todos sin nombres y cada uno con su OK nominal: cuántas fichas tienen `auth_user_id`, cuántas tienen correo y cuántas tienen un `auth_user_id` que también está en `client_users` (H9).
- Cambiar el borde o Cloudflare para mejorar la IP.
- Empleados sin acceso al sistema a gran escala (bodegueros, choferes): §4.1 lo deja previsto, la carga masiva es otra SDD.
- El plazo de conservación de la ficha de nómina (H1) y la foto del candidato (H2).
- Rediseñar las otras pestañas de Nómina.
