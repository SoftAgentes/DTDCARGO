---
sdd: "0634"
title: "Feature flags: el superadministrador por cualquier camino, también por audit_d1_execute"
status: in-progress
author: "Claude (Worker 10.5)"
created: 2026-11-15
updated: 2026-11-15
supersedes: null
superseded_by: null
related: ["0250", "0633", "0289"]
confidencialidad: interno
---

# SDD-0634 — Feature flags: el superadministrador por cualquier camino, también por audit_d1_execute

> Encender o apagar un módulo es una llave del superadministrador desde la 0355.
> Pero la escritura real va por `audit_d1_execute`, que no lo exige. Esta SDD pone
> la exigencia en la tabla, con un disparador, para que valga por cualquier camino.

## 1. Contexto

- **El hueco**, confirmado por el DG en el repo y en el catálogo de producción, sin
  filas, el 2026-11-15:
  - `audit_d1_execute(uuid,text,uuid,jsonb,text)` (0289:166) es SECURITY DEFINER,
    su dueño es postgres y authenticated tiene EXECUTE (0289:930-935).
  - Su única guarda es `audit_d1_admin_tenant()` (0289:131-160), que pide rol admin
    del tenant.
  - La rama `feature_flag.toggle` (0289:632-650) hace el UPDATE de `feature_flags`
    como dueño. La tabla no tiene FORCE ROW LEVEL SECURITY (0042:37), así que la
    policy `feature_flags_platform_admin_update` (0355) no la alcanza.
  - En producción, el cuerpo vivo de `audit_d1_execute` no menciona
    `is_platform_admin`.
- **La consecuencia:** cualquier admin del tenant encendía o apagaba módulos por
  PostgREST. El candado de superadmin de los flags era solo de pantalla
  (`platformAdminDenial`, SDD-0633).
- **Lo que ya había:** la 0542 (SDD-0633), aplicada el 2026-11-15 a las 08:09Z, le
  devolvió a authenticated el EXECUTE de `is_platform_admin()`. Sam encendió
  `chatwoot_portal` a las 08:12Z.

## 2. Decisión: disparador en la tabla, no reemplazar la función

**Las alternativas:**
- **(a) Reemplazar `audit_d1_execute` entera**, con preflight de huella del cuerpo
  vivo.
- **(b) Envolverla o parchear la rama.**
- **(c) Un BEFORE UPDATE en `feature_flags`.**

**Se elige (c):**
- **El tamaño:** la función tiene unas 760 líneas y 22 ramas. Para cambiar una, (a)
  reescribe las 21 restantes. Pisaría cualquier deriva viva, exigiría el md5 del
  cuerpo de producción en el preflight y repetiría el riesgo de ACL que tuvo la 0542
  con `create or replace`.
- **(b) no existe en Postgres** sin reemplazar la función.
- **(c) frena todos los caminos:** el DEFINER, un UPDATE directo y cualquier RPC
  futura. No toca `audit_d1_execute`, ni su cuerpo ni su ACL. Es lo que la 0355
  pedía: el control va donde vive el privilegio.

**La regla del disparador:**
- **Con sesión de usuario** (`auth.uid()` no nulo), solo `is_platform_admin()` pasa.
- **Sin sesión** (service_role, migraciones, el sembrado de la 0337 y scripts de
  operación) no cambia nada.
- **Un admin del tenant que no es superadmin** recibe `42501` «Solo el
  superadministrador puede encender o apagar módulos». La operación vuelve atrás
  entera, con su fila en `audit_d1_operations` y su evento de auditoría.

## 3. Contrato

- **R1 · La migración 0543** (después de la 0542, migrate-first):
  - **Crea la función** `public.feature_flags_exige_superadmin()`: DEFINER de
    postgres, `search_path` vacío, sin EXECUTE para nadie.
  - **Crea el disparador** `feature_flags_exige_superadmin`: BEFORE UPDATE FOR EACH
    ROW.
  - **El preflight** exige la tabla, `auth.uid()`, la 0542 (authenticated ejecuta
    `is_platform_admin()` y anon no) y `audit_d1_execute` DEFINER de postgres sin
    EXECUTE para anon. Aborta si ya hay un disparador con ese nombre y otra función.
    Guarda el ACL de `audit_d1_execute` y el de `is_platform_admin()`.
  - **El postflight** exige el disparador con su tipo exacto (`tgtype = 19`), la
    función DEFINER sin EXECUTE para anon, authenticated, service_role ni PUBLIC, y
    los dos ACL guardados sin cambios.
  - Es idempotente.
- **R2 · La server action:** si la base devuelve `permission_denied` al guardar,
  muestra el mismo aviso de la #574 (`SUPERADMIN_DENIAL`).
- **R3 · Los comentarios** de `feature-flags/actions.ts` y `platform-admin.ts`
  nombran el disparador como control real.

## 4. Revisión de las otras ramas de `audit_d1_execute`

Las llaves de la 0355 son dos: los feature flags, y tocar a otro admin (desactivarlo
o cambiarle el rol).

| Rama | ¿Llave de la 0355? | ¿Tiene el atajo? | Decisión |
|---|---|---|---|
| `feature_flag.toggle` | Sí (llave 1) | **Sí** | Entra: la 0543 |
| `membership.role_change` | Sí (llave 2b) | No: llama a `studio_change_user_role` (0355), que exige `is_platform_admin()` para un admin | No entra |
| `membership.disable`/`enable` (vía `audit_d1_auth_transition`) | Sí (llave 2a) | No: `confirm` llama a `studio_set_user_disabled` (0289:1144, 0355), que lo exige | No entra |
| `membership.invite` | No según la 0355, pero toca su intención | **Sí**: `studio_invite_user` (0203) solo pide admin del tenant, así que un admin puede invitar a alguien **como admin** | FUERA DE ALCANCE DETECTADO (§6) |
| `membership.scope_change`, `membership.invitation_revoke` | No | — | No entra |
| `notification_channel.*`, `api_key.*`, `webhook.*`, `tenant.identity_update`, `office.*`, `bank_account.*`, `numbering.legal_legend_update`, `notification_rule.*`, `agent.*` | No: la 0355 los dejó «abiertos a cualquier admin» por decisión del founder | — | No entra |

## 5. Allowlist exacta

- `docs/specs/0634-audit-d1-flags-superadmin/spec.md`
- `docs/specs/README.md` (índice generado)
- `.agents/handoffs/0634-audit-d1-flags-superadmin.md`
- `supabase/migrations/0543_feature_flags_exige_superadmin.sql`
- `supabase/tests/0543_feature_flags_exige_superadmin.test.sql`
- `supabase/migrations-baseline.json` (espera de la 0543)
- `lib/studio/__tests__/feature-flags-superadmin.migration.test.ts`
- `lib/studio/platform-admin.ts` (comentario)
- `app/studio/(app)/admin/feature-flags/actions.ts`
- `app/studio/(app)/admin/feature-flags/__tests__/aviso-superadmin.test.tsx`

## 6. Criterios de aceptación

- **CA1** El contrato de la 0543 corre en PGlite y en `sql-tests`. Su doble de
  `audit_d1_execute` copia literalmente la guarda y la rama de la 0289, y un
  anti-drift lo comprueba. Prueba siete cosas:
  - (0) antes, un admin que no es superadmin enciende un flag por el DEFINER;
  - (a) después, ese admin recibe 42501 y el flag no cambia;
  - (b) el superadmin pasa;
  - (c) por UPDATE directo, el superadmin sí y el admin no; un comercial no pasa la
    guarda;
  - (d) sin sesión, el UPDATE pasa;
  - (e) la función nueva sin EXECUTE para nadie, y los ACL de `audit_d1_execute` e
    `is_platform_admin()` sin cambios;
  - (f) es idempotente.
- **CA2** El control rojo y los mutantes caen con el mensaje que los nombra:
  - **El control:** sin la 0543.
  - **Los mutantes de la migración:** sin el disparador, con postflight y sin él;
    sin `is_platform_admin()`; que frene también sin sesión; AFTER en vez de BEFORE;
    que conceda la función, con postflight y sin él; que toque el ACL de
    `audit_d1_execute`.
  - **Los mutantes del preflight:** sin la 0542, y con `audit_d1_execute` no DEFINER.
- **CA3** La server action convierte `permission_denied` en el aviso de superadmin,
  con su prueba.
- **CA4** Las comprobaciones se registran en el handoff. `pnpm verify` no se corre en
  la PC, por orden del DG: el portón es el CI de GitHub más la revisión
  independiente.

## 7. Fuera de alcance

- **Aplicar la 0543.** La aplica el DG con OK nominal de Sam y el runbook.
- **Invitar como admin** sin ser superadmin (§4). Es otra llave, que decide el founder.
- **Retirar la espera de la 0542** del baseline y sellarla, ya aplicada. Lo hace el
  cierre del runbook, quien la aplicó.

## 8. Aplicación en producción (registro del runbook §6.3)

Pendiente. **Smoke posterior**, que nombra el DG al pedir el OK:
1. El superadmin enciende y apaga un flag sin efecto (`efecto: ninguno`) en
   `/studio/admin/feature-flags`, y lo deja como estaba.
2. Un admin del tenant que no es superadmin ve «No eres superadministrador…» y el
   flag no cambia.
3. Catálogo: el disparador existe, BEFORE UPDATE, habilitado;
   `has_function_privilege` de authenticated sobre `audit_d1_execute` sigue en t.
