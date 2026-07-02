# RESUMEN — lane rbac-disabled-enforcement (2026-07-02)

> Ventana secundaria · worktree `.claude/worktrees/rbac-disabled-enforcement` ·
> rama `worktree-rbac-disabled-enforcement`. **Sin push. Migraciones SIN aplicar
> a prod — las aplica el Director.**

## Qué hace este lane

Repara los hallazgos de la auditoría del módulo de permisos (RBAC SDD-0085 +
Usuarios & Roles SDD-0024). Hallazgo principal: **"Desactivar" un usuario era
doblemente cosmético**:

1. El `UPDATE` directo a `user_tenants` era un **no-op silencioso** (la tabla
   no tiene policy de UPDATE para authenticated → 0 filas, sin error, la UI
   reportaba éxito). Igual `revokeInvitationAction` (bloqueado por
   `no_direct_update using(false)`).
2. Aunque `disabled_at` quedara seteado, **nada lo filtraba**:
   `get_user_tenant_id()` (helper de TODA la RLS por tenant),
   `current_studio_role()`, la policy SELECT de `user_tenants`, el layout del
   Studio y `getStudioRole` → el desactivado conservaba rol, sidebar, gates y
   toda la data del tenant.

## Cambios

### Migraciones (NUEVAS · pendientes de aplicar por el Director, en orden)
- `supabase/migrations/0200_rbac_disabled_enforcement.sql`
  - `get_user_tenant_id()` + `current_studio_role()` filtran `disabled_at is null`.
  - Policy SELECT `users see their own user_tenants` + filtro `disabled_at is null`
    (cierra también las policies viejas con subquery inline, ej. dispatch 0024).
  - RPC `studio_set_user_disabled(target, disabled)` — admin activo + anti-lockout
    (no desactivar al último admin activo; cubre auto-desactivación). Idempotente.
  - RPC `studio_revoke_invitation(id)` — admin activo; idempotente; bloquea
    revocar aceptadas. Grants: revoke public/anon + grant authenticated (ambas).
- `supabase/migrations/0201_user_role_audit.sql`
  - Tabla append-only `user_role_audit` + trigger AFTER UPDATE en `user_tenants`
    (`role_change` / `disable` / `enable`, con actor). SELECT solo admins activos.

### App
- `lib/studio/rbac-guard.ts` — `getStudioRole` filtra `.is("disabled_at", null)`.
- `app/studio/(app)/layout.tsx` — ídem para el rol del sidebar.
- `app/studio/(app)/usuarios/actions.ts` — disable/enable van por RPC + ban/unban
  en Supabase Auth (`ban_duration`; si el admin client falla, loggea y sigue — la
  RLS ya corta). Revoke va por RPC. El error del RPC ahora SÍ se muestra en la
  tabla (antes el anti-lockout llegaba como errorCode que MembersTable no renderiza).
- `lib/studio/user-queries.ts` — + `setUserDisabledRPC` / `revokeInvitationRPC`;
  se eliminó `tenantHasOtherAdmins` (con RLS own-row siempre devolvía false).
- **5 view gates nuevos** (URL era tecleable): `calendario/`, `etiquetas/`, `ve/`,
  `servicios/`, `marketing/noticias-web/` → `layout.tsx` con `requireModuleView`.

### Tests
- `lib/studio/rbac-view-guard.test.ts` (NUEVO) — anti-drift de view gates, espejo
  del de actions. Allowlist justificada: dashboard (destino del ?denied=),
  mentions, bugs, mis-bugs.
- `lib/studio/rbac.test.ts` — `NON_ADMIN` derivado de `STUDIO_USER_ROLES` (la
  lista hardcodeada dejaba a `marketing` fuera de los candados); candado de
  dinero ahora exige "solo accounting entre los no-admin".

### Menores
- Password de invitación mín 6 → 8 (validator + form `/invitar`).
- Copy Usuarios: "acceso por módulo configurable" → "definido por rol".
- `PermissionsSection`: cast `as never` → `StudioUserRole`.

### Docs
- `docs/architecture/rbac-hardening-2026-06.md` — sección "Hardening 3" completa
  (incluye residuales aceptados).
- `docs/specs/0085-rbac-modulos/spec.md` — §6 follow-ups marcados; `updated`.

## Para el Director

1. **Aplicar 0200 y luego 0201 en prod** (dry-run `begin…rollback` primero, como
   siempre). Sin backfill — solo funciones/policy/RPCs/tabla nueva.
2. Merge selectivo de la rama → verify → push con OK del founder.
3. `docs:index` si el índice de specs quedó desfasado (updated de 0085).

## Pendientes que NO entraron (decisión founder / otro lane)

- ¿`marketing` debe ver módulos neutrales (dashboard, menciones, bugs,
  calendario)? Hoy la matriz no se los da; con los gates nuevos la URL redirige.
- `.eq("user_id")` explícito en `getStudioRole` (multi-tenant futuro).
- ConfirmDialog en "Desactivar" (reversible; nice-to-have).
- Leaked-password protection en Supabase Auth (pendiente conocido).
- `listUsers({ perPage: 200 })` — techo si el equipo pasa de 200 cuentas.
- Matriz editable por tenant en DB + overrides por usuario = spec propia
  (SDD-0085 §Futuro).
