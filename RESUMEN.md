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

## Segunda ola (mismo lane · 2026-07-02 tarde)

### Review adversarial del hardening — 21 hallazgos confirmados, aplicados
Ver detalle en `docs/architecture/rbac-hardening-2026-06.md` §"Review adversarial".
Los gordos: (1) `upsert_dispatch_rules`/`seed_tenant_cities_from_ve_catalog`
dejaban a un desactivado ESCRIBIR la política de pago del despacho → redefinidas
en 0200 H5; (2) TOCTOU anti-lockout → advisory lock en ambos RPCs (0200 H6);
(3) `user_profiles` PII abierta a cualquier authenticated → fila propia O
miembro activo (0200 H7); (4) 0201 sin GRANT (policy inalcanzable); (5) el
desactivado desaparecía de la tabla → `includeDisabled` (Reactivar era
inalcanzable); (6) enable ahora hace unban PRIMERO; (7) guard anti re-invitación
de miembros; (8) test de view-gates endurecido (id exacto; ancestro solo layout);
(9) `service-catalog` suma accounting (flujo Academia SDD-0093).

### SDD-0139 — metodología definitiva (decisión founder: aplicar Codex)
Codex + panel de 3 expertos + juez convergieron; founder eligió Codex:
- Matriz EN CÓDIGO para siempre (NO editable en DB, NO V/C/E/D, NO overrides
  por usuario) — descartes formales en la spec.
- `LOCKED_MODULES` (dinero + admin-only) como invariante ejecutable con test
  snapshot doble-registro.
- Capabilities: `CAPABILITIES` + `canSpecial()` + `capabilityDenial()`; primera
  real: `approve_money` en `receivePurchaseOrder` (deja de prestarse el gate de
  treasury).
- `warehouse_scope` por usuario (migr **0202**: columna cn·ve·all + RPC
  `studio_set_user_warehouse_scope` + `scope_change` en auditoría): gatea
  cn/cola-qr/etiquetas vs ve en sidebar + view gate + action gate (admin exento);
  selector "Almacén" en /studio/usuarios (solo operations/warehouse/support).
- Visor SDD-0124: candados con `Icon.lock` + tooltip; copy de admin corregido
  (ya no promete "read/write/approve").
- Spec: `docs/specs/0139-rbac-capabilities-scope/spec.md`.

## Para el Director

1. **Aplicar 0200 → 0201 → 0202 en prod EN ORDEN y ANTES de deployar el código**
   (dry-run `begin…rollback` primero, como siempre). Sin backfill. ⚠️ 0202 antes
   del deploy: `listMembers` selecciona `warehouse_scope`; los guards degradan
   solos pero el listado de Usuarios la nombra.
2. Merge selectivo de la rama → verify → push con OK del founder.
3. `docs:index` — hay spec NUEVA (0139) + updated de 0085.

## Pendientes que NO entraron (decisión founder / otro lane)

- ¿`marketing` debe ver módulos neutrales (dashboard, menciones, bugs,
  calendario)? Hoy la matriz no se los da; con los gates nuevos la URL redirige.
- Row-level por almacén en módulos mixtos (inventario/tms/despacho) — gatillo:
  2º almacenista por lado (SDD-0139 §3).
- `.eq("user_id")` explícito en `getStudioRole` (multi-tenant futuro).
- ConfirmDialog en "Desactivar" (reversible; nice-to-have).
- Leaked-password protection en Supabase Auth (pendiente conocido).
- `listUsers({ perPage: 200 })` — techo si el equipo pasa de 200 cuentas (usado
  también por el guard anti re-invitación).
