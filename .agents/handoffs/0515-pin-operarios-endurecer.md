# Handoff · SDD-0515 · PIN de operarios endurecido en la base

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 |
| Task ID | pin-operarios-endurecer |
| Owner | subagente Worker del Director (claim `pin-operarios-endurecer-worker`, liberado al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-ae87abaf4a23e67ee` |
| Rama | `codex/pin-operarios-endurecer` |
| Base | `origin/main` `9a935562`; traído `origin/main` `ad959bca` (merge de la PR #210, fast-forward) antes de tocar los archivos de Operarios |
| SDD | [0515](../../docs/specs/0515-pin-operarios-endurecer/spec.md) · `in-progress` |
| Migración | `0475_pin_operarios_endurecer.sql` · **NO APLICADA** · espera en `pendingBelowCutoff` |
| Estado de tarea | lista-para-revision (PR draft) |

## OBJETIVO ORIGINAL

Endurecer en la base el PIN de los operarios de `/m/cn` y `/m/ve`, en una sola
migración (0475): (1) que el personal del Studio no lea `pin_hash`; (2) auditar
cada restablecimiento en la misma transacción, sin el PIN (AUD-01); (3) rechazar
un PIN repetido entre operarios activos del mismo tenant y región, con reintento
de la app; corregir el voseo del validador. Ampliación del Director (decisión de
Sam «Por rol, con la matriz (Recomendado)»): la RPC y la lectura autorizan con la
misma matriz que `moduleEditDenial`/`moduleViewDenial` (default de `rbac.ts` +
desvíos de 0357), admin siempre; `pin_hash` no lo lee nadie desde la API; sin
permisos por usuario (SDD-0139); pruebas de propiedad por rol con y sin desvío y
el mutante que vuelve al rol escrito a mano.

## COMPLETADO

- **0475** (`supabase/migrations/0475_pin_operarios_endurecer.sql`):
  - SELECT de `operario_pins` por columna (13 columnas, sin `pin_hash`) para
    `authenticated` y `service_role`; policy SELECT nueva «operario_pins select by
    operarios module» = tenant + permiso de vista de la matriz.
  - `operarios_module_authorized(tenant, 'view'|'edit')` con el patrón de
    `document_entity_authorized` (0444); EXECUTE `authenticated`, `service_role`.
  - `operario_pin_assert_available(...)` privada (sin EXECUTE de API): advisory
    lock por (tenant, región) y P0018 si el PIN coincide con otro operario activo.
  - `admin_reset_operario_pin` y `admin_create_operario` reescritas desde 0351
    (sin perder una línea salvo el candado a mano y el `select`/`returning` que
    cambian): matriz de primero, PIN libre, evento `operario_pin_reset` /
    `operario_created` en la misma transacción, `sensitivity = restricted`, sin
    PIN ni hash.
  - Entidad `operario` (dominio `access`) en `audit_entity_types`.
  - `validate_operario_pin_format` desde 0037 con «Elige» y `search_path = public`.
  - Preflight con md5 de prosrc (CRLF→LF) de lo que reemplaza y de sus
    dependencias, columnas, RLS, policy y ACL; re-aplicable; postflight.
- **Contrato** `supabase/tests/0475_pin_operarios_endurecer.test.sql` (88
  aserciones) sobre la auditoría real (0258/0261/0267/0294), los desvíos reales
  (0357), las RPC vigentes por `\ir` (0021, 0037, 0351, 0325) y copias verbatim
  verificadas de 0453, 0200, 0012, 0211, 0020, 0023 y 0210.
- **PGlite** `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` (43
  pruebas): texto (copias, md5, reescritura desde 0351/0037, default duplicado =
  `ROLE_MODULE_ACCESS.operarios`, espera declarada), contrato verde, control rojo,
  7 preflights, 25 mutantes de la migración, propiedad de 25 casos (7 roles ×
  desvíos) contra `moduleViewDenial`/`moduleEditDenial` reales, y el mutante del
  rol escrito a mano rompe exactamente 6 casos.
- **App**: `lib/studio/operario-pin.ts` (`OPERARIO_PIN_IN_USE_CODE`, copy,
  `saveWithFreshOperarioPin`), `lib/studio/operario-pin-generator.ts`
  (`saveWithGeneratedOperarioPin`), `app/studio/(app)/operarios/actions.ts`
  (reintento hasta 5 PIN distintos en el generado; P0018 como error del campo en
  manual y alta). Pruebas nuevas en `operario-pin.test.ts` y
  `reset-pin-actions.test.ts`; 8 mutantes de la app mueren con control verde.
- Comentarios al día en `lib/studio/operario-queries.ts` (nombrar columnas) y
  `app/studio/(app)/operarios/layout.tsx`.
- Espera en `supabase/migrations-baseline.json`; spec 0515; índice regenerado.

Criterios 1-9 de la spec cumplidos en local; el 10 (aplicación + smoke) queda
pendiente de OK nominal de Sam.

## VALIDACIÓN

Sobre la rama en `b5cb54bd` (código) más el commit de documentación que contiene
este archivo. Windows, PGlite 0.5.8, Vitest 4.1.7.

| Comprobación | Resultado |
|---|---|
| `vitest run lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts` | PASÓ · 43/43 (contrato «TEST 0475 GREEN: 88 aserciones», control rojo, 7 preflights, 25 mutantes, propiedad) |
| `vitest run lib/studio/__tests__/operario-pin.migration.test.ts lib/studio/__tests__/operario-pin.test.ts` (antes de tocar la app) | PASÓ · 15/15; la prueba de SDD-0513 ya toma la definición del validador de 0475 |
| `vitest run operario-pin.test.ts reset-pin-actions.test.ts` | PASÓ · 50/50 |
| Mutantes de la app (scratchpad, 8: sin reintento, reintenta ante cualquier error, repropone el rechazado, devuelve el rechazado, un intento de menos, código equivocado, manual y alta sin mapear) | PASÓ · los 8 mueren; control verde 50/50 |
| `vitest related --run` (actions, layout, operario-pin, generator, queries) | PASÓ · 4 archivos, 65 pruebas (`reset-pin-actions` 30, `ResetPinDrawer.test.tsx` 10, `operario-pin.migration` 5, `operario-pin` 20) |
| `vitest run scripts/__tests__/spec-migration-refs.test.ts lib/studio/rbac-actions-guard.test.ts lib/studio/rbac.test.ts lib/studio/__tests__/rbac-action-scan.test.ts` | PASÓ · 4 archivos, 526 pruebas |
| `tsc --noEmit -p tsconfig.json` | PASÓ · exit 0 |
| `eslint` de los 8 archivos TS tocados | PASÓ · exit 0 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ · «0 ROJO · 0 AMARILLO» |
| `node scripts/check-numbering.mjs` (`sdd:check`) | PASÓ · sin números repetidos (los choques históricos de siempre, en pausa) |
| `node scripts/build-docs-index.mjs --check` | PASÓ · 500 specs |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ · 28 políticas, cápsula vigente |
| `git diff --check` | PASÓ |
| `node scripts/check-migrations-applied.mjs` | NO DISPONIBLE · SKIP, el worktree no tiene `.env.local` (exit 3) |
| Contrato `.test.sql` con psql en Docker (`run-sql-tests.mjs`) | NO EJECUTADO · Docker y corridas pesadas sólo con turno del Director; PGlite corre el mismo archivo |
| `pnpm verify` completo | NO EJECUTADO · el encargo pide validación liviana; el turno lo da el Director |
| Carrera de dos conexiones sobre el advisory lock | NO EJECUTADO · PGlite tiene una conexión; el contrato prueba el lock en `pg_locks`, no la serialización |

## COMMITS

- `546c1d1b` — migración 0475, contrato SQL, prueba PGlite y espera en el baseline.
- `b5cb54bd` — reintento del PIN generado y P0018 en manual y alta; pruebas.
- commit que contiene este documento — spec 0515, índice y handoff.

## PR / BRANCH

PR draft #212 contra `main` desde `codex/pin-operarios-endurecer`:
https://github.com/hailuwaycom-sketch/DTDCARGO/pull/212. Worktree arriba.

## PENDIENTES DE ESTA TAREA

1. **Lecturas READ ONLY de producción** (las corre el Director, sección de abajo)
   antes de pedir el OK.
2. **OK nominal de Sam** para aplicar `0475_pin_operarios_endurecer` con el
   runbook; fuera de la ventana del corte (jueves 2026-10-15 en la noche).
3. **Smoke después de aplicar** (abajo) y retirar la espera del baseline; la spec
   pasa a `done` recién ahí.
4. Turno del Director para el contrato con Docker y, si lo pide, `pnpm verify`.

## FUERA DE ALCANCE DETECTADO

- `admin_set_operario_active` y `admin_update_operario` siguen con `admin|operations`
  escrito a mano (0351) y sin auditoría (AUD-01 §7, no conformidad preexistente).
  Con un desvío, la matriz y la base dejan de coincidir para editar y desactivar,
  y `setOperarioActiveAction` ignora el error en silencio. Decisión 1 de la spec.
- `NewOperarioDrawer.tsx` sigue sorteando el PIN del alta con `Math.random` en el
  navegador (SDD-0513 sólo cambió el restablecimiento).
- Reactivar un operario puede reintroducir un PIN repetido (la base no puede
  comparar hashes sin el PIN en claro). Decisión 2.
- El P0018 es un oráculo de PIN en uso para quien edita Operarios, y los rechazos
  no dejan evento. Decisión 3.
- La spec 0513 sigue con su criterio 5 «PENDIENTE»: lo resuelve 0475 al aplicarse;
  su estado lo actualiza quien cierre 0513.

## Lecturas de preflight para el Director (producción, READ ONLY, sin filas de negocio)

Si un valor no coincide, **no aplicar**: el preflight abortaría igual; avisar con
el valor leído.

```sql
-- 1. Cuerpos y forma de lo que se reemplaza y de lo que se da por cierto.
select p.oid::regprocedure as firma,
       md5(replace(p.prosrc, E'\r\n', E'\n')) as md5,
       p.prosecdef, p.provolatile, p.proconfig, p.proowner::regrole as owner,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') as exec_authenticated,
       has_function_privilege('anon', p.oid, 'EXECUTE') as exec_anon
from pg_proc p
where p.oid in (
  to_regprocedure('public.admin_create_operario(uuid,uuid,text,text,text,text)'),
  to_regprocedure('public.admin_reset_operario_pin(uuid,text)'),
  to_regprocedure('public.validate_operario_pin_format(text)'),
  to_regprocedure('public.get_user_tenant_id()'),
  to_regprocedure('public.assert_tenant_match(uuid)'),
  to_regprocedure('public.verify_operario_pin(text,uuid,public.operario_region,text)'),
  to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'));

-- 2. Las funciones nuevas no existen todavía (ambas NULL).
select to_regprocedure('public.operarios_module_authorized(uuid,text)'),
       to_regprocedure('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)');

-- 3. operario_pins: columnas, RLS, ACL de tabla y de columna.
select array_agg(attname::text order by attname) as columnas,
       bool_or(attacl is not null) as hay_acl_por_columna
from pg_attribute where attrelid = 'public.operario_pins'::regclass and attnum > 0 and not attisdropped;
select relrowsecurity, relforcerowsecurity, relowner::regrole, relacl
from pg_class where oid = 'public.operario_pins'::regclass;
select r.rol,
  has_table_privilege(r.rol, 'public.operario_pins', 'SELECT') as sel,
  has_table_privilege(r.rol, 'public.operario_pins', 'INSERT') as ins,
  has_table_privilege(r.rol, 'public.operario_pins', 'UPDATE') as upd,
  has_table_privilege(r.rol, 'public.operario_pins', 'DELETE') as del,
  has_table_privilege(r.rol, 'public.operario_pins', 'TRUNCATE, REFERENCES, TRIGGER') as otros,
  has_column_privilege(r.rol, 'public.operario_pins', 'pin_hash', 'SELECT') as pin_hash
from (values ('anon'), ('authenticated'), ('service_role')) r(rol);

-- 4. Policies de operario_pins, con la forma normalizada que compara el preflight.
select polname, polcmd, polpermissive, polroles::regrole[],
       pg_get_expr(polqual, polrelid) as using_vivo,
       regexp_replace(replace(coalesce(pg_get_expr(polqual, polrelid), ''), 'public.', ''), '[\s()]', '', 'g') as normalizada
from pg_policy where polrelid = 'public.operario_pins'::regclass;

-- 5. Enum, overrides (forma, no filas) y catálogo de auditoría.
select array_agg(enumlabel::text order by enumsortorder) from pg_enum
where enumtypid = 'public.operario_region'::regtype;
select conname, convalidated, pg_get_constraintdef(oid) from pg_constraint
where conrelid = 'public.studio_role_module_overrides'::regclass order by conname;
select has_table_privilege('authenticated', 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE') as auth_escribe,
       has_table_privilege('anon', 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE') as anon_escribe;
select entity_type, status, domain_code, introduced_by_ref from public.audit_entity_types where entity_type = 'operario';
```

Valores que el preflight exige:

| Lectura | Valor esperado |
|---|---|
| `admin_create_operario` | md5 `f7e89f156817fc3d30eb4635090b0603` (0351) · DEFINER · `v` · `{"search_path=public, extensions"}` · EXECUTE authenticated sí, anon no |
| `admin_reset_operario_pin` | md5 `ea358b166dbd5c90dff337d473649da3` (0351) · igual que arriba |
| `validate_operario_pin_format` | md5 `62f64d916edf371cb7a2b8d4b784c18d` (0037) · INVOKER · `i` · `{search_path=public}` |
| `get_user_tenant_id` | md5 `5ff0c51c26a49419c34abc78f1d95c37` (0453; el mismo que midió 0456) · DEFINER · `s` · `{"search_path=\"\""}` |
| `assert_tenant_match` | md5 `bf5e898bc3a6209c0a5dc75f89ba9333` (0012) · DEFINER · `v` · `{search_path=public}` |
| `verify_operario_pin` | md5 `99c5f3e9eaae92bfe3987e1377d4734f` (0325) · DEFINER · `v` · `{"search_path=public, extensions"}` |
| `append_audit_event` | DEFINER · owner `postgres` · `{"search_path=\"\""}` · sin EXECUTE de authenticated |
| funciones nuevas | las dos NULL |
| columnas | `{active,created_at,display_name,display_name_cn,id,last_login_at,pin_hash,region,role,roles,tenant_id,tms_driver_id,updated_at,warehouse_id}` · sin ACL por columna |
| RLS | `relrowsecurity = t`, `relforcerowsecurity = f` |
| privilegios | anon: todo `f`; authenticated: sólo `sel = t` (y `pin_hash = t`, el defecto); service_role: sel, ins, upd y del `t` |
| policies | **una sola**: «operario_pins select by admin of tenant», `r`, permisiva, `{authenticated}`, normalizada `tenant_id=get_user_tenant_id` |
| enum | `{cn,ve}` |
| overrides | `studio_role_module_overrides_pkey` = `PRIMARY KEY (tenant_id, role, module_id)`; `…_edit_implies_view` = `CHECK (((NOT can_edit) OR can_view))`; `…_role_check` con los 6 roles; las dos escrituras `f` |
| catálogo | sin fila `operario` |

Opcional, con autorización de Sam porque lee filas (metadatos de permisos, no PII):
`select role, can_view, can_edit, count(*) from public.studio_role_module_overrides
where module_id = 'operarios' group by 1, 2, 3;` — dice si algún tenant ya tiene un
desvío de Operarios, que cambiaría la vista o la edición en el momento de aplicar.

## Orden de despliegue

**La migración es independiente de la app.** Ningún código desplegado lee
`pin_hash` con el cliente de usuario (la lista nombra columnas; la sesión del
operario usa service_role con columnas nombradas) ni llama símbolos nuevos.
Antes de 0475, el reintento de la app nunca ve un P0018; después de 0475, la app
de hoy muestra el mensaje de la base. **Recomendado:** fusionar y desplegar la PR
primero (con su autorización), y aplicar 0475 después, con OK nominal de Sam,
fuera de la ventana del corte del jueves 2026-10-15 en la noche.

## Smoke propuesto después de aplicar

1. Studio › Operarios como **admin** y como **operations**: la lista carga igual.
2. Restablecer PIN → «Generar PIN nuevo»: se muestra una vez; entrar a `/m/cn` (o
   `/m/ve`) con ese PIN funciona y con el anterior no.
3. Alta de un operario escribiendo el PIN de otro operario activo de la misma
   región: el cajón muestra «Ese PIN ya lo usa otro operario activo de la misma
   región…» en el campo PIN y no se crea.
4. Catálogo, sin filas: `has_column_privilege('authenticated','public.operario_pins','pin_hash','select') = f`.
5. El evento del paso 2 (`operario_pin_reset`) existe: leerlo es una fila de
   negocio; con OK de Sam o desde el visor de auditoría del Studio.

## Impacto documental y conocimiento

- Canónico actualizado: la spec 0515 y el índice de specs. Sin cambios en
  runbooks ni en `docs/architecture/module-sdd-map.md` (la fila de Operarios la
  agrega quien cierre la SDD, como anotó 0513).
- `pnpm knowledge:status` al cerrar: `ok: false` — `graph_missing_or_invalid`
  (este worktree nuevo no tiene `graphify-out/graph.json`), estructural y
  semántico INVALID, Archify `ARCHIFY_RUNTIME_MISSING`, Obsidian PENDING. No se
  reconstruyó el grafo (corrida pesada; el Director publica desde main) ni se
  generó preview. Recibos semánticos: ninguna fuente del piloto modificada.

## HANDOFF AL DIRECTOR

- Revisar la PR draft (diff completo, la migración y su contrato) y correr el
  contrato con Docker si da el turno.
- Leer el preflight en producción con las consultas de arriba y pedir a Sam el OK
  nominal de `0475_pin_operarios_endurecer`, con las cinco decisiones de la spec.
- Cambios compartidos: `lib/studio/operario-pin.ts` y el generador (de SDD-0513)
  ganan el reintento; nadie más los consume. `rbac-actions-guard.test.ts` no
  cambió (no hay actions nuevas).
- Sin otras sesiones consumidoras de este worktree. Ownership liberado al cerrar.
