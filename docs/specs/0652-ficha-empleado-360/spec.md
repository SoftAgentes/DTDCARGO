---
sdd: "0652"
title: "Ficha 360° del empleado en el Studio: datos, nómina, acceso, inicios de sesión y lo que hizo"
status: proposed
author: "Claude Worker (Sam)"
created: 2026-11-16
updated: 2026-11-16
supersedes: null
superseded_by: null
related: ["0103", "0113", "0136", "0140", "0166", "0201", "0273", "0274", "0275", "0505", "0600", "0622", "0635", "0650"]
confidencialidad: interno
---

# SDD-0652 — Ficha 360° del empleado en el Studio

> Quien abre a una persona del equipo en Nómina ve en una sola página quién es, cuánto gana y qué debe, si tiene acceso al sistema, cuándo entró y qué hizo, con enlaces para profundizar. Toma la estructura de la ficha 360° del cliente (SDD-0650).
> **Esta PR es solo la spec (fase de análisis).** No implementa nada. Las fases F1 a F5 las asigna el Director General después de que Sam responda las decisiones de §8.
> Etiquetas: **C** código leído · **D** documento del repo · **I** inferencia · **NV** sin verificar.
> Medido en `main` `26a9a911e` (2026-11-16). Las líneas citadas se vencen si alguien edita arriba: copia el nombre de la función o del bloque al buscar.

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
| La fila del empleado muestra iniciales, nombre, código, cargo, departamento, sueldo y estado. **No muestra el correo.** El único botón abre el formulario de edición | `NominaClient.tsx` (`EMP_COLS` :580, `EmpleadoRow` :636, botón :722) | C |
| El correo solo aparece como campo del formulario de edición | `app/studio/(app)/nomina/_components/EmpleadoDrawer.tsx:219-226` | C |
| **No hay ruta de detalle:** no existe `app/studio/(app)/nomina/empleados/` ni otra página por empleado | `find app/studio/(app)/nomina` (solo `page.tsx` y `finiquito/[id]`) | C |
| La consulta de empleados **no trae `auth_user_id`** | `lib/studio/nomina/employee-queries.ts` (`EMPLOYEE_COLUMNS`, :13-17) | C |
| El Norte sí dibuja un **Expediente** por empleado: KPIs (sueldo, neto, saldo de préstamo, asistencia), ficha, banco, documentos y línea de tiempo (ingreso, comunicaciones, préstamos). El Studio nunca lo portó | `docs/design/studio/_norte/erp/modules/nomina.jsx` (`ExpedienteView`, :1476), `docs/design/studio/_norte/HANDOFF-NOMINA.md:16` | D |
| Nómina **no deja eventos** en `entity_audit_log`: no hay tipo de entidad de empleado ni inserciones desde `nomina/actions.ts`. Un cambio de sueldo o de banco solo mueve `updated_at` | `grep` de `'nomina_employee'` y de `entity_audit_log` en `supabase/migrations` y `app/studio/(app)/nomina/actions.ts` (sin resultados) | C |
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

Porque **no existe**. El Studio implementó la lista y el formulario, pero no el Expediente que dibuja el Norte (`_norte/erp/modules/nomina.jsx:1476`). No hay ruta por empleado y la fila no es clicable: el único gesto es el lápiz de editar (`NominaClient.tsx:722`). Lo que tiene un empleado (préstamos, amonestaciones, recibos, comunicaciones) vive en pestañas separadas de Nómina, filtrado por persona a mano.

### 3.3 ¿Por qué «el perfil de nómina es el mismo que el de usuario» no se nota en el sistema?

El enlace existe (`auth_user_id`, 0181), pero solo se llena en dos caminos:

- al **aprobar una solicitud** de alta del empleado: crea un usuario nuevo (`ensureEmployeeAuthUser`) y **se niega a reutilizar un usuario del Studio** (`app/studio/(app)/nomina/actions.ts:1900-1925`);
- al **aceptar una invitación**, si el correo de la ficha coincide exactamente con el de la invitación (`app/invitar/[token]/actions.ts:151-180`, endurecido por la SDD-0600).

Una persona que ya era usuaria del Studio antes de tener ficha, o cuya ficha se creó con otro correo o sin correo, queda **sin enlace** (I: cuántas son en producción se mide solo con OK, §9). Y aunque esté enlazada, la pantalla no lo usa.

## 4. Enlace explícito empleado ↔ usuario

**Propuesta:** se conserva la columna que ya existe, `nomina_employees.auth_user_id`. No se agrega una tabla de uniones: la relación es una persona, un usuario, y el índice único de 0181 ya lo garantiza (`0181:43-46`).

Lo que cambia es **cómo se llena**: por una decisión explícita, nunca por adivinar.

1. **«Enlazar con usuario»** en la ficha 360, solo para admin. Abre un selector con los usuarios activos del tenant que no tienen ficha (por `user_id`; el correo solo se muestra para reconocerlos). Pide motivo. Lo hace una RPC `security definer` que exige admin, valida tenant, usuario activo y que ninguno de los dos esté enlazado, y deja un evento en `entity_audit_log` (tipo de entidad nuevo `nomina_employee`, evento `user_linked` / `user_unlinked`, con los dos ids y el motivo, sin correo). Migración 0555.
2. **«Quitar enlace»**, igual, con motivo.
3. **Sugerencia, no enlace:** si el correo de la ficha coincide exactamente con el de un usuario sin ficha, la ficha muestra «Este correo es el de [usuario]. ¿Enlazar?». La coincidencia **propone**; enlaza el admin.
4. **Alta nueva con acceso** (el «dar acceso» de la SDD-0140): la invitación lleva el id de la ficha, y al aceptarla se enlaza esa ficha, no la que tenga el mismo correo. Reemplaza el relleno por correo de `app/invitar/[token]/actions.ts:151-180`. Necesita que la invitación guarde `employee_id`: va en la F5 con su propia migración (D2).
5. **Usuario sin ficha** (por ejemplo, una cuenta externa o de prueba): la ficha de usuario dice «No tiene ficha de empleado» y, para admin, ofrece «Crear ficha» con el usuario ya enlazado.

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
| Columna Datos | Personales (cédula, nacimiento, ingreso), banco con la cuenta **enmascarada** (últimos 4; «Mostrar» la abre, D9), notas | Admin y Contabilidad | F1 |
| Columna Nómina | Préstamos y cuotas, recibos recientes, amonestaciones, finiquito si existe, comunicaciones. Cada bloque enlaza a su pestaña de Nómina filtrada | Admin y Contabilidad | F1 |
| Columna Acceso al sistema | Rol, alcance, último ingreso, estado; «Ver ficha de usuario». Sin usuario: «Sin acceso al sistema» (§4.1) | Admin (Contabilidad ve «Tiene acceso» o «Sin acceso», sin detalle) | F1 (lectura). Enlazar en F2 |
| Pestaña Resumen | Lo de arriba | — | F1 |
| Pestaña Línea de tiempo | Ingreso, comunicaciones, préstamos, amonestaciones, recibos y finiquito, en orden. Con F5, también los cambios de la ficha | Admin y Contabilidad | F1. Cambios en F5 |
| Pestaña Inicios de sesión | Fecha y hora (Caracas), resultado, IP, navegador y sistema; filtro por fecha | **Solo admin** | F3 |
| Pestaña Lo que hizo | Eventos de `entity_audit_log` donde la persona es el actor, con el visor gobernado (resumen permitido, payload oculto) | **Solo admin** | F4 |
| Pestaña Acceso | La «Actividad» de hoy: lo que se le hizo al acceso (`ActividadAcceso`) | Solo admin | F1 (reuso) |

Por ancho: tres columnas desde 1.441 px, dos (Acceso abajo) hasta 900 px, una debajo, igual que la 0650. Sin acceso a «Acceso al sistema» (Contabilidad), dos columnas. Las pestañas solo de admin se filtran **en el servidor**: a Contabilidad no le llegan ni el componente ni los datos.

## 6. Fases

### F1 — Ficha 360° de lectura (sin migración)

1. La consulta de empleados trae `auth_user_id`. `getEmployeeByCode` nueva.
2. La fila de Empleados muestra el correo y abre la ficha al hacer clic (el lápiz sigue editando).
3. Ruta `/studio/nomina/empleados/[codigo]` con `requireModuleView("nomina")`; con un código ajeno o borrado, 404.
4. Cabecera, avisos, KPIs, columnas y pestañas Resumen, Línea de tiempo y Acceso de §5, leyendo lo que ya existe por `employee_id`.
5. Correo de acceso: si hay `auth_user_id`, se lee de `auth.users` con el cliente admin **solo en el servidor y solo para admin** (como `usuarios/page.tsx:90-129`). A Contabilidad le llega «Tiene acceso» sin correo de login.
6. En la ficha de usuario, «Ver ficha de empleado» cuando existe la ficha enlazada.

### F2 — Enlace explícito y foto (migración **0555**, reservada)

Contenido de la 0555:

- `entity_audit_log`: agrega `nomina_employee` al check de `entity_type`, con el patrón de 0077/0078 (`drop constraint` + `add constraint` con la lista completa vigente).
- RPC `nomina_link_employee_user(p_employee_id uuid, p_user_id uuid, p_reason text)` y `nomina_unlink_employee_user(p_employee_id uuid, p_reason text)`: `security definer`, `search_path` vacío, solo admin activo de un tenant, mismo tenant en ficha y usuario, motivo obligatorio, evento en la misma transacción (AUD-01). `revoke` a `public` y `anon`.
- `nomina_employees.photo_path text` y un bucket **privado** `employee-photos` (`{tenant_id}/{employee_id}/{uuid}.{ext}`), sin policies para `authenticated`: se sube y se firma en el servidor con el cliente admin después de validar el rol, como el avatar del cliente (`supabase/migrations/0199_clients_avatar.sql`). JPEG, PNG o WebP; máximo 2 MB; se reescala a 512 px y **se quitan los metadatos EXIF** (pueden traer ubicación). Al reemplazar o quitar la foto, se borra el archivo anterior.
- Prueba de contrato SQL en PGlite (`.test.sql`) y prueba negativa: Contabilidad, un usuario de otro tenant y un usuario suspendido no pueden enlazar.

En pantalla: «Enlazar con usuario», «Quitar enlace» y la sugerencia por correo (§4), «Subir foto», «Cambiar» y «Quitar». La foto sale en la cabecera de la ficha y en la fila de Empleados. Si sale o no en el resto del Studio, lo decide D4.

**Puertas:** aplicar la 0555 en producción con OK nominal de Sam y el runbook. Crear el bucket va en la misma migración.

### F3 — Registro propio de inicios de sesión (migración nueva, la asigna el DG)

- Tabla `studio_login_events`: `id, tenant_id, user_id, occurred_at, result ('ok', 'fallido'), method ('password', 'invitacion', 'magic_link'), ip text, ua_browser text, ua_os text, ua_device text`. Sin correo, sin contraseña, sin el user agent crudo: se guarda resumido (navegador, sistema, tipo de equipo).
- La escribe el servidor en `app/studio/(auth)/login/actions.ts` después de `signInWithPassword`, y en el acceso por invitación (`app/invitar/[token]/actions.ts:129`), con `getRequestIp()` y el cliente admin. Si escribir falla, el login sigue (es evidencia, no control).
- Intentos fallidos: solo si D7 lo aprueba, y solo cuando el correo pertenece a un usuario del tenant; si no, no se guarda nada (no se guardan correos tecleados).
- RLS: sin acceso para `authenticated`. Se lee por una RPC solo de admin, con paginación por cursor y límite (AUD-02 §4).
- Ver los inicios de sesión de otra persona es una consulta de datos personales (AUD-01 §2, AUD-02): cada vez que el admin abre la pestaña queda un evento de consulta, sin las IP.
- Retención (D6): un cron borra IP y agente a los 90 días y la fila entera a los 12 meses, con su evento de purga sin valores, y respeta un hold de 0301.
- **Medir antes de construir**, en el stack local: qué IP y qué agente llegan a la action detrás de Traefik, y qué guarda `auth.audit_log_entries` en v2.197. Si hay Cloudflare delante, la IP será la del borde mientras el borde no cambie; la pestaña lo dice («IP del borde») en vez de mostrar una IP falsa como real. Esta SDD no toca el borde.
- Prueba: login correcto deja una fila; login sin membresía de Studio no deja fila de Studio; Contabilidad recibe `42501` al leer; la purga vacía IP y agente.

### F4 — «Lo que hizo» (migración nueva, la asigna el DG)

- Nueva versión de `audit_list_events` con `p_actor_id uuid default null`: el mismo contrato de 0398, solo admin, filtro por actor aplicado después de autorizar y antes de serializar (AUD-02 §4). El índice `(tenant_id, actor_id, occurred_at desc)` se crea si el plan lo pide.
- La pestaña «Lo que hizo» usa `listGovernedAuditEvents` con `actorId` y la misma presentación del visor de `/studio/admin`: resumen permitido, payload oculto.
- Cubre solo lo auditado (AUD-01): cambios, no páginas vistas. La pestaña lo dice. Registrar navegación queda fuera (D8).

### F5 — Historial de la ficha y alta con acceso

- Auditar en Nómina los cambios de sueldo, banco, estado, puesto y enlace, con antes y después de los campos no sensibles y solo «cambió» para la cuenta bancaria (AUD-01 §5, PII por identificador). Salen en la Línea de tiempo.
- «Dar acceso» desde la ficha de un empleado sin usuario: invitación con `employee_id` (§4, punto 4). Retira el relleno por correo del accept.
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
| `supabase/migrations/0555_nomina_enlace_usuario_y_foto.test.sql` | Nuevo, contrato en PGlite |
| `app/studio/(app)/nomina/empleados/[codigo]/actions.ts` | Nuevo: enlazar, quitar enlace, subir y quitar foto |
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
| D1 | ¿Cómo se une una ficha de empleado con su usuario? | (a) Con la columna que ya existe (`auth_user_id`), por decisión explícita de un admin con motivo y auditoría; el correo igual solo **sugiere**. (b) Seguir enlazando por coincidencia de correo. (c) Una tabla de uniones nueva | **(a)**: ya existe y es única por persona; (b) falla cuando el correo de la ficha es otro o está vacío |
| D2 | Al dar acceso a un empleado nuevo, ¿cómo se enlaza? | (a) La invitación lleva el id de la ficha (F5). (b) Como hoy, por correo al aceptar | **(a)** |
| D3 | Una persona enlazada, ¿entra también a la app del empleado (`/m/emp`) a ver sus recibos? | (a) Sí, es su propia información. (b) No: solo el Studio | **(a)**. Ojo: hoy enlazar ya lo hace automático |
| D4 | ¿Quién ve la foto? | (a) Solo quien ve Nómina (Admin y Contabilidad), en la ficha y la lista. (b) Además, como avatar en todo el Studio (todo el equipo) | **(a)** por ahora. (b) cuando el propio empleado la suba desde su app, que es su consentimiento |
| D5 | ¿Quién sube la foto? | (a) Admin y Contabilidad. (b) Solo admin. (c) También el empleado desde `/m/emp` | **(a)**, con (c) más adelante |
| D6 | ¿Cuánto se guardan los inicios de sesión? | (a) IP y navegador 90 días; fecha y resultado 12 meses; después se borra. (b) Todo 12 meses. (c) Todo 6 meses | **(a)**: lo suficiente para revisar un incidente y no más |
| D7 | ¿Se registran los intentos fallidos? | (a) Sí, solo de correos que son usuarios del tenant. (b) No, solo los que entraron | **(a)**: un intento fallido es lo que avisa de un ataque |
| D8 | ¿«Lo que hizo» incluye las páginas que visitó? | (a) No: solo lo que cambió (lo auditado). (b) Sí, también lo que vio | **(a)**: vigilar la navegación es desproporcionado y pesa mucho |
| D9 | ¿Se ve la cuenta bancaria completa en la ficha? | (a) Enmascarada (últimos 4) con «Mostrar». (b) Completa | **(a)** |
| D10 | Contabilidad abre la ficha. ¿Qué ve del acceso? | (a) Solo «Tiene acceso» o «Sin acceso». (b) También rol y último ingreso | **(a)**: Sam pidió logins y seguimiento solo para admin |
| D11 | ¿En qué orden se construye? | (a) F1 → F2 → F3 → F4 → F5. (b) Adelantar F3 (inicios de sesión) antes de F2 | **(a)**: F1 resuelve ya el correo y la entrada; F3 necesita su medida primero |
| D12 | ¿Hay que avisar al equipo que se registran sus inicios de sesión? | (a) Sí: una línea en la pantalla de login del Studio y un párrafo en el aviso interno, revisado por el abogado. (b) No | **(a)**: es lo que la persona espera saber de su propio dato |

## 9. Datos personales (`revisar-datos-ve`)

Alcance: Venezuela (CRBV arts. 28 y 60) para todo el equipo. **China (PIPL art. 3):** si se registran los inicios de sesión de personas del equipo que trabajan desde China, puede aplicar el supuesto extraterritorial (analizar el comportamiento de personas en China). Pregunta para el abogado; esta SDD no lo resuelve.

### 9.1 Inventario de lo que agrega

| Dato | Qué es | Finalidad | Dónde vive | Quién lo ve | Conservación | Estado |
|---|---|---|---|---|---|---|
| `nomina_employees.photo_path` + archivo | Foto de la persona (imagen, CRBV art. 60) | Reconocer a la persona en la ficha | Bucket privado propio, URL firmada | Admin y Contabilidad (D4) | Mientras la ficha viva; se borra al reemplazarla o al borrar la ficha | Diseño §F2 |
| `nomina_employees.auth_user_id` (ya existe) | Unión ficha ↔ usuario | Ver acceso y actividad en la ficha | Supabase propio, RLS de Nómina | Admin y Contabilidad | Igual que la ficha | CORRECTO en esquema (`0181:37-46`) |
| `studio_login_events.ip` | IP del inicio de sesión | Seguridad del acceso | Supabase propio, sin acceso directo | Solo admin | 90 días (D6) | Diseño §F3 |
| `studio_login_events.ua_*` | Navegador, sistema y tipo de equipo, resumidos | Reconocer un equipo extraño | Igual | Solo admin | 90 días (D6) | Diseño §F3 |
| `studio_login_events.occurred_at`, `result`, `method` | Cuándo y cómo entró | Seguridad y seguimiento | Igual | Solo admin | 12 meses (D6) | Diseño §F3 |
| Eventos de `entity_audit_log` del actor (ya existen) | Lo que cambió en el sistema | Seguimiento | Supabase propio | Solo admin (`audit_list_events`) | La de AUD-02 §5 | CORRECTO el acceso (`0398:105-120`) |
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
| H8 | NO VERIFICABLE | Base de licitud para registrar inicios de sesión del trabajador y su foto | — | Abogado |

### 9.3 Reglas que la implementación cumple

- La foto se limpia de EXIF (puede traer la ubicación). Sin geolocalización en ningún dato nuevo.
- No se guardan correos tecleados en intentos fallidos, ni el user agent crudo, ni contraseñas.
- Las pestañas y los datos solo de admin se cortan en el servidor y en la RPC, no con CSS.
- Nada de esto sale a terceros: Studio y Supabase corren en el servidor propio (`docs/runbooks/servidor-contabo.md`). No hay IA.
- En Git van roles, nunca nombres del equipo, fotos ni datos reales.

Esto no es asesoría legal. Conviene que otro modelo revise este mismo análisis.

## 10. Aceptación

### F1

- [ ] La fila de Empleados muestra el correo y abre la ficha; el lápiz sigue editando.
- [ ] `/studio/nomina/empleados/EMP-NNNN` muestra cabecera, KPIs, columnas y pestañas de §5 con los datos de esa persona.
- [ ] Código inexistente, borrado o de otro tenant: 404.
- [ ] Sin `nomina`: redirige como hoy `requireModuleView`.
- [ ] Contabilidad no recibe el correo de login ni las pestañas de admin (prueba de la página sobre el HTML del servidor).
- [ ] Sin usuario enlazado: «Sin acceso al sistema», sin pestañas vacías.
- [ ] Desde la ficha de usuario, «Ver ficha de empleado» cuando está enlazada.
- [ ] Tres columnas, dos y una por ancho, como la 0650.
- [ ] CI de la PR en verde.

### F2

- [ ] Enlazar y quitar enlace exigen admin y motivo, y dejan un evento en la misma transacción.
- [ ] Contabilidad, otro tenant y un usuario suspendido reciben error (prueba negativa en PGlite).
- [ ] La sugerencia por correo no enlaza sola.
- [ ] La foto se sube, se reescala, pierde EXIF y se firma en el servidor; reemplazarla borra la anterior.

F3, F4 y F5 fijan su aceptación al asignarse, con lo escrito en §6.

## 11. Fuera de alcance

- Leer filas de producción. Contar cuántas fichas tienen `auth_user_id` y cuántas tienen correo pide OK nominal; sería un conteo, sin nombres.
- Cambiar el borde o Cloudflare para mejorar la IP.
- Empleados sin acceso al sistema a gran escala (bodegueros, choferes): §4.1 lo deja previsto, la carga masiva es otra SDD.
- El plazo de conservación de la ficha de nómina (H1) y la foto del candidato (H2).
- Rediseñar las otras pestañas de Nómina.
