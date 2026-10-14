# Handoff · SDD-0515 · PIN de operarios endurecido

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 |
| Task ID | pin-operarios-endurecer |
| Owner | subagente Worker del Director (claim `pin-operarios-endurecer-worker`, liberado al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-ae87abaf4a23e67ee` |
| Rama | `codex/pin-operarios-endurecer` |
| Base | `origin/main`, traída con merge tres veces: `ad959bca` (#210), `4c4c6c17` (#211, merge `e0bd8ea4` publicado por el Director) y `d28fa515` (#213) |
| SDD | [0515](../../docs/specs/0515-pin-operarios-endurecer/spec.md) · `in-progress` |
| Migración | `0475_pin_operarios_endurecer.sql` · **NO APLICADA** · espera en `pendingBelowCutoff` |
| PR | draft #212: https://github.com/hailuwaycom-sketch/DTDCARGO/pull/212 |
| Estado de tarea | lista-para-revision (PR draft) |

## OBJETIVO ORIGINAL

Endurecer en la base el PIN de los operarios de `/m/cn` y `/m/ve` en una sola
migración (0475): que el personal no lea `pin_hash`; auditar cada
restablecimiento en la misma transacción, sin el PIN (AUD-01); rechazar PIN
repetidos entre operarios activos del mismo tenant y región, con reintento de la
app; corregir el voseo del validador. Ampliaciones del Director con decisiones de
Sam: (1) la base autoriza con la matriz de módulos, como `moduleEditDenial`; (2)
PIN recuperable cifrado con una clave de Vault y botón «Ver PIN» auditado; (3)
motivo obligatorio para restablecer, crear y ver; (4) defaults (a)-(e): editar y
desactivar por la matriz en otra SDD, reactivar exige PIN nuevo, la fuga de P0018
queda moot, `service_role` sin lectura de credenciales, alta generada en el
servidor sin `Math.random`.

## COMPLETADO

- **0475**: policy SELECT por matriz y SELECT por columna sin `pin_hash` ni
  `pin_cifrado` para `authenticated` y `service_role` (que además pierde INSERT y
  el UPDATE de credenciales); `operarios_module_authorized`; columna
  `pin_cifrado` (bytea, `pgp_sym_encrypt` AES-256) con la clave
  `operario_pin_key` creada en Vault por la migración; helpers privados
  `operario_pin_cifrar`, `operario_pin_descifrar`, `operario_motivo_valido` y
  `operario_pin_assert_available`; `admin_create_operario` y
  `admin_reset_operario_pin` con firma nueva (`p_motivo`; `p_reactivar`) y las
  firmas viejas quitadas; `admin_ver_operario_pin` (matriz en edición, motivo,
  `pin_visto`, `NULL` para PIN anterior); `admin_set_operario_active` ya no
  reactiva (P0019); entidad `operario`; validador con «Elige». Preflight
  re-aplicable y postflight.
- **Contrato** `supabase/tests/0475_pin_operarios_endurecer.test.sql`: «TEST 0475
  GREEN: 148 aserciones», con Vault real o stub (patrón de 0472).
- **PGlite** `lib/studio/__tests__/pin-operarios-endurecer.migration.test.ts`: 70
  pruebas — 6 de texto, contrato, control rojo, 12 preflights, 46 mutantes, 3 de
  propiedad (25 casos rol × desvío contra `moduleViewDenial`/`moduleEditDenial`,
  con «Ver PIN»; el mutante del rol a mano rompe exactamente 6) y el espejo del
  motivo contra la función SQL real.
- **App**: «Ver PIN» (`PinViewDialog`, `viewOperarioPinAction`); motivo en el
  cajón de restablecer y en el alta (`MotivoField`); alta con PIN generado en el
  servidor con reintento ante P0018 o escrito a mano (sin `Math.random`); toggle de
  un operario de baja abre «Reactivar» (`ResetPinDrawer reactivar`);
  `PinRevealBlock` compartido; inventario de actions 429 → 430;
  `admin_ver_operario_pin` declarado en el gate de símbolos (AMARILLO).
- Spec 0515 reescrita (decisiones literales, diseño, seguridad, allowlist,
  gobernanza, revisión de datos, riesgos); espera del baseline actualizada.

Criterios 1-11 cumplidos en local; el 12 (aplicación + smoke) queda pendiente.

## VALIDACIÓN

Sobre la rama con el merge de `d28fa515`, antes del commit que contiene este
documento. Windows, PGlite 0.5.8 (PostgreSQL 18.3), Vitest 4.1.7.

| Comprobación | Resultado |
|---|---|
| Contrato SQL en PGlite (corredor de scratchpad) | PASÓ · «TEST 0475 GREEN: 148 aserciones»; control rojo cae en «authenticated no tiene SELECT sobre pin_hash» |
| `vitest run` de 11 archivos: la prueba PGlite de 0475, `operario-pin.migration`, `operario-pin`, `app/studio/(app)/operarios` (actions + 3 de UI), `spec-migration-refs`, `rbac-actions-guard`, `rbac`, `rbac-action-scan` | PASÓ · 711/711 (`pin-operarios-endurecer.migration` 70, `reset-pin-actions` 60, `ResetPinDrawer` 15, `NewOperarioDrawer` 5, `PinViewDialog` 5, `operario-pin` 24, `operario-pin.migration` 5, `rbac-actions-guard` 435, `rbac` 36, `rbac-action-scan` 51, `spec-migration-refs` 5) |
| Mutantes de la app (scratchpad, 16) | PASÓ · los 16 mueren; control verde 84/84 |
| `tsc --noEmit -p tsconfig.json` | PASÓ · exit 0 |
| `eslint` de los 16 archivos TS/TSX tocados | PASÓ · exit 0 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ · «0 ROJO · 1 AMARILLO declarado(s)» (`admin_ver_operario_pin`) |
| `node scripts/check-numbering.mjs` | PASÓ · «sin números repetidos» |
| `node scripts/build-docs-index.mjs --check` | PASÓ · 502 specs |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ · 28 políticas, cápsula vigente |
| `git diff --check` (árbol y `origin/main` → HEAD) | PASÓ |
| `node scripts/knowledge-sync.mjs status` | `ok: false` — ver «Impacto documental» |
| `check-migrations-applied` | NO DISPONIBLE · SKIP sin `.env.local` |
| Contrato con psql en Docker, `check-schema-rebuild`, `pnpm verify` | NO EJECUTADO · turno del Director |
| Carrera de dos conexiones sobre el advisory lock | NO EJECUTADO · PGlite tiene una conexión |
| `/ui-check` (rúbrica liviana, inline) | ver abajo |

### /ui-check · diff de Operarios

Hallazgos (3):
1 ⭐ [media] `OperariosClient.tsx:32` — la columna de acciones pasó a 290 px
  **estimados** para «Ver PIN», «Restablecer PIN» y el lápiz; con `nowrap` un
  desborde se ve, pero hay que medirlo en navegador con la tipografía real.
2 [baja] `PinViewDialog.tsx` — la sombra `rgba(0,0,0,0.18)` y el velo con
  fallback `rgba` copian los del `ConfirmDialog`; no hay token de sombra de modal.
3 [baja] `OperariosClient.tsx` — la perilla del toggle sigue en `#FFFFFF`
  (preexistente, sólo se movió a una función).
✅ Lo que está bien: componentes del sistema (`ConfirmDialog`, `DrawerShell`,
`SegmentedControl`, `ErrorAlert`, `useDialogA11y`); una primaria por diálogo;
estados deshabilitado/cargando/error; etiquetas y `aria-describedby`; foco en
«Cerrar» al mostrar el PIN; nombres accesibles con el operario en cada botón de
fila; copy en tuteo, sin voseo.
Veredicto: OK con ajustes menores (no bloqueante).

## COMMITS

- `546c1d1b` — migración 0475 inicial, contrato, PGlite, baseline.
- `b5cb54bd` — reintento del PIN generado (primera versión).
- `fa3976cc`, `a9eefd31` — spec, índice y handoff de la primera versión.
- `e0bd8ea4` — merge de `origin/main` (#211), publicado por el Director.
- `37000da9` — 0475 con «Ver PIN» auditado, motivo obligatorio y reactivación.
- `f0743e1b` — app: «Ver PIN», motivo, alta generada en el servidor, reactivar.
- `a93ffb1d` — merge de `origin/main` `d28fa515` (#213).
- commit que contiene este documento — spec, índice y handoff.

## PR / BRANCH

PR draft #212 contra `main` desde `codex/pin-operarios-endurecer`:
https://github.com/hailuwaycom-sketch/DTDCARGO/pull/212. Worktree arriba.

## PENDIENTES DE ESTA TAREA

1. **Lecturas READ ONLY de producción** (las corre el Director, abajo).
2. **OK nominal de Sam** para aplicar `0475_pin_operarios_endurecer`, MIGRATE-FIRST
   y desplegar enseguida, fuera de la ventana del corte (jueves 2026-10-15 noche).
3. **Smoke después de aplicar** (abajo); retirar la espera del baseline y la
   declaración del gate de símbolos; la spec pasa a `done` recién ahí.
4. Turno del Director para el contrato con Docker (Vault real), `check-schema-rebuild`
   y, si lo pide, `pnpm verify`.
5. Medir en navegador el ancho de la columna de acciones (hallazgo 1 del `/ui-check`).

## FUERA DE ALCANCE DETECTADO

- `admin_set_operario_active` y `admin_update_operario` siguen con `admin|operations`
  escrito a mano y sin auditoría de desactivar/editar (default a: SDD aparte). Con
  un desvío, la matriz y la base no coinciden para editar y desactivar, y
  `setOperarioActiveAction` ignora el error en silencio.
- La spec 0513 sigue con su criterio 5 «PENDIENTE»: lo resuelve 0475 al aplicarse.
  Su texto del revelado («no se vuelve a mostrar») quedó superado por «Ver PIN».
- Los PIN anteriores a 0475 no se pueden ver hasta restablecerlos; los
  duplicados que ya existan en producción no se pueden detectar.

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
  to_regprocedure('public.admin_set_operario_active(uuid,boolean)'),
  to_regprocedure('public.validate_operario_pin_format(text)'),
  to_regprocedure('public.get_user_tenant_id()'),
  to_regprocedure('public.assert_tenant_match(uuid)'),
  to_regprocedure('public.verify_operario_pin(text,uuid,public.operario_region,text)'),
  to_regprocedure('public.append_audit_event(uuid,text,uuid,text,uuid,text,text,text,text,jsonb,jsonb,jsonb,text,integer,text)'));

-- 2. Lo nuevo todavía no existe y no hay sobrecargas (esperado: 6 NULL y 2).
select to_regprocedure('public.operarios_module_authorized(uuid,text)'),
       to_regprocedure('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)'),
       to_regprocedure('public.operario_pin_cifrar(text)'),
       to_regprocedure('public.operario_pin_descifrar(bytea)'),
       to_regprocedure('public.operario_motivo_valido(text,text)'),
       to_regprocedure('public.admin_ver_operario_pin(uuid,text)');
select count(*) from pg_proc
where pronamespace = 'public'::regnamespace
  and proname in ('admin_create_operario', 'admin_reset_operario_pin', 'admin_ver_operario_pin');

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
  has_table_privilege(r.rol, 'public.operario_pins', 'TRUNCATE') as trunc,
  has_column_privilege(r.rol, 'public.operario_pins', 'pin_hash', 'SELECT') as pin_hash
from (values ('anon'), ('authenticated'), ('service_role')) r(rol);

-- 4. Policies de operario_pins, con la forma normalizada que compara el preflight.
select polname, polcmd, polpermissive, polroles::regrole[],
       pg_get_expr(polqual, polrelid) as using_vivo,
       regexp_replace(replace(coalesce(pg_get_expr(polqual, polrelid), ''), 'public.', ''), '[\s()]', '', 'g') as normalizada
from pg_policy where polrelid = 'public.operario_pins'::regclass;

-- 5. pgcrypto en extensions y Vault (sin leer ningún secreto).
select to_regprocedure('extensions.pgp_sym_encrypt(text,text,text)'),
       to_regprocedure('extensions.pgp_sym_decrypt(bytea,text)'),
       to_regprocedure('extensions.gen_random_bytes(integer)'),
       to_regprocedure('extensions.crypt(text,text)');
select extname, extversion from pg_extension where extname in ('pgcrypto', 'supabase_vault', 'pgsodium');
select to_regclass('vault.decrypted_secrets'),
       (select string_agg(pg_get_function_identity_arguments(p.oid), ' | ')
          from pg_proc p where p.pronamespace = to_regnamespace('vault') and p.proname = 'create_secret');
select name, created_at from vault.secrets
where name in ('operario_pin_key', 'kommo_cron_key', 'kommo_token_dtd_v1') order by name;
-- ¿postgres puede leer la vista que usarán las funciones? Sólo el conteo, nunca el valor.
select count(*) from vault.decrypted_secrets where name = 'kommo_cron_key';

-- 6. Enum, overrides (forma, no filas) y catálogo de auditoría.
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
| `admin_create_operario(uuid,uuid,text,text,text,text)` | md5 `f7e89f156817fc3d30eb4635090b0603` (0351) · DEFINER · `v` · `{"search_path=public, extensions"}` · EXECUTE authenticated sí, anon no |
| `admin_reset_operario_pin(uuid,text)` | md5 `ea358b166dbd5c90dff337d473649da3` (0351) · igual que arriba |
| `admin_set_operario_active(uuid,boolean)` | md5 `9981fa8486c2e32e53ad4f805703a0dc` (0351) · DEFINER · `v` · `{search_path=public}` · EXECUTE authenticated sí, anon no |
| `validate_operario_pin_format(text)` | md5 `62f64d916edf371cb7a2b8d4b784c18d` (0037) · INVOKER · `i` · `{search_path=public}` |
| `get_user_tenant_id()` | md5 `5ff0c51c26a49419c34abc78f1d95c37` (0453; el mismo que midió 0456) · DEFINER · `s` · `{"search_path=\"\""}` |
| `assert_tenant_match(uuid)` | md5 `bf5e898bc3a6209c0a5dc75f89ba9333` (0012) · DEFINER · `v` · `{search_path=public}` |
| `verify_operario_pin(...)` | md5 `99c5f3e9eaae92bfe3987e1377d4734f` (0325) · DEFINER · `v` · `{"search_path=public, extensions"}` |
| `append_audit_event(...)` | DEFINER · owner `postgres` · `{"search_path=\"\""}` · sin EXECUTE de authenticated |
| lo nuevo | las 6 funciones NULL; conteo de sobrecargas = 2 |
| columnas | `{active,created_at,display_name,display_name_cn,id,last_login_at,pin_hash,region,role,roles,tenant_id,tms_driver_id,updated_at,warehouse_id}` (sin `pin_cifrado`) · sin ACL por columna |
| RLS | `relrowsecurity = t`, `relforcerowsecurity = f` |
| privilegios | anon: todo `f`; authenticated: sólo `sel = t` (y `pin_hash = t`, el defecto); service_role: sel, ins, upd y del `t` |
| policies | **una sola**: «operario_pins select by admin of tenant», `r`, permisiva, `{authenticated}`, normalizada `tenant_id=get_user_tenant_id` |
| pgcrypto | las 4 funciones no NULL (en `extensions`) |
| Vault | `vault.decrypted_secrets` existe; existe `vault.create_secret`; **sin** `operario_pin_key` en `vault.secrets`; el conteo de `kommo_cron_key` es 1 (postgres lee la vista) |
| enum | `{cn,ve}` |
| overrides | `studio_role_module_overrides_pkey` = `PRIMARY KEY (tenant_id, role, module_id)`; `…_edit_implies_view` = `CHECK (((NOT can_edit) OR can_view))`; `…_role_check` con los 6 roles; las dos escrituras `f` |
| catálogo | sin fila `operario` |

Opcional, con autorización de Sam porque lee filas (metadatos de permisos, no PII):
`select role, can_view, can_edit, count(*) from public.studio_role_module_overrides
where module_id = 'operarios' group by 1, 2, 3;` — si un tenant ya tiene un desvío
de Operarios, la vista, la edición y «Ver PIN» cambian en el momento de aplicar.

## Orden de despliegue

**MIGRATE-FIRST y desplegar enseguida.** Las RPC de alta y restablecimiento
cambian de firma (motivo) y la app nueva llama a `admin_ver_operario_pin`:

- con la app nueva y sin 0475, alta, restablecimiento y «Ver PIN» fallan con un
  error de PostgREST, sin cambiar nada (declarado en el gate de símbolos);
- con 0475 y la app de antes, alta y restablecimiento responden «Escribe el
  motivo: entre 4 y 300 caracteres.» hasta el despliegue.

Secuencia: OK nominal → aplicar 0475 (runbook, una transacción con la fila del
ledger) → postflight → fusionar y desplegar la PR → smoke. Fuera de la ventana del
corte del jueves 2026-10-15 en la noche.

## Smoke propuesto después de aplicar y desplegar

1. Studio › Operarios como **admin** y como **operations**: la lista carga igual.
2. «Ver PIN» de un operario anterior: pide motivo y muestra «Este PIN es anterior
   al cambio: restablécelo una vez para poder verlo.»
3. «Restablecer PIN» con motivo → se muestra el PIN nuevo; `/m/cn` (o `/m/ve`)
   entra con ese PIN y no con el anterior.
4. «Ver PIN» del mismo operario con motivo: muestra ese PIN; al cerrar desaparece.
5. Alta de un operario con PIN generado y motivo: se muestra el PIN y entra.
6. Desactivar a un operario y tocar su toggle: abre «Reactivar»; con motivo,
   vuelve activo con un PIN nuevo que entra.
7. Catálogo, sin filas: `has_column_privilege('authenticated','public.operario_pins','pin_hash','select') = f`
   y lo mismo para `pin_cifrado`; `operario_pin_key` existe en `vault.secrets`.
8. Los eventos (`operario_pin_reset`, `pin_visto`, `operario_created`,
   `operario_reactivated`) son filas de negocio: con OK de Sam o desde el visor de
   auditoría del Studio.

## Datos personales y credenciales (`/revisar-datos-ve`)

Advisory; resultado completo en la spec. ENCONTRADO con riesgo aceptado por Sam:
PIN recuperable y pérdida de valor probatorio de las acciones del operario.
CORRECTO: nada de la API lee `pin_hash`/`pin_cifrado`; el PIN no va a logs,
tablas ni al navegador; el motivo no puede llevar el PIN. NO VERIFICABLE: dónde
vive la raíz de Vault del servidor propio y si viaja con los respaldos; duplicados
existentes en producción.

## Impacto documental y conocimiento

- Canónico actualizado: spec 0515 e índice de specs. Sin cambios en runbooks ni en
  `docs/architecture/module-sdd-map.md` (la fila de Operarios la agrega quien
  cierre la SDD).
- `pnpm knowledge:status`: `ok: false` en este worktree — sin
  `graphify-out/graph.json` (`graph_missing_or_invalid`), estructural y semántico
  INVALID, Archify `ARCHIFY_RUNTIME_MISSING`, Obsidian PENDING. No se reconstruyó
  el grafo (corrida pesada; el Director publica desde main) ni se generó preview.
  Ninguna fuente del piloto semántico modificada.

## HANDOFF AL DIRECTOR

- Revisar la PR draft #212 (la migración, su contrato y la app), correr el
  contrato con Docker y `check-schema-rebuild` si da el turno.
- Correr las lecturas de preflight y pedir a Sam el OK nominal de
  `0475_pin_operarios_endurecer`, con las tres decisiones abiertas de la spec
  (reautenticación para «Ver PIN», rotación de la clave, retención del motivo).
- Cambios compartidos: `lib/studio/operario-pin.ts` y el generador ganan el
  reintento y el motivo; sólo los consume el módulo Operarios.
- Sin otras sesiones consumidoras de este worktree. Ownership liberado al cerrar.
