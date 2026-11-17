---
sdd: "0652"
title: "Ficha 360° del empleado en el Studio: datos, nómina, acceso, inicios de sesión y lo que hizo"
status: in-progress
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-17
supersedes: null
superseded_by: null
related: ["0103", "0113", "0136", "0140", "0166", "0174", "0201", "0273", "0274", "0275", "0293", "0505", "0600", "0622", "0635", "0650"]
confidencialidad: interno
---

# SDD-0652 — Ficha 360° del empleado en el Studio

> Quien abre a una persona del equipo en Nómina ve en una sola página quién es, cuánto gana y qué debe, si tiene acceso al sistema, cuándo entró y qué hizo, con enlaces para profundizar. Toma la estructura de la ficha 360° del cliente (SDD-0650).
> **Decisiones aprobadas por Sam el 2026-11-17** (§8). La F1 está en `main` (PR #632). La F2 está implementada en su PR, con la migración 0555 **en espera** (aplicarla exige el OK nominal de Sam). F3 a F5 esperan su asignación.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Medido en `main` `26a9a911e` (2026-11-16). Las líneas citadas se vencen si alguien edita arriba: copia el nombre de la función o del bloque al buscar.
> **Revisiones incorporadas.** (1) DG sobre `18441e8b7`, CHANGES REQUESTED: catálogo de auditoría, retención dentro de AUD-02, preflight de la 0555, `ensureEmployeeAuthUser`, finiquitos auditados, gobernanza. (2) DG sobre `8dcb53734`, APPROVED con ajustes menores. (3) Codex sobre `8dcb53734`, solo lectura: control de rol en el servidor, datos sensibles que ya viajan al navegador, identidad antes que todo, tres clases de inicio de sesión, «lo que hizo» acotado, foto sin P0, estados con causa y orden de fases. Cada punto se verificó en el código antes de adoptarlo.

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
| La RLS deja leer y escribir a `admin` y `accounting` (`nomina_can_access`) y filtra por `tenant_id = get_user_tenant_id()` | `0160_nomina_employees.sql:71-85`, `:136-147` | C |
| `nomina_can_access()` **no mira el tenant**: devuelve verdadero si la persona es `admin` o `accounting` activo en **cualquier** tenant. El tenant lo pone solo la policy | `0160_nomina_employees.sql:78-84` | C |
| **Ya existe el enlace al usuario:** `nomina_employees.auth_user_id` (FK a `auth.users`), único por usuario vivo | `supabase/migrations/0181_employee_comms.sql:37-46` | C |
| Ese enlace abre la app del empleado `/m/emp`: `get_employee_id_for_user()` devuelve la ficha del `auth.uid()` si no está borrada ni egresada. **No mira `user_tenants`**: suspender a la persona en el Studio no le corta `/m/emp` | `0181_employee_comms.sql:48-62`; `app/m/emp/page.tsx:6`, `:30` | C |
| Hay una policy de **lectura propia**: cualquier usuario autenticado lee su propia ficha si está enlazado, tenga el rol que tenga | `0181_employee_comms.sql:77-82` (`nomina_employees self read`) | C |
| `position_id` enlaza con el puesto (SDD-0140) | `supabase/migrations/0205_nomina_employee_position.sql:17-21` | C |
| Hay tablas por empleado: asistencia, préstamos y cuotas, amonestaciones, corridas y líneas de nómina, finiquitos (con estado `anulado`), comunicaciones, cambios de banco | `0163:25`, `0164:21,44`, `0171:21`, `0175:39,102`, `0179:93,116-117,203`, `0181:117`, `0182:112` | C |
| La pantalla es `/studio/nomina` con 11 pestañas; «Empleados» es la primera | `app/studio/(app)/nomina/_components/NominaClient.tsx` (`TABS`, :115) | C |
| La fila del empleado muestra iniciales, nombre, código, cargo, departamento, sueldo y estado. **No muestra el correo.** La fila no navega: sus dos controles son el interruptor activo/inactivo (`StatusToggle`, oculto para egresados) y el lápiz que abre el formulario de edición | `NominaClient.tsx` (`EMP_COLS` :580, `EmpleadoRow` :636, `StatusToggle` :712, lápiz :722) | C |
| **La lista ya manda al navegador la cédula, el sueldo y la cuenta bancaria completa de todo el equipo.** `listEmployees` lee `EMPLOYEE_COLUMNS` (con `national_id`, `salary_usd`, `bank_account`) y la página se lo pasa entero a `NominaClient`, un componente de cliente. El formulario lo recibe de ahí | `lib/studio/nomina/employee-queries.ts:13-17`, `:27-45`; `app/studio/(app)/nomina/page.tsx:67`, `:116-117`; `EmpleadoDrawer.tsx:272-280` | C |
| Un error de lectura se convierte en ausencia: `listEmployees` devuelve `[]` y `getEmployee` devuelve `null` | `employee-queries.ts:39-42`, `:59-62` | C |
| El correo solo aparece como campo del formulario de edición | `EmpleadoDrawer.tsx:219-226` | C |
| **No hay ruta de detalle:** no existe `app/studio/(app)/nomina/empleados/` ni otra página por empleado | `find app/studio/(app)/nomina` (solo `page.tsx` y `finiquito/[id]`) | C |
| La consulta de empleados **no trae `auth_user_id`** | `employee-queries.ts:13-17` | C |
| El Norte sí dibuja un **Expediente** por empleado: KPIs, ficha, banco, documentos y línea de tiempo. El Studio nunca lo portó | `docs/design/studio/_norte/erp/modules/nomina.jsx` (`ExpedienteView`, :1476); `docs/design/studio/_norte/HANDOFF-NOMINA.md:16` | D |
| **La ficha del empleado no deja eventos** en `entity_audit_log`: no hay tipo de entidad de empleado en el catálogo ni escrituras desde `nomina/actions.ts`. Un cambio de sueldo, banco o estado solo mueve `updated_at` | `grep nomina_employee` en `supabase/migrations`; `grep entity_audit_log` en `nomina/actions.ts` (sin resultados) | C |
| Lo que sí se audita en Nómina es la **anulación de finiquitos**: tipo `payroll_settlement` (dominio `finance`), evento `payroll_settlement_voided`, por `void_payroll_settlement_governed` | `supabase/migrations/0316_nomina_settlement_void_governance.sql:26-32`, `:191`, `:261`, `:320` | C |
| `entity_audit_log.entity_type` **ya no tiene CHECK**: desde la 0261 es una FK al catálogo `public.audit_entity_types`. Un tipo nuevo se agrega con `insert … on conflict` | `0261_audit_entity_catalog_validate.sql:119-133`; `0538_studio_user_module_grants.sql:292-299`; AUD-01 §3 | C · D |
| Nadie escribe directo en `entity_audit_log`: se revocó el `insert` a `service_role` y el `select` a `authenticated`. Se escribe con `public.append_audit_event` | `0293_audit_d5_residual_and_writer_retirement.sql:528`; `0270_audit_governed_query_rbac.sql:591`; uso en `0538:507` | C |
| El `domain_code` decide la clase de retención: `finance` es `fiscal`; `governance`, `security`, `access`, `integration` y `ai` son `security`; `operations`, `commercial` y `procurement` son `operational` | `0304_audit_retention_batches.sql:68-69`; `docs/legal/retention-schedule-v1.md` §3 | C · D |
| `nomina_employee_registrations.photo_path` (foto del candidato) existe y ningún código la escribe | `0180_employee_invites_registrations.sql:90`; `grep photo_path` en `app` y `lib` | C |

### 2.2 Ficha de usuario (Usuarios)

| Hecho | Fuente | Etiqueta |
|---|---|---|
| La ficha de usuario es un panel lateral con tres pestañas: Perfil, Acceso y Actividad | `app/studio/(app)/usuarios/_components/UserDetailDrawer.tsx:14-17`, `:139-155` | C |
| Muestra y edita el correo (de `auth.users`) | `UserDetailDrawer.tsx:214`; `app/studio/(app)/usuarios/page.tsx:95-129` | C |
| «Actividad» es la línea de tiempo **de lo que se le hizo al acceso** de la persona: extras, rol, almacén, suspensiones. Sale de `entity_audit_log` y `user_role_audit` | `usuarios/_components/acceso/ActividadAcceso.tsx:1-13`; `0201_user_role_audit.sql:16` | C |
| El último ingreso combina `user_tenants.last_login_at` (trigger sobre `auth.sessions`, con falsos negativos medidos) y `auth.users.last_sign_in_at` | `usuarios/page.tsx:96-129`; `0019_users_roles.sql:313-333`; SDD-0275 | C |
| `user_profiles` tiene `avatar_url` (texto), sin subida en el Studio. La leen el dueño y todo miembro activo del tenant | `0019_users_roles.sql:62-71`; `0200_rbac_disabled_enforcement.sql:414-424` | C |
| Ni Usuarios ni `lib/studio/user-queries.ts` mencionan Nómina | `grep -i "nomina\|empleado"` (sin resultados) | C |
| Usuarios es solo de admin; Nómina, de admin y Contabilidad | `lib/studio/rbac.ts:136`, `:152` | C |
| Un **acceso extra** a `nomina` (SDD-0635) pasa la puerta de la página, porque `requireModuleView` mira los extras | `lib/studio/rbac-guard.ts:156-157` | C |
| Con eso, quien tiene el extra ve la lista **vacía** (la RLS de rol lo corta), salvo **su propia ficha** si está enlazado (la policy de lectura propia de 0181) | `0160:136-147`; `0181:77-82` | C · I |

**Por eso la ficha no puede fiarse de `requireModuleView` ni de la RLS para decidir quién la ve.** En esta spec, **«admin»** y **«Contabilidad»** son el rol `admin` o `accounting` en `user_tenants`, con `disabled_at is null`, **en el mismo tenant de la ficha**, comprobado en el servidor antes de leer nada (el patrón de `audit_list_events`, `0398_audit_comment_action_summary.sql:105-120`). No son «tiene el módulo visible», ni un acceso extra, ni la lectura propia.

### 2.3 Dónde vive hoy «el seguimiento»

| Hecho | Fuente | Etiqueta |
|---|---|---|
| `entity_audit_log` tiene `actor_type` y `actor_id` | `0066_foundation_v3.sql:64-80` | C |
| El visor gobernado es la RPC `audit_list_events`, solo para admin de un único tenant, en `/studio/admin`. Ordena y pagina por `(occurred_at, id)` | `0398_audit_comment_action_summary.sql:63-120`; `lib/studio/audit-queries.ts:169-188`; `app/studio/(app)/admin/page.tsx:57` | C |
| **La RPC no filtra por `actor_id`**, aunque AUD-02 §4 lo pide | `0398:63-75`, `:288-300`; `aud-02.md` §4 | C · D |
| Hoy **no hay ninguna pantalla con «lo que hizo esta persona»**. Lo que Sam llama «el seguimiento que antes solo teníamos en usuario» es la pestaña Actividad: lo que se le hizo a su acceso | §2.2 | I |
| AUD-01 audita mutaciones, no lecturas rutinarias: «lo que hizo» cubre cambios auditados, no las páginas que vio | `aud-01.md:20-34` | D |

### 2.4 Inicios de sesión

| Hecho | Fuente | Etiqueta |
|---|---|---|
| No hay tabla propia de inicios de sesión. Solo la fecha del último | §2.2; `grep login_events\|sign_in_events` (sin resultados) | C |
| GoTrue es `supabase/gotrue:v2.197.0` | `infra/dtd-cargo/compose.supabase.yml:176` | C |
| GoTrue guarda `auth.audit_log_entries` y `auth.sessions`; el repo las trata como datos de red con IP | `docs/legal/privacidad/revision-traslado-contabo-2026-10-09.md:47`; `infra/ops/migrate/import-from-cloud.sh:78-87` | D |
| Qué columnas y qué IP tienen en esta versión | — | NV: medir en local, nunca en producción |
| **El login del Studio es una server action** (`signInWithPassword` desde Next.js) | `app/studio/(auth)/login/actions.ts:45` | C |
| Después de autenticar, la action comprueba la **membresía de Studio** (`user_tenants` activo); sin ella, manda al portal o rechaza | `login/actions.ts:58-80` | C |
| Por eso GoTrue vería la IP del servidor de Next, no la de la persona | — | I, se mide en F4 |
| `auth.sessions` se borra al cerrar sesión o vencer: no es un historial | — | I |
| `getRequestIp()` toma la IP del header que fija el proxy (`REQUEST_IP_HEADER`, hoy `x-real-ip` de Traefik) | `lib/http/request-ip.ts:1-40`, `:74`, `:109`; `infra/dtd-cargo/compose.yml:64-67` | C |
| Detrás de Cloudflare, `x-real-ip` sería la IP del borde. Esta SDD no toca el borde | `lib/http/request-ip.ts` | D · NV |

## 3. Respuestas directas

### 3.1 ¿Por qué la ficha no muestra el correo?

1. **La fila no lo pinta.** Solo se ve en el formulario de edición (`EmpleadoDrawer.tsx:219-226`).
2. **El correo de contacto de la ficha y el correo con que la persona entra son datos distintos.** `nomina_employees.email` se teclea en Nómina; el de acceso vive en `auth.users` (`usuarios/page.tsx:95-129`). Si la ficha se creó sin correo, está vacío aunque la persona tenga usuario (I).
3. **La ficha no sabe cuál es su usuario:** la consulta no trae `auth_user_id` (`employee-queries.ts:13-17`).

### 3.2 ¿Por qué no se puede entrar al detalle del empleado?

Porque **no existe**. El Studio hizo la lista y el formulario, no el Expediente del Norte (`nomina.jsx:1476`). La fila no navega: solo tiene el interruptor y el lápiz (`NominaClient.tsx:712`, `:722`). Lo de cada empleado vive repartido en las pestañas de Nómina.

### 3.3 ¿Por qué «el perfil de nómina es el mismo que el de usuario» no se nota en el sistema?

El enlace existe (`auth_user_id`, 0181), pero solo se llena por dos caminos:

- al **aprobar una solicitud** de alta, con `ensureEmployeeAuthUser` (`app/studio/(app)/nomina/actions.ts:1891-1927`);
- al **aceptar una invitación**, si el correo de la ficha coincide exactamente (`app/invitar/[token]/actions.ts:151-180`, SDD-0600).

**Lo que hace de verdad `ensureEmployeeAuthUser`** (C):

1. Intenta crear un `auth.users` nuevo con el correo de la solicitud, ya confirmado (`:1895-1900`).
2. Si el correo ya existe, **reutiliza ese usuario** (`:1902-1927`). Solo lo rechaza si está enlazado a otra ficha viva (`:1912-1918`) o si es miembro de `user_tenants` (`:1920-1924`).
3. **No mira `client_users`.** Un cliente del portal con ese correo queda enlazado y abre `/m/emp` con los recibos, comunicaciones y contacto de esa ficha (`0181:48-62`; `app/m/emp/page.tsx:30`).
4. **Ignora los errores de sus comprobaciones.** Lee `data` sin mirar `error` en `listUsers`, en la búsqueda de la ficha enlazada y en el conteo de `user_tenants` (`:1908-1924`). Si la búsqueda de la ficha o el conteo fallan, el resultado vacío se lee como «no está tomado» y **reutiliza la cuenta**: falla abierto.
5. Busca solo en la **primera página de 200 usuarios** (`:1910`). Con más de 200 no encuentra y deja la ficha sin acceso (ahí falla cerrado).

El caso de los puntos 3 y 4 pide una solicitud aprobada con el correo de otra persona: por error de tipeo o porque alguien escribió un correo ajeno en el formulario público de alta. Como el Studio no muestra el enlace (§2.1), nadie lo notaría. **Se corrige en la F2, antes de construir el enlace manual** (§4, punto 6), no al final.

Una persona que ya era usuaria del Studio antes de tener ficha, o cuya ficha tiene otro correo o ninguno, queda **sin enlace** (I: cuántas son se mide solo con OK, §12).

## 4. Identidad: enlace explícito empleado ↔ usuario

**Propuesta:** se conserva la columna que ya existe, `nomina_employees.auth_user_id`, con su índice único (`0181:43-46`). No hay tabla de uniones. Lo que cambia es **cómo se llena**: por una decisión explícita, nunca por adivinar.

1. **«Enlazar con usuario»** en la ficha, solo admin (§2.2). Selector con los miembros activos de Studio del tenant que no tienen ficha (por `user_id`; el correo de acceso solo para reconocerlos). Pide motivo. Lo hace una RPC (§F2) que:
   - bloquea la fila de la ficha (`select … for update`);
   - **no sobrescribe**: si la ficha ya tiene `auth_user_id`, o el usuario ya está en otra ficha, falla con un error claro;
   - deja que el índice único sea la última defensa: un `23505` se traduce a «Ese usuario ya está enlazado a otra ficha»;
   - deja el evento con `append_audit_event` en la misma transacción.

   Como la RPC es atómica, reintentar no duplica nada: un segundo intento igual falla con «ya enlazado».
2. **«Quitar enlace»**, igual, con motivo. La ficha y el usuario quedan; solo se quita el vínculo.
3. **Sugerencia, no enlace:** si el correo de contacto de la ficha coincide exactamente con el de acceso de un miembro de Studio sin ficha, el admin ve «Este correo es el de [usuario]. ¿Enlazar?». **Solo la ve admin.** La coincidencia propone; enlaza el admin, una por una (D13).
4. **Alta nueva con acceso** (el «dar acceso» de la SDD-0140): la invitación lleva el id de la ficha y al aceptarla se enlaza esa ficha. Reemplaza el relleno por correo del accept (`app/invitar/[token]/actions.ts:151-180`). Necesita guardar `employee_id` en la invitación: F5, con su migración (D2).
5. **Usuario sin ficha** (cuenta externa o de prueba): la ficha de usuario dice «No tiene ficha de empleado» y, para admin, ofrece «Crear ficha» ya enlazada.
6. **Correctivo de `ensureEmployeeAuthUser`, en la F2** (sin migración, va antes o junto con el enlace manual):
   - si el correo no existe en Auth, crea el usuario nuevo como hoy;
   - si ya existe, **no lo reutiliza**: la ficha se crea **sin acceso** y avisa «Ese correo ya tiene una cuenta. Si es la misma persona, enlázala desde la ficha»;
   - cualquier error de sus consultas **aborta** (falla cerrado), no se lee como vacío;
   - la búsqueda por correo deja de depender de la primera página de `listUsers`.

   Si la cuenta solo era de `/m/emp` (un empleado que vuelve), la F2 ofrece «Reenlazar su cuenta de empleado»: la confirma el admin y **se niega si esa cuenta está en `client_users`**. Los enlaces que ya existen no se tocan solos: se cuentan en producción, con OK y sin nombres, los `auth_user_id` que también están en `client_users`, y lo que salga se revisa con Sam uno por uno.

### 4.1 Empleado sin usuario (previsto)

- La ficha funciona entera sin usuario. La zona de acceso dice **«Sin acceso al Studio»** y, para admin, ofrece «Dar acceso» (punto 4) o «Enlazar con usuario» (punto 1).
- Las pestañas «Inicios de sesión» y «Lo que hizo» no aparecen. No se muestran vacías.
- Si el usuario enlazado se suspende en el Studio, la ficha lo dice («Acceso al Studio suspendido»). **Eso no le corta `/m/emp`** (§2.1): D3 decide si debe cortarlo.
- Enlazar a alguien también le abre `/m/emp`, porque `get_employee_id_for_user()` lo resuelve por `auth_user_id` (D3).

## 5. Diseño de la ficha 360°

Ruta propia: **`/studio/nomina/empleados/[codigo]`** con `EMP-NNNN` (no es dato personal). Se entra desde el nombre en la fila de Empleados y desde «Ver ficha de empleado» en la ficha de usuario.

**Depende de la PR #629 (SDD-0650):** reutiliza `.studio-ficha-grid` y sus columnas, que hoy viven solo en esa PR (`app/studio/studio.css`). Si la #629 no se fusionó cuando arranque la F1, la F1 espera o copia la grilla en su propia allowlist y lo dice. También toma de la 0650 la cabecera con acciones que no rebotan, los avisos a todo el ancho y la regla «sin dato, se dice». Componentes: `Avatar`, `Badge`, `Aviso`, `KpiCard`, `EmptyState`, `.studio-tabs` (SDD-0603) y `ActividadAcceso`. Densidad del Studio y solo tokens de `app/studio/tokens.css` (`BRAND.md`, `docs/design/README.md`). La forma sigue el Expediente del Norte (`nomina.jsx:1476`).

### 5.1 Cinco datos que no se mezclan

La cabecera los muestra por separado, cada uno con su nombre, porque hoy se confunden:

| Dato | Qué es | De dónde sale | Quién lo ve |
|---|---|---|---|
| **Correo de contacto** | El de la ficha de nómina | `nomina_employees.email` | Admin y Contabilidad |
| **Correo de acceso** | Con el que entra | `auth.users` del usuario enlazado | Solo admin |
| **Cuenta enlazada** | Si la ficha tiene usuario | `auth_user_id` no nulo | Admin y Contabilidad («Tiene cuenta» o «Sin cuenta») |
| **Acceso al Studio** | Rol, alcance y si está suspendido | `user_tenants` | Solo admin (Contabilidad ve «Con acceso» o «Sin acceso», D10) |
| **Estado laboral** | Activo, inactivo o egresado | `nomina_employees.status` | Admin y Contabilidad |

### 5.2 Zonas

| Zona | Contenido | Quién la ve | Fase |
|---|---|---|---|
| Cabecera | Foto o iniciales, nombre, `EMP-NNNN`, puesto y departamento, los cinco datos de §5.1, teléfono. Acción principal: Editar. Las demás (Registrar préstamo, Amonestación, Generar finiquito) van en un menú secundario, sin peso visual de primaria | Admin y Contabilidad (el correo de acceso, solo admin) | F1. Foto en F2 |
| Avisos | Solicitud de cambio de banco o contacto pendiente; acceso al Studio suspendido. La sugerencia de enlace (§4, punto 3) **solo para admin** | Admin y Contabilidad; sugerencia solo admin | F1. Sugerencia en F2 |
| KPIs | Sueldo mensual (USD), saldo de préstamos, asistencia del mes | Admin y Contabilidad | F1 |
| Columna Datos | Cédula, nacimiento, ingreso, banco y cuenta **enmascarada desde el servidor** (últimos 4), notas. «Mostrar» la cuenta en F2 (D9) | Admin y Contabilidad | F1. «Mostrar» en F2 |
| Columna Nómina | Préstamos y cuotas, recibos recientes, comunicaciones. Amonestaciones y finiquito como bloques compactos, con su cantidad y un enlace, sin destacarlos | Admin y Contabilidad | F1 |
| Columna Acceso | Rol, alcance, último ingreso, estado; «Ver ficha de usuario» | Solo admin | F1 (lectura). Enlazar en F2 |
| Pestaña Resumen | Lo de arriba | — | F1 |
| Pestaña Línea de tiempo | Hechos laborales: ingreso, comunicaciones, préstamos, amonestaciones, recibos, finiquito (con su estado `anulado`). Desde F2, también los eventos de la ficha (§F2) | Admin y Contabilidad | F1. Eventos en F2, cambios en F5 |
| Pestaña Lo que hizo | Eventos donde la persona es el actor | **Solo admin** | F3 |
| Pestaña Inicios de sesión | Accesos al Studio e intentos fallidos, con «Registrado desde [fecha]» | **Solo admin** | F4 |
| Pestaña Acceso | La «Actividad» de hoy (`ActividadAcceso`) | Solo admin | F1 (reuso) |

Por ancho: tres columnas desde 1.441 px; dos, con Acceso abajo, hasta 900 px; una debajo, en este orden: cabecera, avisos, KPIs, Nómina, Datos, Acceso. Para Contabilidad, sin la columna Acceso, dos columnas.

Las zonas y pestañas solo de admin se cortan **en el servidor**: a Contabilidad no le llegan ni el componente ni los datos.

### 5.3 Estados con causa

Cada bloque y cada pestaña distingue, con texto propio:

- **sin movimientos** («No tiene préstamos»);
- **sin historial todavía**, con la fecha desde la que hay registro («Los inicios de sesión se registran desde el [fecha]»; «Los cambios de la ficha se registran desde el [fecha]»);
- **no se pudo cargar**, con «Reintentar» (un error nunca se muestra como «no hay»);
- **sin permiso**: no se dibuja; la zona no aparece.

### 5.4 Navegación y accesibilidad (A11Y-01)

- Volver a Nómina conserva la pestaña, la búsqueda y los filtros de la lista. Los filtros que vayan en la URL no llevan nombres ni correos: solo estado, puesto o departamento (como la SDD-0274).
- Las pestañas se manejan con teclado (flechas, Inicio, Fin), con `aria-selected` y el panel enlazado.
- Al abrir la ficha, el foco va al título. Al cerrar un diálogo, vuelve al botón que lo abrió.
- Se lee bien al 200 % de zoom y a 320 px de ancho, sin desplazamiento horizontal.
- El enlace del nombre se llama «Abrir ficha de [nombre]», con foco visible. La foto lleva texto alternativo.

## 6. Fases

Orden propuesto (D11): **F1** lectura segura → **F2** identidad, revelado y foto → **F3** «lo que hizo» → **F4** inicios de sesión → **F5** historial de la ficha y alta con acceso. La F3 va antes que la F4 porque no necesita tabla nueva ni medida previa, y la identidad va primero porque las demás fases cuelgan de ella.

### F1 — Ficha 360° de lectura segura (sin migración)

1. **Control en el servidor antes de leer.** La página resuelve, con el cliente de la sesión, el tenant y el rol de la persona en `user_tenants` (`admin` o `accounting`, `disabled_at is null`). **Después** busca la ficha por código **en ese tenant**. Si el rol no alcanza, responde 404 sin leer la ficha: así quedan fuera el acceso extra y la lectura propia de 0181. `requireModuleView("nomina")` sigue como primera puerta.
2. **Datos separados por uso.** Tres proyecciones en el servidor:
   - **lista:** sin cédula, sin sueldo y sin cuenta bancaria. Se agrega el correo de contacto y si tiene cuenta enlazada;
   - **ficha:** con la cuenta ya enmascarada en el servidor (`•••• 1234`). El número completo nunca viaja al navegador en la F1;
   - **edición:** el formulario ya no trae la cuenta. Muestra la enmascarada y un campo vacío «Nueva cuenta»: si se llena, la reemplaza; si no, no cambia.

   Así se corrige que hoy la lista mande la cuenta completa de todo el equipo (§2.1).
3. La fila de Empleados: el nombre es un `<a href>` a la ficha, no un `div` clicable (BTN-01). El interruptor y el lápiz siguen como `<button type="button">` y no cambian de lugar según el estado (TBL-01).
4. **Error no es ausencia.** `getEmployeeByCode` devuelve tres resultados: encontrada, no existe o error. Con error, la página muestra «No se pudo cargar» con reintento, no 404. Cada bloque se carga con su consulta acotada (por ejemplo, los últimos 10 recibos y los últimos 20 hechos de la línea de tiempo, con «Ver todo» que lleva a la pestaña filtrada), y cada uno tiene su propio estado de error (§5.3).
5. Cabecera, avisos, KPIs, columnas y pestañas Resumen, Línea de tiempo y Acceso (§5), leyendo por `employee_id` y `tenant_id`.
6. Correo de acceso: si hay `auth_user_id`, se lee de `auth.users` con el cliente admin, **en el servidor y solo para admin**. A Contabilidad le llega «Tiene cuenta» y nada más.
7. En la ficha de usuario, «Ver ficha de empleado» si la persona tiene ficha enlazada y quien mira tiene rol `admin` o `accounting`.

### F2 — Identidad, revelado y foto (migración **0555**, reservada)

Sin migración, en la misma fase y **antes o junto con** el enlace manual: el correctivo de `ensureEmployeeAuthUser` (§4, punto 6).

Contenido de la 0555, en este orden:

1. **Topes:** `set lock_timeout = '5s'` y `set statement_timeout = '30s'` (`0261_audit_entity_catalog_validate.sql:19-20`).
2. **Preflight que aborta** (`do $$ … raise exception`):
   - existen `public.nomina_employees`, `public.entity_audit_log`, `public.audit_entity_types` (`to_regclass`) y `public.append_audit_event`;
   - existen la FK `entity_audit_log_entity_type_fkey` y la columna `nomina_employees.auth_user_id` con su índice único;
   - **no** existen `nomina_employees.photo_path` ni el bucket `employee-photos`;
   - los tipos del catálogo no existen, o existen con el mismo `domain_code`. Con otro dominio aborta, porque cambiaría su clase de retención.
3. **Catálogo de auditoría** con `insert into public.audit_entity_types (entity_type, status, domain_code, contract_version, introduced_by_ref) … on conflict (entity_type) do update` (`0538:292-299`):

   | `entity_type` | `domain_code` | Clase (calendario v1.0) | Eventos | Fase |
   |---|---|---|---|---|
   | `nomina_employee_access` | `access` | `security`, 2 años | `user_linked`, `user_unlinked` | F2 |
   | `nomina_employee_photo` | `governance` | `security`, 2 años | `photo_set`, `photo_removed` (sin imagen ni ruta) | F2 |
   | `nomina_employee_sensitive_view` | `security` | `security`, 2 años | `bank_account_revealed` (sin el número) | F2 |
   | `studio_login_events` | `security` | `security`, 2 años | `login_events_viewed` (sin IP ni agente) | F4, en su migración |
   | `nomina_employee` | `finance` | `fiscal`, 10 años | cambios de sueldo, banco, estado y puesto | F5, en su migración |

   **Primer uso del `domain_code` `security`:** ningún tipo lo usa hoy (`grep "'active', 'security'"` en `supabase/migrations`, sin resultados). El calendario y `0304:69` ya lo cuentan en la clase `security`, así que ningún lote cambia; la revisión de la 0555 lo comprueba igual. La foto va en `governance` y no en `operations` porque es un dato de la persona: 2 años y no 5. El sueldo es nómina, por eso `finance`, como `payroll_settlement` (`0316:26-32`).
4. **RPC de enlace:** `nomina_link_employee_user(p_employee_id uuid, p_user_id uuid, p_reason text)` y `nomina_unlink_employee_user(p_employee_id uuid, p_reason text)`:
   - `security definer`, `set search_path = ''`;
   - solo admin activo de un único tenant (`0398:105-120`);
   - ficha y usuario del mismo tenant; usuario miembro activo de Studio de ese tenant y **no** presente en `client_users`; ficha viva y no egresada;
   - `select … for update` de la ficha, sin sobrescribir un enlace existente; el `23505` del índice único se traduce;
   - motivo de 3 a 500 caracteres;
   - `append_audit_event` en la misma transacción.
5. **RPC de revelado** `nomina_reveal_bank_account(p_employee_id uuid, p_reason text)`: devuelve el número y deja `bank_account_revealed` en la misma transacción. Si no puede escribir el evento, **no devuelve nada** (falla cerrado). Quién puede, si pide motivo y si pide reautenticación lo decide **D9**: por defecto, el estándar de AUD-02 §3 (§F2, revelado).
6. **RPC de la línea de tiempo** `nomina_employee_timeline_events(p_employee_id uuid, p_cursor text)`: una **proyección de hechos laborales** para Admin y Contabilidad. Solo devuelve eventos de los tipos `nomina_employee*` y `payroll_settlement` **de esa ficha**, con el resumen permitido y paginación por `(occurred_at, id)`. No es `audit_list_events`: no deja ver lo que la persona hizo en el resto del sistema.
7. **Permisos:** `revoke all … from public, anon` y `grant execute … to authenticated` en cada RPC, porque el `revoke` a `public` también se lo quita a `authenticated`.
8. **Foto:** `nomina_employees.photo_path text` y el bucket **privado** `employee-photos`: `insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values ('employee-photos', 'employee-photos', false, 2097152, array['image/jpeg','image/png','image/webp']) on conflict (id) do nothing` (`0457_document_import_workspaces.sql:103-105`). Ruta `{tenant_id}/{employee_id}/{uuid}.webp`, sin policies para `authenticated`. Se sube y se firma en el servidor, después del control de §F1 punto 1. URL firmada corta (por ejemplo, 10 minutos).
9. **Postcondiciones** que abortan si el catálogo, las RPC con su `grant`, la columna o el bucket no quedaron como se pidió.
10. Prueba de contrato en PGlite y pruebas negativas: Contabilidad enlazando, otro tenant, usuario suspendido, cliente del portal, acceso extra a `nomina`, la lectura propia de 0181, dos enlaces a la vez sobre la misma ficha, y un revelado cuando falla la escritura del evento.

**Revelado de la cuenta (D9).** El estándar de AUD-02 §3 (`audit:view_sensitive`) es motivo, reautenticación y evento, y solo admin (`aud-02.md:39`, `:44-46`). La F2 lo implementa así por defecto. Si Sam elige que Contabilidad también pueda, o quitar el motivo o la reautenticación, es una **excepción** a esa regla: se registra en `docs/governance/` con su motivo, antes de construir.

**Foto (UPL-01 y MP-01).**

- El selector dice tipo, tamaño máximo (2 MB) y para qué es antes de elegir. Hay botón además de arrastrar. El estado del archivo se ve: subiendo, procesando, lista o falló.
- El servidor vuelve a validar tipo (por contenido), tamaño, tenant y permiso.
- Se reescala a 512 px, se guarda en WebP y **se quitan los metadatos EXIF** (pueden traer ubicación).
- **Cambiar la foto:** primero se sube el archivo nuevo. Después, en una transacción, se cambia `photo_path` y se deja `photo_set`. Si la transacción falla, el archivo nuevo queda huérfano. El archivo viejo **no se borra en el momento**: lo limpia una **reconciliación** que borra los archivos del bucket que ninguna ficha referencia. Ese borrado de huérfanos es el P0 técnico de MP-01; la acción visible no es P0.
- **Quitar la foto:** la ficha deja de tener foto (`photo_path = null`) y queda `photo_removed`. Pide confirmación (BTN-01: Cancelar con el foco, la acción a la derecha, en `danger`). El archivo lo limpia la misma reconciliación.
- Ficha **egresada**: la foto se ve y no se cambia. Ficha **borrada** (`deleted_at`): su archivo entra en la reconciliación. El borrado se agrega al mapa de borrado.

En pantalla: «Enlazar con usuario», «Quitar enlace», la sugerencia por correo, «Subir foto», «Cambiar», «Quitar» y «Mostrar» la cuenta. La foto sale en la cabecera y en la fila de Empleados; en el resto del Studio, lo decide D4.

**Puertas:** aplicar la 0555 en producción con OK nominal de Sam y el runbook.

### F3 — «Lo que hizo» (migración nueva, la asigna el DG)

- Nueva versión de `audit_list_events` con `p_actor_id uuid default null`. El filtro es **`actor_type = 'user'` y `actor_id = p_actor_id`**, dentro del tenant del admin, con el mismo cursor estable `(occurred_at, id)` de 0398. Se aplica después de autorizar y antes de serializar (AUD-02 §4).
- La migración hace `drop function` de la firma vieja de 11 parámetros (`0398:63-75`) antes de crear la nueva, y repite `revoke` y `grant execute … to authenticated`: con dos firmas con valores por defecto, PostgREST no sabría a cuál llamar. `listGovernedAuditEvents` y `/studio/admin` se actualizan en la misma PR.
- El índice `(tenant_id, actor_id, occurred_at desc, id desc)` se crea si el plan de consulta lo pide (se mide con `explain` en local).
- La pestaña usa la presentación del visor de `/studio/admin`: resumen permitido, payload oculto. **Solo admin.** Contabilidad no la ve: para ella está la Línea de tiempo laboral de la F2.
- Cubre solo lo auditado (AUD-01): cambios, no páginas vistas. La pestaña lo dice, con la fecha desde la que hay registro (D8).

### F4 — Inicios de sesión (migración nueva, la asigna el DG)

**Qué se registra.** Hay tres cosas distintas, y la pestaña no las mezcla:

| Clase | Qué es | Se registra |
|---|---|---|
| Autenticación correcta | GoTrue aceptó la contraseña | **No** por sí sola: puede ser un cliente del portal que se equivocó de puerta |
| **Acceso autorizado al Studio** | Autenticó **y** pasó el control de membresía (`login/actions.ts:58-80`) | **Sí**, `result = 'acceso'`, después de ese control |
| **Intento fallido contra una cuenta del Studio** | Contraseña incorrecta para un correo que es de un miembro de Studio | **Sí**, `result = 'fallido'`, si D7 lo aprueba |

**Qué no cubre**, y la pestaña lo dice: sesiones que siguen abiertas por renovación de token (no hay un login nuevo), entradas por el portal o por `/m/emp`, y la reconfirmación de contraseña de `lib/db/password-confirmed.ts:70`, que es un segundo factor dentro de una sesión abierta. Por eso la pestaña se llama «Inicios de sesión en el Studio», no promete «todos» y muestra «Registrado desde [fecha de salida de la F4]».

- Tabla `studio_login_events`: `id, tenant_id, user_id, occurred_at, result ('acceso', 'fallido'), method ('password', 'invitacion'), ip text, ua_browser text, ua_os text, ua_device text, minimized_at timestamptz`. Sin correo, sin contraseña y sin user agent crudo. El Studio no tiene magic link (`login/actions.ts:45`).
- La escribe el servidor con `getRequestIp()` y una función append-only estrecha (AUD-02 §7), en `login/actions.ts` después del control de membresía y en el acceso por invitación (`app/invitar/[token]/actions.ts:129`). Si escribir falla, el login sigue: es evidencia, no control.
- **Intentos fallidos (D7).** Solo se guardan si el correo es de un miembro de Studio del tenant; si no, nada. La búsqueda y la escritura van **después de responder** (`after()` de Next), con el mismo mensaje de error de hoy y un límite de ritmo por IP (huella SHA-256, como `portal_registro_throttle`). Lo que esto **no** resuelve, y la F4 **mide, no promete**:
  - `after()` no iguala el tiempo de `signInWithPassword`: GoTrue puede tardar distinto si el correo existe o no. Si la medida en local muestra una diferencia explotable, la defensa es el límite de ritmo, y se documenta;
  - el `user_id` se resuelve con una consulta directa por correo normalizado, sin paginar. Nunca con `listUsers`, que solo ve la primera página (`nomina/actions.ts:1910`). Si no se puede resolver, no se registra el intento.
- RLS: sin acceso directo para `anon` ni `authenticated`. Se lee por una RPC solo de admin, con cursor `(occurred_at, id)` y límite (AUD-02 §4 y §7). Cada vez que el admin abre la pestaña queda `login_events_viewed`, sin IP (AUD-01 §2).
- **Retención (D6), dentro de AUD-02.** Es un dato de seguridad, clase A (AUD-02 §5). El calendario `docs/legal/retention-schedule-v1.md` §3 da 2 años a la clase `security`, pero su alcance es solo `entity_audit_log`, y AUD-02 §5 no deja purgar nada sin calendario. Por eso no hay cron propio:
  1. **Enmienda del calendario a v1.1**, con aprobación de Sam y revisión del abogado: `studio_login_events` en la clase `security`, 2 años, con **minimización escalonada** a los 90 días (se vacían `ip` y `ua_*` y se marca `minimized_at`).
  2. **Ejecución por lote** con dry-run, conteo y hash, segundo actor y revalidación, respetando los holds de `0301` (AUD-02 §8). Las funciones de lote de la 0304 solo leen `entity_audit_log` (`0304_audit_retention_batches.sql:57-72`): la F4 declara **funciones nuevas** con el mismo contrato, para minimizar y para purgar.

  Mientras la enmienda no esté aprobada, la tabla **se conserva sin purga** (el default de AUD-02 §5). La F4 puede salir igual.
- **Medir antes de construir**, en local: qué IP y agente llegan detrás de Traefik y qué guarda `auth.audit_log_entries` en v2.197. Con Cloudflare delante, la pestaña dice «IP del borde» en vez de mostrarla como si fuera la de la persona.
- Pruebas: un acceso al Studio deja una fila; un cliente del portal que autentica en el Studio no deja fila; un correo inexistente no deja fila; Contabilidad recibe `42501`; la minimización vacía IP y agente.

### F5 — Historial de la ficha y alta con acceso

- Auditar los cambios de sueldo, banco, estado y puesto con `append_audit_event` (tipo `nomina_employee`, `finance`). Para los campos no sensibles se guardan antes y después; para la cuenta, solo «cambió» (AUD-01 §5). Salen en la Línea de tiempo.
- «Dar acceso» desde la ficha de un empleado sin usuario: invitación con `employee_id` (§4, punto 4). Se retira el relleno por correo del accept.
- Migración propia, la asigna el DG.

### Después (no entra en F1-F5)

- **C1:** autoservicio en `/m/emp` para que el empleado suba su foto y corrija su contacto. Es su consentimiento para la foto (D4).
- **C2:** alertas de seguridad solo para admin, acotadas, por ejemplo varios intentos fallidos seguidos contra una cuenta. Sin perfilar a la persona.
- **C3:** filtros de la lista de Empleados en la URL, sin nombres ni correos.

## 7. Lista exacta de archivos por fase

### F1 (implementada en esta PR)

| Archivo | Cambio |
|---|---|
| `lib/studio/nomina/employee-types.ts` | `auth_user_id` en `Employee`; proyecciones `EmployeeRef`, `EmployeeListItem` y `EmployeeEditView`; `maskBankAccount`, `toEmployeeListItem`, `toEmployeeEditView` (campo por campo, sin `...e`) |
| `lib/studio/nomina/employee-queries.ts` | `auth_user_id` en las columnas; `getEmployeeByCode(supabase, tenantId, code)` con «encontrada / no existe / error» |
| `lib/studio/nomina/ficha-empleado.ts` | Nuevo. Reglas puras: nivel por rol, saldo de préstamos, asistencia del mes en hora de Caracas, línea de tiempo, los cinco datos de §5.1 |
| `lib/studio/nomina/ficha-empleado-queries.ts` | Nuevo. Bloques acotados por `employee_id` y `tenant_id`, cada uno con su error; `accesoDe` (detalle solo para admin) y `nombresDelTenant` |
| `lib/studio/nomina/ficha-empleado-guard.ts` | Nuevo. `getFichaEmpleadoAccess`: rol `admin` o `accounting` activo, con su tenant |
| `app/studio/(app)/nomina/empleados/[codigo]/page.tsx` | Nuevo. Control de rol antes de leer; 404 o «No se pudo cargar» |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/FichaEmpleadoVista.tsx` | Nuevo. Cabecera, avisos, KPIs, columnas, pestañas con teclado |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/ficha-empleado.css` | Nuevo. Grilla propia (la de la #629 todavía no está en `main`); no se toca `studio.css` |
| `app/studio/(app)/nomina/page.tsx` | Manda `toEmployeeListItem`; lee `?tab=` |
| `app/studio/(app)/nomina/actions.ts` | `getEmployeeEditViewAction`; la edición no toca la cuenta si «Nueva cuenta» queda vacía |
| `app/studio/(app)/nomina/_components/NominaClient.tsx` | Fila con correo de contacto y «Tiene cuenta»; el nombre enlaza a la ficha; pestaña en la URL; edición a pedido. **Sale la columna «Sueldo / mes»**: el sueldo está en la ficha y el total sigue en los KPIs |
| `app/studio/(app)/nomina/_components/EditarEmpleadoDrawer.tsx` | Nuevo. Pide la ficha al abrir, con su carga y su error |
| `app/studio/(app)/nomina/_components/EmpleadoDrawer.tsx` | Recibe `EmployeeEditView`; cuenta enmascarada y «Nueva cuenta» |
| `app/studio/(app)/nomina/_components/{Amonestacion,Asistencia,GenerarFiniquito,Prestamo,EnviarComunicacion}Drawer.tsx`, `AsistenciaTab.tsx`, `ComunicacionesTab.tsx` | Solo el tipo: `EmployeeRef` en vez de `Employee` |
| `app/studio/(app)/usuarios/page.tsx`, `_components/UsersClient.tsx`, `_components/UserDetailDrawer.tsx` | «Ver ficha de empleado» con el código de la ficha enlazada |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/ReintentarCarga.tsx` | Nuevo. «No se pudo cargar» con «Reintentar» (`router.refresh()`) |
| `lib/studio/nomina/__tests__/ficha-empleado.test.ts` | Nuevo |
| `lib/studio/nomina/__tests__/employee-queries.test.ts` | Nuevo. `getEmployeeByCode` real con cliente falso: códigos válidos e inválidos, tenant y los tres resultados |
| `app/studio/(app)/nomina/empleados/__tests__/ficha-empleado-page.test.tsx` | Nuevo (§11, F1) |
| `app/studio/(app)/nomina/__tests__/editar-empleado-cuenta.test.ts` | Nuevo |
| `docs/specs/0652-ficha-empleado-360/spec.md`, `docs/specs/README.md` | Estado y lista |
| `.agents/handoffs/sdd-0652-ficha-empleado-360.md` | Handoff |

Diferencias con lo propuesto antes de implementar:

- **CMP-01:** el registro (`docs/governance/components/`) solo lista primitivas compartidas. Los componentes de la ficha son locales y usan primitivas existentes, así que **no se dan de alta**. Si alguno se promueve a compartido, ahí sí.
- **Acciones de Nómina en la ficha:** «Registrar préstamo», «Amonestación» y «Generar finiquito» no se repiten en la F1: cada bloque lleva a su pestaña («Ir a Préstamos»). Así no se duplican los formularios, que necesitan las reglas de nómina, y no se destacan (B5).
- **Borrar la cuenta bancaria** desde el formulario ya no se puede: un campo vacío significa «conservar». Si hace falta, va como acción propia.

### F2 (implementada en su PR; la migración 0555 queda en espera)

| Archivo | Cambio |
|---|---|
| Migración **0555** en `supabase/migrations/` (se cita por número) | Nueva (§F2): catálogo, `photo_path`, bucket, las cinco RPC y la que resuelve quién llama |
| Su contrato en `supabase/tests/`, con el mismo número | Nuevo. Writer AUD-01 real, casos negativos por rol, tenant, suspendido, cliente del portal, acceso extra y lectura propia |
| `lib/studio/nomina/__tests__/ficha-empleado-0555.migration.test.ts` | Nuevo. Corre el contrato en PGlite, con control rojo, preflight y mutantes |
| `supabase/migrations-baseline.json`, `supabase/pending-migration-symbol-declarations.json` | La 0555 declarada en espera y sus degradaciones. `supabase/migrations.lock.json` no cambia hasta aplicarla |
| `lib/studio/nomina/employee-auth-user.ts` | Nuevo. `ensureEmployeeAuthUser` sale de `actions.ts`: crea, «ya existe» o error; nunca reutiliza (§4, punto 6) |
| `app/studio/(app)/nomina/actions.ts` | La aprobación usa el correctivo, crea la ficha sin acceso si el correo ya tiene cuenta y avisa; `getRegistrationReviewAction` (N2) |
| `app/studio/(app)/nomina/__tests__/ensure-employee-auth-user.test.ts`, `revisar-solicitud.test.ts` | Nuevos |
| `app/studio/(app)/nomina/empleados/[codigo]/actions.ts` | Nuevo: enlazar, quitar enlace, subir y quitar la foto, mostrar la cuenta |
| `app/studio/(app)/nomina/empleados/[codigo]/page.tsx` | Foto firmada, eventos, candidatos y sugerencia (solo admin) |
| `app/studio/(app)/nomina/empleados/[codigo]/_components/{FichaEmpleadoVista,FotoEmpleado,EnlaceUsuario,MostrarCuenta}.tsx`, `ficha-empleado.css` | Enlace, sugerencia, foto, revelado, línea de tiempo con eventos |
| `app/studio/(app)/nomina/empleados/__tests__/{ficha-empleado-page.test.tsx,ficha-empleado-actions.test.ts}` | Casos de la fase 2 |
| `lib/studio/nomina/employee-photo.ts` | Nuevo: validación por contenido, reescalado, WebP sin EXIF, ruta, firma |
| `lib/studio/nomina/{ficha-empleado,ficha-empleado-queries,employee-types}.ts` | Eventos como hechos, sugerencia, candidatos, `photo_url` en la lista |
| `lib/studio/nomina/{registration-types,registration-queries}.ts`, `app/studio/(app)/nomina/_components/{SolicitudesTab,RevisarSolicitudDrawer,NominaClient}.tsx`, `app/studio/(app)/nomina/page.tsx` | N2: la bandeja no lee la cédula ni la cuenta; la revisión las pide para una pendiente, con la cuenta enmascarada. Foto en la fila de Empleados |
| `app/api/cron/purge-employee-photo-orphans/route.ts` y su prueba | Nuevo: reconciliación de huérfanos del bucket (P0 técnico). Nace apagada |
| `scripts/build-crontab.mjs`, `scripts/__tests__/build-crontab.test.ts`, `infra/dtd-cargo/cron/crontab` | El cron nuevo, generado |
| `.env.example`, `infra/dtd-cargo/.env.example` | `PURGE_EMPLOYEE_PHOTO_ORPHANS_ENABLED` |
| `lib/studio/rbac-actions-guard.test.ts` | Inventario 477 → 483 |
| `lib/studio/nomina/__tests__/*` | Pruebas nuevas |
| `docs/legal/privacidad/registro-tratamiento.md`, `mapa-de-borrado.md` | Foto, enlace, revelado y su borrado |
| `docs/governance/reviews/excepcion-aud-02-revelado-cuenta-nomina-2026-11-17.md` | La excepción de D9 (b) a AUD-02 §3 |

Diferencias con lo propuesto antes de implementar la F2:

- **Motivo de 4 a 500 caracteres**, no de 3: el writer de auditoría (0267) rechaza un motivo de menos de 4.
- **La foto tiene su RPC** (`nomina_set_employee_photo`), que no estaba en la lista de §F2: «referencia y evento en una transacción» no se puede cumplir desde la aplicación.
- **`ensureEmployeeAuthUser` ya no busca la cuenta existente.** Si Auth dice que el correo existe, no se consulta de quién es: no hay `listUsers` ni lecturas que puedan fallar abierto. La cuenta creada en una aprobación cuya ficha no nace se descarta.
- **«Reenlazar su cuenta de empleado» no se construyó.** Falta decidir cómo se reconoce, sin leer datos de otra persona, que una cuenta sin membresía del Studio «era solo de `/m/emp`». Mientras tanto, un empleado que vuelve queda con la ficha sin acceso y el aviso. Queda como pendiente de la F2.
- **La línea de tiempo trae la primera página de eventos (50).** La RPC ya pagina con cursor; «Ver más» en pantalla queda para cuando haga falta.
- **Sin la 0555 aplicada**, la ficha se lee igual: `photo_path` se pide aparte y los eventos no se muestran. Cada acción nueva responde que todavía no está disponible.
- **La foto del candidato** (`nomina_employee_registrations.photo_path`) deja de leerse: nadie la escribe ni la usa.
- **La excepción de D9** vive en `docs/governance/reviews/` y está registrada en la fila de AUD-02 del registro maestro (protocolo L3).
- **Dos enlaces a la vez** no se prueban con carrera real (PGlite tiene una conexión): se mide el segundo intento en serie, que recibe «ya enlazada».

F3, F4 y F5 fijan su lista al asignarse, con su número de migración. La de F4 incluye obligatoriamente las **funciones de lote propias** para minimizar y purgar `studio_login_events` y sus pruebas en PGlite.

## 8. Decisiones para Sam

> **Aprobadas el 2026-11-17.** En el chat del Director General, a la pregunta «¿Apruebas las 13 decisiones recomendadas de la ficha de empleado?», con la tabla de recomendadas a la vista, Sam respondió literal: **«Sí, las recomendadas»**. Rige la columna «Recomendada» para D1 a D13. En D9 eso es la opción **(b)**: Admin y Contabilidad, con motivo y sin volver a pedir la contraseña. Es una **excepción a AUD-02 §3** y se registra en `docs/governance/` en la F2, antes de construir el revelado.

| ID | Pregunta | Opciones | Recomendada |
|---|---|---|---|
| D1 | ¿Cómo se une una ficha de empleado con su usuario? | (a) Con la columna que ya existe (`auth_user_id`), por decisión explícita de un admin, con motivo y registro, solo con miembros del Studio que no sean clientes del portal. El correo solo **sugiere**. (b) Seguir enlazando por coincidencia de correo. (c) Una tabla de uniones nueva | **(a)**: ya existe y es única por persona. (b) falla con correos distintos o vacíos, y hoy puede enlazar a un cliente del portal (§3.3) |
| D2 | Al aprobar una solicitud o dar acceso a alguien nuevo, ¿cómo se enlaza? | (a) Aprobar una solicitud **nunca** reutiliza una cuenta que ya existe, y falla cerrado ante cualquier error (F2). La invitación lleva el id de la ficha (F5). (b) Como hoy | **(a)**, y el correctivo va en la F2, no al final: hoy un error en una comprobación reutiliza la cuenta |
| D3 | La persona enlazada, ¿entra también a la app del empleado (`/m/emp`)? Y si la suspendes en el Studio, ¿se le corta? | (a) Sí entra; suspenderla en el Studio **no** la corta: `/m/emp` se corta solo al egresarla. (b) Sí entra, y suspenderla en el Studio también le corta `/m/emp`. (c) No entra | **(a)**: sus recibos siguen siendo suyos aunque no trabaje en el Studio. Si prefieres (b), es un cambio en `get_employee_id_for_user()` |
| D4 | ¿Quién ve la foto? | (a) Solo quien ve Nómina (Admin y Contabilidad), en la ficha y la lista. (b) Además, como avatar en todo el Studio | **(a)** por ahora. (b) cuando el empleado la suba él mismo desde su app (C1), que es su consentimiento |
| D5 | ¿Quién sube la foto? | (a) Admin y Contabilidad. (b) Solo admin. (c) También el empleado desde `/m/emp` | **(a)**, con (c) más adelante (C1) |
| D6 | ¿Cuánto se guardan los inicios de sesión? Es un dato de seguridad: la regla de auditoría no deja borrarlo solo sin un calendario aprobado. | (a) Enmendar el calendario a v1.1: clase `security`, 2 años, con la IP y el navegador vaciados a los 90 días, todo por lote con segundo aprobador y revisado por el abogado. (b) 2 años sin vaciar antes la IP. (c) No enmendar: se guarda sin borrar hasta que haya calendario | **(a)**: es el plazo que ya aprobaste para seguridad. Mientras no se apruebe, rige (c) |
| D7 | ¿Se registran los intentos fallidos? | (a) Sí, solo contra cuentas del Studio, con el mismo mensaje y con límite de ritmo. La F4 mide si se puede saber qué correos existen por el tiempo de respuesta. (b) No | **(a)**: un intento fallido es lo que avisa de un ataque |
| D8 | ¿«Lo que hizo» incluye las páginas que visitó? | (a) No: solo lo que cambió. (b) Sí | **(a)**: vigilar la navegación es desproporcionado |
| D9 | ¿Cómo se ve la cuenta bancaria completa? | (a) **Estándar de la regla de auditoría:** solo admin, con motivo y volviendo a pedir la contraseña; queda registrado. (b) Admin **y Contabilidad**, con motivo, sin volver a pedir la contraseña; queda registrado. (c) Admin y Contabilidad, sin motivo ni contraseña; queda registrado | **(b)**: Contabilidad necesita la cuenta para pagar, y el motivo deja claro para qué se abrió. Pero (b) y (c) son **excepciones** a la regla AUD-02 §3 y quedan escritas como tales. Si no quieres excepción, (a). En todos los casos la lista y el formulario dejan de mandar la cuenta completa (F1) |
| D10 | Contabilidad abre la ficha. ¿Qué ve del acceso? | (a) Solo «Tiene cuenta» y «Con acceso» o «Sin acceso». (b) También rol y último ingreso | **(a)**: pediste inicios de sesión y seguimiento solo para admin |
| D11 | ¿En qué orden se construye? | (a) F1 lectura segura → F2 identidad, revelado y foto → F3 «lo que hizo» → F4 inicios de sesión → F5 historial. (b) Inicios de sesión antes que «lo que hizo» | **(a)**: la identidad sostiene todo lo demás; «lo que hizo» no necesita tabla nueva ni medida previa |
| D12 | ¿Se avisa al equipo que se registran sus inicios de sesión? | (a) Sí: una línea en la pantalla de login del Studio y un párrafo en el aviso interno, revisado por el abogado. (b) No | **(a)** |
| D13 | Cuando el correo de una ficha coincide con el de un usuario, ¿cómo se confirma el enlace? | (a) Uno por uno, desde cada ficha, con su motivo. (b) En lote | **(a)**: el equipo es pequeño y cada enlace abre recibos y acceso. Un lote equivocado enlaza a varias personas a la vez |

## 9. Datos personales (`revisar-datos-ve`)

Alcance: Venezuela (CRBV arts. 28 y 60). **China (PIPL art. 3):** registrar inicios de sesión de personas del equipo que trabajan desde China puede caer en el supuesto extraterritorial. Pregunta para el abogado.

### 9.1 Inventario de lo que agrega o cambia

| Dato | Qué es | Finalidad | Dónde vive | Quién lo ve | Conservación | Estado |
|---|---|---|---|---|---|---|
| `nomina_employees.bank_account` (ya existe) | Cuenta bancaria | Pagar la nómina | Supabase propio | Hoy: viaja entera al navegador en la lista. Propuesto: enmascarada; completa solo por revelado (D9) | La de la ficha | ENCONTRADO hoy (§2.1); diseño §F1 y §F2 |
| `nomina_employees.photo_path` + archivo | Foto (imagen, CRBV art. 60) | Reconocer a la persona | Bucket privado, URL firmada | Admin y Contabilidad (D4) | Mientras la ficha viva; los huérfanos los borra la reconciliación | Diseño §F2 |
| `nomina_employees.auth_user_id` (ya existe) | Unión ficha ↔ usuario | Ver acceso y actividad | Supabase propio | Admin y Contabilidad (sí/no); detalle solo admin | La de la ficha | CORRECTO en esquema (`0181:37-46`) |
| `studio_login_events.ip`, `ua_*` | IP y equipo del acceso | Seguridad | Supabase propio, sin acceso directo | Solo admin | Vaciados a los 90 días si se aprueba v1.1 (D6); hasta entonces, sin purga | Diseño §F4 |
| `studio_login_events.occurred_at`, `result`, `method` | Cuándo y cómo entró | Seguridad y seguimiento | Igual | Solo admin | `security`, 2 años, por lote (D6) | Diseño §F4 |
| Eventos de `entity_audit_log` del actor (ya existen) | Lo que cambió | Seguimiento | Supabase propio | Solo admin | El calendario v1.0 según el dominio | CORRECTO el acceso (`0398:105-120`) |
| Eventos nuevos (`user_linked`, `photo_set`, `bank_account_revealed`, `login_events_viewed`) | Quién hizo qué, sin el dato | Trazabilidad | `entity_audit_log` | Admin; Contabilidad solo los laborales de la ficha (§F2) | `security`, 2 años | Diseño §F2 y §F4 |
| Correo de acceso | Dato de `auth.users` | Reconocer a la persona | Ya existe | Solo admin en la ficha | La de Auth | Diseño §F1 |

### 9.2 Hallazgos

| # | Estado | Qué | Evidencia | Arreglo |
|---|---|---|---|---|
| H1 | ENCONTRADO | `nomina_employees` no tiene plazo de conservación en el registro | `registro-tratamiento.md:55` | Fuera de esta SDD: Sam con el abogado |
| H2 | ENCONTRADO | La foto del candidato existe sin escritor y con conservación indefinida | `0180:90`; `registro-tratamiento.md:56` | Fuera de alcance |
| H3 | ENCONTRADO | Los cambios de sueldo y banco no dejan rastro | §2.1 | F5 |
| H4 | NO VERIFICABLE | Qué IP y agente guarda GoTrue v2.197, y su retención | Solo en local | F4 |
| H5 | NO VERIFICABLE | Si la IP que llega es la de la persona o la del borde | `infra/dtd-cargo/compose.yml:64-67` | F4; no se toca el borde |
| H6 | CORRECTO | Los datos de red y de auditoría no viajan a staging | `import-from-cloud.sh:78-87` | — |
| H7 | NO VERIFICABLE | Si el equipo fue informado de que se registran sus inicios de sesión | Sin aviso en el repo | D12 |
| H8 | NO VERIFICABLE | Base de licitud para los inicios de sesión y la foto; fundamento de la enmienda v1.1 | — | Abogado |
| H9 | ENCONTRADO | Aprobar una solicitud reutiliza por correo una cuenta sin mirar `client_users`, y reutiliza también si sus comprobaciones fallan: un cliente del portal puede abrir los recibos de una ficha en `/m/emp` | `nomina/actions.ts:1902-1927`; `0181:48-62`; `app/m/emp/page.tsx:30` | **F2** (§4, punto 6; D2) y el conteo con OK de §12 |
| H10 | ENCONTRADO | La lista de Nómina manda al navegador la cédula, el sueldo y la cuenta bancaria completa de todo el equipo | `employee-queries.ts:13-17`; `nomina/page.tsx:67`, `:116-117`; `EmpleadoDrawer.tsx:277` | **F1** (proyecciones separadas) y D9 |
| H11 | ENCONTRADO | Suspender a alguien en el Studio no le corta `/m/emp` | `0181:48-62` | D3 |

### 9.3 Reglas que la implementación cumple

- La foto pierde EXIF. Sin geolocalización en ningún dato nuevo.
- No se guardan correos tecleados, ni el user agent crudo, ni contraseñas.
- Lo que es solo de admin se corta en el servidor y en la RPC, no con CSS.
- Nada sale a terceros: Studio y Supabase corren en el servidor propio (`docs/runbooks/servidor-contabo.md`). Sin IA.
- En Git van roles, nunca nombres del equipo, fotos ni datos reales.

Esto no es asesoría legal. Conviene que otro modelo revise este análisis.

## 10. Gobernanza (AGENT-BRIEF, paso 4)

La spec es propuesta: casi todo es **diseño propuesto, prueba pendiente**. Solo el código y sus pruebas, en cada fase, lo vuelven cumplimiento. Lo de hoy sí se clasifica.

| Política | Dónde toca | Clasificación | Cómo |
|---|---|---|---|
| AUD-01 (hoy) | Cambios de sueldo, banco y estado | **No conformidad** | Sin evento (§2.1). La cierra la F5 |
| AUD-01 | Enlace, foto, revelado, consulta de inicios de sesión, cambios de la ficha | **Diseño propuesto, prueba pendiente** | `append_audit_event` en la misma transacción, tipo del catálogo, motivo donde cambia el acceso |
| AUD-02 §3 (hoy) | La cuenta bancaria completa llega al navegador sin registro | **No conformidad** (por analogía: AUD-02 rige los logs, y aquí se aplica al revelado de un dato sensible de Nómina) | La cierra la F1 (no viaja) y la F2 (revelado) |
| AUD-02 §3 | Revelado de la cuenta | **Diseño propuesto** con el estándar. Si Sam elige D9 (b) o (c): **excepción** registrada | §F2, revelado |
| AUD-02 §4 (hoy) | `audit_list_events` sin filtro por actor | **No conformidad** | La cierra la F3 |
| AUD-02 §4 y §7 | Inicios de sesión y «lo que hizo» | **Diseño propuesto, prueba pendiente** | Solo admin, RPC con cursor, sin acceso directo, consulta auditada |
| AUD-02 §5 y §8 | Retención de `studio_login_events` | **Excepción pendiente** hasta aprobar la v1.1 (D6); mientras tanto cumple el default: sin purga | §F4 |
| UPL-01 | Subida de la foto | **Diseño propuesto, prueba pendiente** | Tipo, tamaño y propósito; botón; validación en servidor; ruta por tenant; URL firmada; EXIF |
| MP-01 | Foto y enlace | **Diseño propuesto, prueba pendiente** | Cambiar o quitar la foto no es P0: cambia la referencia con evento; los archivos huérfanos se purgan aparte (P0 técnico). Quitar el enlace deja ficha y usuario |
| BTN-01 | Fila, «Quitar foto», «Quitar enlace», menú de acciones | **Diseño propuesto, prueba pendiente** | `<a href>` y `<button type="button">`; sin `div` clicable; destructivas en `danger` |
| TBL-01 | Fila con enlace y dos botones | **Diseño propuesto, prueba pendiente** | Acciones fijas; lista y detalle en el teléfono |
| A11Y-01 | Pestañas, enlace, selector, foto, zoom | **Diseño propuesto, prueba pendiente** | §5.4 |
| FRM-01, ERR-01, LOD-01 | Motivo, enlace, foto, bloques | **Diseño propuesto, prueba pendiente** | §5.3: error distinto de ausencia |
| CMP-01 | Componentes de la ficha (`FichaEmpleado*`, `EditarEmpleadoDrawer`) | **Cumplimiento** en F1: son locales, usan solo primitivas `canonical` o existentes y no crean consumidores de `deprecated`. El registro solo lista primitivas compartidas, así que no hay alta | §7, F1 |
| SGE-00 | Toda la SDD | **Cumplimiento** | SDD con allowlist exacta por fase |
| IA-01 | — | **No aplica**: no hay IA | — |

## 11. Aceptación

### F1

- [ ] Sin rol `admin` ni `accounting` activo en el tenant de la ficha, la página responde 404 **sin leer la ficha**: con acceso extra a `nomina`, con la lectura propia de 0181 (su propia ficha) y con rol en otro tenant.
- [ ] La lista no trae ni manda al navegador cédula, sueldo ni cuenta bancaria (prueba sobre lo que recibe `NominaClient`).
- [ ] La ficha recibe la cuenta ya enmascarada; el formulario no la recibe y «Nueva cuenta» solo la cambia si se llena.
- [ ] La fila muestra el correo de contacto; el nombre es `<a href>`; el interruptor y el lápiz siguen como botones y no cambian de lugar.
- [ ] Código inexistente, borrado o de otro tenant: 404. Error de lectura: «No se pudo cargar», no 404.
- [ ] Cada bloque tiene su estado: sin movimientos, sin historial con su fecha, error con reintento.
- [ ] Contabilidad no recibe correo de acceso, rol, último ingreso ni pestañas de admin (prueba sobre el HTML del servidor).
- [ ] Sin usuario enlazado: «Sin cuenta», sin pestañas vacías.
- [ ] La Línea de tiempo muestra un finiquito `anulado`.
- [ ] Volver a Nómina conserva la pestaña y los filtros; las pestañas funcionan con teclado; se lee al 200 %.
- [ ] Tres columnas, dos y una por ancho, en el orden de §5.2.
- [ ] CI de la PR en verde.

### F2

- [ ] `ensureEmployeeAuthUser` no reutiliza una cuenta existente y aborta ante cualquier error de sus consultas (pruebas: cliente del portal, usuario del Studio, error en cada comprobación, más de 200 usuarios).
- [ ] La 0555 aborta en su preflight en cada caso de §F2 punto 2, y corre con `lock_timeout` y `statement_timeout`.
- [ ] Los tres tipos de F2 quedan en el catálogo con su dominio, y las postcondiciones lo comprueban.
- [ ] Las RPC tienen `revoke` a `public` y `anon` y `grant execute` a `authenticated`; el bucket es privado, con 2 MB y solo imágenes.
- [ ] Enlazar exige admin y motivo, bloquea la fila, no sobrescribe y deja el evento en la misma transacción. Dos enlaces a la vez sobre la misma ficha: uno gana y el otro recibe «ya enlazado».
- [ ] Fallan: Contabilidad, otro tenant, usuario suspendido, cliente del portal, acceso extra y la lectura propia.
- [ ] La sugerencia por correo solo la ve admin y no enlaza sola.
- [ ] El revelado deja `bank_account_revealed` sin el número y, si no puede escribirlo, no devuelve la cuenta.
- [ ] La línea de tiempo laboral solo devuelve eventos de esa ficha y de los tipos de Nómina.
- [ ] Cambiar la foto: archivo nuevo, referencia y evento en una transacción; el viejo lo limpia la reconciliación. En una ficha egresada no se puede cambiar.

F3, F4 y F5 fijan su aceptación al asignarse, con lo escrito en §6.

## 12. Fuera de alcance

- Leer filas de producción. Tres conteos útiles, sin nombres y cada uno con su OK nominal: fichas con `auth_user_id`, fichas con correo, y `auth_user_id` que también están en `client_users` (H9).
- Cambiar el borde o Cloudflare.
- Empleados sin acceso al sistema a gran escala: §4.1 los deja previstos; la carga masiva es otra SDD.
- El plazo de conservación de la ficha de nómina (H1) y la foto del candidato (H2).
- Rediseñar las otras pestañas de Nómina.
- Los puntos C1 a C3 de «Después» (§6).
