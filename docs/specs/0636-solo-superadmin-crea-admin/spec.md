---
sdd: "0636"
title: "Política de roles: solo el superadministrador crea administradores"
status: in-progress
author: "Claude (Worker 10.5)"
created: 2026-11-15
updated: 2026-11-15
supersedes: null
superseded_by: null
related: ["0250", "0633", "0634", "0251", "0289"]
confidencialidad: interno
---

# SDD-0636 — Política de roles: solo el superadministrador crea administradores

> Desde la 0355, tocar a otro administrador es una llave del superadministrador.
> Esta SDD completa la política: **crear o reactivar un administrador** también
> lo es, por cualquier camino. La regla vive en la base, con disparadores, como
> la 0543 (SDD-0634).

## 1. La política

Decisión de Sam, el 2026-11-15: solo el superadministrador (`is_platform_admin()`,
SDD-0250) puede crear o reactivar un administrador del equipo. Cubre:

| Acción | Quién puede |
|---|---|
| Invitar con rol admin | Solo el superadministrador |
| Aceptar una invitación de admin | El invitado, si la invitación la emitió un superadministrador |
| Cambiar el rol a admin | Solo el superadministrador (ya en la 0355; ahora también en la tabla) |
| Reactivar a un admin suspendido | Solo el superadministrador (ya en la 0355; ahora también en la tabla) |
| Invitar con los demás roles | Cualquier admin del equipo, como siempre |

## 2. Decisión: la regla en las tablas, no en cada función

- **Las funciones que escriben** `user_invitations` y `user_tenants`
  (`studio_invite_user` de la 0203, `studio_accept_invitation` de la 0352,
  `studio_change_user_role` y `studio_set_user_disabled` de la 0355) son
  SECURITY DEFINER de postgres. Escriben como dueño, así que una policy no las
  alcanza.
- **Reemplazarlas** exigiría el md5 del cuerpo vivo de cada una y arriesga pisar
  deriva de producción. Un disparador en la tabla aplica la regla a todas, y a
  las que vengan, sin tocar sus cuerpos ni su ACL.
- **El patrón es el de la 0543**, ya aplicado en producción: detección de sesión
  por los claims del JWT, ENABLE ALWAYS, `search_path` vacío, funciones sin
  EXECUTE para nadie, preflight y postflight con el ACL de las funciones vecinas.

### 2.1 La migración 0545, en cuatro piezas

1. **`user_invitations_exige_superadmin`**, BEFORE INSERT OR UPDATE OF role de
   `user_invitations`, ENABLE ALWAYS. Con sesión, una invitación con rol admin
   exige `is_platform_admin()`. «OF role»: aceptar (`accepted_at`) y revocar
   (`revoked_at`) no escriben el rol y no pasan por aquí.
2. **`user_tenants_exige_superadmin`**, BEFORE INSERT OR UPDATE de
   `user_tenants`, ENABLE ALWAYS. Con sesión, exige `is_platform_admin()` cuando
   una fila **queda admin viniendo de no serlo** (alta o cambio de rol) o cuando
   **un admin suspendido vuelve a estar activo**.
   - **Una excepción**, para que el invitado pueda aceptar: quien acepta, para sí
     mismo, una invitación vigente de admin que emitió un superadministrador
     (mismo equipo, mismo correo, mismo emisor, ni aceptada ni revocada ni
     vencida).
   - **Sin excepción para reactivar:** reactivar a un admin lo hace el
     superadministrador desde la ficha.
3. **La invitación con sesión pasa por una sola vía, auditada
   (`audit_d1_execute`).** La función interna
   `studio_invite_user(text,text,text)` no se expone directamente:
   `audit_d1_execute` (`membership.invite`) la llama como su dueño y registra
   cada operación en la auditoría D1.
   `service_role` queda como estaba. El envoltorio `inviteUserRPC`, sin uso, sale
   de `lib/studio/user-queries.ts`.
4. **`user_tenants_audit_alta`**, AFTER INSERT de `user_tenants`: escribe en
   `user_role_audit` (0201) el rol con que entra la persona (`role_change`, con
   `old_value` nulo). La 0201 solo auditaba UPDATE. Se deja ENABLE normal, como
   el de la 0201: en una restauración la bitácora trae sus propias filas.

### 2.2 Quién es «una sesión»

La regla de la 0543, por `request.jwt.claims` y por la forma antigua
`request.jwt.claim.role`/`.sub`:

- rol `service_role` → pasa;
- sin rol y sin sub (migraciones, jobs, el dueño, el respaldo de la 0355) → pasa;
- rol `anon` → se niega siempre, sin excepción;
- cualquier otro caso → exige `is_platform_admin()`, o la excepción de 2.1.2.

Las dos funciones guardianas niegan con
`42501 · Solo el superadministrador puede crear o reactivar administradores`.

### 2.3 La pantalla

- **Invitar** (`app/studio/(app)/usuarios/actions.ts`, `inviteUserAction`):
  - con rol admin, si la base contesta que no eres superadmin, la acción no
    invita y responde «No eres superadministrador. Invitar a un administrador lo
    hace solo el superadministrador…»;
  - si no se pudo preguntar, no corta: decide la base, y si la base niega con el
    mensaje de la 0545 sale el mismo aviso;
  - otro 42501 (no eres admin activo del equipo) dice eso, sin acusar de no ser
    superadmin.
- **El formulario** (`InviteUserDrawer`): al elegir el rol admin aparece un
  `Aviso` de atención con la regla. El error de la acción sale en el
  `ErrorAlert` (`role="alert"`) de siempre.
- **Aceptar** (`app/invitar/[token]/actions.ts`): una invitación de admin que no
  emitió un superadministrador se rechaza **antes de crear la cuenta**, con un
  aviso claro. Si no se pudo preguntar, decide la base.

## 3. Contrato

- `supabase/tests/0545_solo_superadmin_crea_admin.test.sql`, en Postgres 17 (CI)
  y en PGlite, con la 0545 real dos veces. La vuelta del desarme (bloque «(j)»)
  la agrega solo el runner PGlite: el control C4 del CI no copia
  `supabase/desarmes/`. Copia literal de `studio_invite_user`
  (0203), `studio_accept_invitation` (0352), `studio_set_user_disabled` y
  `studio_change_user_role` (0355), `audit_user_tenants_changes` (0202), la
  guarda `audit_d1_admin_tenant` y las ramas `membership.invite` y
  `membership.role_change` de `audit_d1_execute` (0289).
- `lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts`:
  - **anti-drift:** cada copia es literal y su archivo sigue siendo la última
    definición (sin las migraciones de historial de replay); la app invita solo
    por `audit_d1_execute`; el mensaje del raise es el que busca la acción;
  - **control rojo:** sin la 0545, el contrato cae en «(a)»;
  - **mutantes:** sin cada disparador, condición invertida en cada uno, sin «OF
    role», sin el revoke, excepción sin emisor superadmin, excepción para otra
    sesión, excepción también para reactivar, sin mirar la reactivación, sin el
    alta en la bitácora, sin la regla de anon (en los dos), sesión por
    `auth.uid() is null`, frenar sin claims o a service_role, sin ENABLE ALWAYS
    (en los dos), sin `search_path` vacío, conceder una función, tocar el ACL de
    `audit_d1_execute`;
  - **preflight:** falta la 0542, `studio_invite_user` no es DEFINER, anon ejecuta
    `studio_accept_invitation`.
- Acción y pantalla:
  - `app/studio/(app)/usuarios/__tests__/invitar-admin-superadmin.test.ts`;
  - `app/studio/(app)/usuarios/__tests__/invitar-admin-aviso.test.tsx`;
  - `app/invitar/[token]/__tests__/invitacion-admin-superadmin.test.ts`.

## 4. Allowlist exacta

```
.agents/handoffs/0636-solo-superadmin-crea-admin.md
app/invitar/[token]/__tests__/invitacion-admin-superadmin.test.ts
app/invitar/[token]/actions.ts
app/studio/(app)/usuarios/__tests__/invitar-admin-aviso.test.tsx
app/studio/(app)/usuarios/__tests__/invitar-admin-superadmin.test.ts
app/studio/(app)/usuarios/_components/InviteUserDrawer.tsx
app/studio/(app)/usuarios/actions.ts
docs/specs/0636-solo-superadmin-crea-admin/spec.md
docs/specs/README.md
lib/i18n/es-VE/users.ts
lib/i18n/zh-CN/users.ts
lib/studio/__tests__/solo-superadmin-crea-admin.migration.test.ts
lib/studio/platform-admin.ts
lib/studio/user-queries.ts
supabase/desarmes/  (solo el desarme de la 0545)
supabase/migrations-baseline.json
supabase/migrations/0545_solo_superadmin_crea_admin.sql
supabase/tests/0545_solo_superadmin_crea_admin.test.sql
```

## 5. Criterios de aceptación

1. Con sesión, invitar con rol admin sin ser superadministrador recibe 42501, por
   `audit_d1_execute` y por cualquier escritura de `user_invitations`; también al
   re-invitar como admin una invitación pendiente.
2. Un admin del equipo sigue invitando los demás roles por `audit_d1_execute`.
3. La invitación con sesión pasa solo por `audit_d1_execute`; la función interna
   `studio_invite_user` no se expone directamente. service_role conserva lo que
   tenía.
4. Una invitación de admin se acepta solo si la emitió un superadministrador; las
   de los demás roles, como siempre. La excepción del invitado no la usa otra
   sesión.
5. Reactivar a un admin suspendido exige al superadministrador por cualquier
   camino.
6. Cambiar el rol a admin exige al superadministrador por cualquier camino.
7. Cada alta de membresía queda en `user_role_audit`.
8. anon nunca pasa; service_role y sin claims pasan; un JSON de claims inválido
   falla cerrado; el modo réplica no se lo salta.
9. Ninguna función nueva se concede; el ACL de `audit_d1_execute`,
   `is_platform_admin()` y `studio_accept_invitation` no cambia.
10. La pantalla avisa antes y distingue las causas; aceptar no crea la cuenta si
    la invitación de admin no la emitió un superadministrador.
11. La migración es idempotente y su desarme deja el estado anterior.

## 6. Aplicación en producción

- Declarada como espera en `supabase/migrations-baseline.json`. Aplicar exige OK
  nominal de Sam para este archivo y el
  [runbook](../../runbooks/aplicar-migraciones-prod.md).
- **Antes de aplicar**, el DG le pide a Sam el conteo de solo lectura de
  invitaciones pendientes con rol admin (sin correos ni filas). Con la 0545, esas
  invitaciones solo se aceptan si las emitió un superadministrador; si hay
  alguna, Sam decide si se revoca.
- **Orden:** después de la 0542. Migrate-first: la PR trae los avisos.
- **Lock:** CREATE TRIGGER toma SHARE ROW EXCLUSIVE sobre `user_invitations` y
  `user_tenants` hasta el COMMIT; las lecturas siguen. Al reaplicarla, DROP
  TRIGGER toma ACCESS EXCLUSIVE. `lock_timeout` de 5 s.
- **Desarme:** el de la 0545 en `supabase/desarmes/`, con OK de Sam.

## 7. Fuera de alcance

- Suspender a un administrador no cambia: sigue la 0355.
- Los demás roles del equipo y sus permisos no cambian.
