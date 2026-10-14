# Handoff · SDD-0515 · PIN de operarios endurecido

| Campo | Valor |
|---|---|
| Fecha | 2026-10-14 |
| Task ID | pin-operarios-endurecer |
| Owner | subagente Worker del Director (claim `pin-operarios-endurecer-worker`, liberado al cerrar) |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTDCARGO\.claude\worktrees\agent-ae87abaf4a23e67ee` |
| Rama | `codex/pin-operarios-endurecer` |
| Base | `origin/main`, traída con merge cuatro veces: `ad959bca` (#210), `4c4c6c17` (#211, merge `e0bd8ea4` publicado por el Director), `d28fa515` (#213) y `3086befb` (#214, merge `df665e98`) |
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
motivo obligatorio para restablecer, crear y ver; (4) defaults (a)-(e); (5) el
drift del validador leído en producción; (6) «Ver PIN» pide la contraseña y la
base lo exige con el `amr`; (7) el motivo es una lista fija con texto sólo para
«Otro»; (8) rotación de la clave sólo ante sospecha o salida, documentada; (9)
el hallazgo de producción: la app de login por región en cada fila y en el PIN,
la descripción de la página y la columna «Rol».

## COMPLETADO

- **0475**: todo lo anterior, más:
  - `operario_password_reciente()`: `admin_ver_operario_pin` exige en
    `auth.jwt()->'amr'` un `{"method": "password"}` con `timestamp` entre hace
    300 s y dentro de 60 s; si no, P0022 «Confirma tu contraseña para ver el
    PIN.» sin evento. La matriz va antes; restablecer no la pide. El preflight
    aborta si falta `auth.jwt()`.
  - `operario_motivo_valido(codigo, texto, pin)`: `olvido`, `empleado_nuevo`,
    `revision_seguridad` u `otro` con texto de 4 a 200 sin el PIN (P0020). Firmas
    nuevas: `admin_create_operario(uuid,uuid,text,text,text,text,text,text)`,
    `admin_reset_operario_pin(uuid,text,text,text,boolean)`,
    `admin_ver_operario_pin(uuid,text,text)`. Evento: el código en
    `payload.motivo`; en `reason`, el código o el texto de «Otro». En «Ver PIN» el
    motivo se valida antes de buscar el PIN (también para PIN anteriores e ids
    inexistentes) y otra vez con el PIN descifrado.
  - Validador: el preflight acepta el cuerpo vivo (`2c22a7b2…`) y el del repo
    (`62f64d91…`), aborta con un tercero, e instala la lista de 24 con «Elige».
    El drift está descrito en la cabecera (punto 6) y en la spec.
  - `service_role`: la ACL viva `arwdDxtm` es compatible con el preflight (exige
    DELETE; no mira TRUNCATE/REFERENCES/TRIGGER/MAINTAIN), y 0475 los deja como
    están; el contrato los reproduce.
- **App**:
  - `lib/db/password-confirmed.ts` (nuevo): `withPasswordConfirmedClient` abre
    una sesión con `signInWithPassword` en un cliente de `supabase-js` con
    `persistSession: false`, comprueba que sea el mismo usuario, corre la RPC con
    ese cliente y cierra la sesión con `signOut({ scope: "local" })` en un
    `finally`. `viewOperarioPinAction(formData)` lo usa; la contraseña no se
    recorta, no se registra y no vuelve en el resultado; P0022 y los fallos de
    Auth van al campo de la contraseña.
  - `PinViewDialog`: formulario propio (motivo + contraseña no controlada), borra
    la contraseña del campo tras cada respuesta, foco en el campo con error.
  - `MotivoField`: lista + texto de «Otro»; mismo campo en alta,
    restablecimiento y «Ver PIN».
  - Región: «Entra por dtdcargo.com/m/<región>/login» bajo cada nombre;
    `PinRevealBlock` con la ruta completa y «Copiar enlace» (alta → `cn`);
    descripción de la página con las dos apps. Rol: `operarioRolLabel` con los
    cuatro roles (`OperarioRow.role` ampliado; `EditOperarioDrawer` sólo cambia el
    tipo).
- **Docs**: spec 0515 (decisiones 5-7 literales, drift, hallazgo, diseño de la
  contraseña y del `amr`, rotación, seguridad, allowlist, gobernanza, revisión de
  datos, riesgos), `docs/runbooks/servidor-contabo.md` § 6 (rotación de
  `operario_pin_key`), espera del baseline y declaración del gate actualizadas.

Criterios 1-13 cumplidos en local; el 14 (aplicación + smoke) queda pendiente.

### ¿Se comprobó que el Supabase propio emite `amr`?

**En el código, sí; con un JWT vivo, no.** El servidor corre
`supabase/gotrue:v2.197.0` (`infra/dtd-cargo/compose.supabase.yml`). En el código
de esa etiqueta (leído con `gh api` sobre `supabase/auth`): el access token lleva
`amr` como lista de `{method, timestamp}` (`internal/models/sessions.go`,
`AMREntry`), el inicio con contraseña registra `password` y
`CalculateAALAndAMR` usa como `timestamp` la hora Unix del registro;
`internal/hooks/v0hooks/v0hooks.go` define el mismo campo para el hook de claims,
y el compose no configura ningún `GOTRUE_HOOK_*`. El smoke 3 lo prueba de punta a
punta: si el `amr` no llegara, «Ver PIN» respondería siempre «Confirma tu
contraseña para ver el PIN.» y no mostraría nada (falla cerrado). No hizo falta
proponer otra vía.

## VALIDACIÓN

Sobre `5183b61b`/`2df48c8b` (antes del merge de `3086befb`, que sólo trajo docs;
después del merge se repitieron las comprobaciones de docs, numeración, símbolos y
`diff --check`). Windows, PGlite 0.5.8 (PostgreSQL 18.3), Vitest 4.1.7.

| Comprobación | Resultado |
|---|---|
| Contrato SQL en PGlite (corredor de scratchpad) | PASÓ · «TEST 0475 GREEN: 170 aserciones»; control rojo cae en «authenticated no tiene SELECT sobre pin_hash» |
| `vitest run` de 15 archivos (`--reporter=verbose`) | PASÓ · 804/804: `pin-operarios-endurecer.migration` 83, `operario-pin.migration` 5, `operario-pin` 37, `reset-pin-actions` 80, `ResetPinDrawer` 20, `PinViewDialog` 12, `OperariosClient` 8, `NewOperarioDrawer` 5, `rbac-actions-guard` 435, `rbac` 36, `rbac-action-scan` 51, `external-effect-boundaries-contract` 10, `spec-migration-refs` 5, `lib/db` (`paginate` 8, `session-cookie` 9) |
| Primera corrida del mismo lote | FALLÓ 1/804 · `NewOperarioDrawer` «muestra el PIN…»: el test buscaba el diálogo antes de que llegara la vista de éxito y se quedaba con el del formulario (carrera con la máquina cargada). Corregido en el test (busca primero «Operario creado»); segunda corrida verde |
| Mutantes de la app (scratchpad, 34: reintento, motivo, «Ver PIN», sesión efímera, diálogo, región y rol) | PASÓ · los 34 mueren; control verde 162/162 |
| Mutantes de la migración (dentro de la prueba PGlite) | PASÓ · 55 «muere donde debe» (los 54 de la lista más el del rol escrito a mano de la prueba de propiedad), incluidos los nuevos de la contraseña y del motivo de «Ver PIN» |
| `tsc --noEmit -p tsconfig.json` | PASÓ · exit 0 |
| `eslint` de `app/studio/(app)/operarios`, `lib/db/password-confirmed.ts`, `operario-pin.ts`, `operario-queries.ts` y las dos pruebas de `lib/studio/__tests__` | PASÓ · exit 0 |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ · «0 ROJO · 1 AMARILLO declarado(s)» (`admin_ver_operario_pin` en `actions.ts:307`, evidencia `:321`) |
| `node scripts/check-numbering.mjs` | PASÓ · «sin números repetidos» |
| `node scripts/build-docs-index.mjs --check` | PASÓ · 502 specs (también tras el merge) |
| `node scripts/build-governance-capsule.mjs --check` | PASÓ · 28 políticas, cápsula vigente |
| `git diff --check` (árbol y `origin/main...HEAD`) | PASÓ |
| `node scripts/knowledge-sync.mjs status` | `ok: false` — ver «Impacto documental» |
| `check-migrations-applied` | NO DISPONIBLE · SKIP sin `.env.local` |
| Contrato con psql en Docker, `check-schema-rebuild`, `pnpm verify` | NO EJECUTADO · turno del Director |
| Carrera de dos conexiones sobre el advisory lock | NO EJECUTADO · PGlite tiene una conexión |
| `amr` con un JWT vivo del servidor propio | NO EJECUTADO · lo cubre el smoke 3 |

### /ui-check · diff de Operarios

Hallazgos (4):
1 ⭐ [media] `OperariosClient.tsx` — la línea «Entra por …» bajo el nombre y la
  columna de acciones (290 px) no se midieron en navegador; con `nowrap` y
  `ellipsis` un desborde se ve, pero hay que mirarlo con la tipografía real.
2 [baja] `PinViewDialog.tsx` — el paso de motivo y contraseña es un formulario
  propio con la estructura de `ConfirmDialog` (que sólo admite un campo de
  texto); la sombra y el velo con fallback `rgba` copian los suyos.
3 [baja] `MotivoField.tsx` — el `select` arranca en «Elige un motivo»
  (deshabilitada); el botón espera un código válido.
4 [baja] `OperariosClient.tsx` — la perilla del toggle sigue en `#FFFFFF`
  (preexistente).
✅ Lo que está bien: una primaria por diálogo y Cancelar a la izquierda;
`type="password"` con `autocomplete="current-password"`; errores en su campo con
`aria-invalid`, `role="alert"` y foco; estados de carga («Confirmando…»); nombres
accesibles; «Copiar enlace» con su propio `role="status"`; copy en tuteo, sin
voseo.
Veredicto: OK con ajustes menores (no bloqueante).

## COMMITS

- `546c1d1b` — migración 0475 inicial, contrato, PGlite, baseline.
- `b5cb54bd` — reintento del PIN generado (primera versión).
- `fa3976cc`, `a9eefd31` — spec, índice y handoff de la primera versión.
- `e0bd8ea4` — merge de `origin/main` (#211), publicado por el Director.
- `37000da9` — 0475 con «Ver PIN» auditado, motivo obligatorio y reactivación.
- `f0743e1b` — app: «Ver PIN», motivo, alta generada en el servidor, reactivar.
- `a93ffb1d` — merge de `origin/main` `d28fa515` (#213).
- `a6586a82` — spec y handoff de esa vuelta.
- `67594aab` — 0475: contraseña reciente, motivo de la lista, validador vivo.
- `5183b61b` — app: «Ver PIN» con contraseña, motivo de la lista, región y rol.
- `2df48c8b` — spec, runbook (rotación) e índice.
- `df665e98` — merge de `origin/main` `3086befb` (#214).
- commit que contiene este documento — handoff.

## PR / BRANCH

PR draft #212 contra `main` desde `codex/pin-operarios-endurecer`:
https://github.com/hailuwaycom-sketch/DTDCARGO/pull/212. Worktree arriba.

## PENDIENTES DE ESTA TAREA

1. **Lecturas READ ONLY de producción** actualizadas (las corre el Director, abajo).
2. **OK nominal de Sam** para aplicar `0475_pin_operarios_endurecer`, MIGRATE-FIRST
   y desplegar enseguida, fuera de la ventana del corte (jueves 2026-10-15 noche).
3. **Smoke después de aplicar** (abajo; el 3 comprueba el `amr`); retirar la
   espera del baseline y la declaración del gate de símbolos; la spec pasa a
   `done` recién ahí.
4. Turno del Director para el contrato con Docker (Vault real), `check-schema-rebuild`
   y, si lo pide, `pnpm verify`.
5. Medir en navegador la fila con «Entra por …» y la columna de acciones
   (hallazgo 1 del `/ui-check`).

## FUERA DE ALCANCE DETECTADO

- `admin_set_operario_active` y `admin_update_operario` siguen con `admin|operations`
  escrito a mano y sin auditoría de desactivar/editar (default a: SDD aparte). Con
  un desvío, la matriz y la base no coinciden para editar y desactivar, y
  `setOperarioActiveAction` ignora el error en silencio.
- **Editar un operario de Venezuela no funciona desde el Studio.**
  `EditOperarioDrawer` exige warehouse (los de Venezuela no tienen: el botón queda
  deshabilitado), su selector de rol sólo ofrece Operario y Supervisor, y
  `updateOperarioAction` rechaza otro rol. Si algún día un operario de Venezuela
  tuviera warehouse, guardar le cambiaría el rol a «operario» sin avisar. Va con la
  SDD de editar por la matriz.
- La spec 0513 sigue `in-progress` con su criterio 5 pendiente: lo resuelve 0475
  al aplicarse (su «Seguimiento» de main ya lo dice).
- Los PIN anteriores a 0475 no se pueden ver hasta restablecerlos; los
  duplicados que ya existan en producción no se pueden detectar.

## Lecturas de preflight para el Director (producción, READ ONLY, sin filas de negocio)

Si un valor no coincide, **no aplicar**: el preflight abortaría igual; avisar con
el valor leído. Cambios desde la vuelta anterior: el validador acepta dos md5,
las funciones nuevas cambian de firma, se suma `auth.jwt()` y la ACL de
`service_role` es la que leíste (`arwdDxtm`).

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

-- 1b. auth.jwt(), de la que lee la contraseña reciente (esperado: no NULL).
select to_regprocedure('auth.jwt()');

-- 2. Lo nuevo todavía no existe y no hay sobrecargas (esperado: 7 NULL y 2).
select to_regprocedure('public.operarios_module_authorized(uuid,text)'),
       to_regprocedure('public.operario_pin_assert_available(uuid,public.operario_region,text,uuid)'),
       to_regprocedure('public.operario_pin_cifrar(text)'),
       to_regprocedure('public.operario_pin_descifrar(bytea)'),
       to_regprocedure('public.operario_motivo_valido(text,text,text)'),
       to_regprocedure('public.operario_password_reciente()'),
       to_regprocedure('public.admin_ver_operario_pin(uuid,text,text)');
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
-- Con varios privilegios en la lista, has_table_privilege da t si tiene CUALQUIERA.
select has_table_privilege('authenticated', 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE') as auth_escribe,
       has_table_privilege('anon', 'public.studio_role_module_overrides', 'INSERT, UPDATE, DELETE, TRUNCATE') as anon_escribe;
select entity_type, status, domain_code, introduced_by_ref from public.audit_entity_types where entity_type = 'operario';
```

En el servidor, sin valores: que el contenedor de Auth no tenga hooks que puedan
reescribir el `amr` (sólo nombres de variables):
`docker exec dtd-cargo-auth-1 env | cut -d= -f1 | grep '^GOTRUE_HOOK' || echo sin-hooks`
(el nombre del contenedor sigue el patrón de `dtd-cargo-db-1`; confirmarlo con
`docker ps --format '{{.Names}}'`), y la imagen con
`docker inspect -f '{{.Config.Image}}' dtd-cargo-auth-1` (esperado
`supabase/gotrue:v2.197.0`).

Valores que el preflight exige:

| Lectura | Valor esperado |
|---|---|
| `admin_create_operario(uuid,uuid,text,text,text,text)` | md5 `f7e89f156817fc3d30eb4635090b0603` (0351) · DEFINER · `v` · `{"search_path=public, extensions"}` · EXECUTE authenticated sí, anon no |
| `admin_reset_operario_pin(uuid,text)` | md5 `ea358b166dbd5c90dff337d473649da3` (0351) · igual que arriba |
| `admin_set_operario_active(uuid,boolean)` | md5 `9981fa8486c2e32e53ad4f805703a0dc` (0351) · DEFINER · `v` · `{search_path=public}` · EXECUTE authenticated sí, anon no |
| `validate_operario_pin_format(text)` | md5 `2c22a7b2b639e69464ced0e77173bbaf` (el vivo que leíste) **o** `62f64d916edf371cb7a2b8d4b784c18d` (0037) · INVOKER · `i` · `{search_path=public}` |
| `get_user_tenant_id()` | md5 `5ff0c51c26a49419c34abc78f1d95c37` (0453; el mismo que midió 0456) · DEFINER · `s` · `{"search_path=\"\""}` |
| `assert_tenant_match(uuid)` | md5 `bf5e898bc3a6209c0a5dc75f89ba9333` (0012) · DEFINER · `v` · `{search_path=public}` |
| `verify_operario_pin(...)` | md5 `99c5f3e9eaae92bfe3987e1377d4734f` (0325) · DEFINER · `v` · `{"search_path=public, extensions"}` |
| `append_audit_event(...)` | DEFINER · owner `postgres` · `{"search_path=\"\""}` · sin EXECUTE de authenticated |
| `auth.jwt()` | no NULL |
| lo nuevo | las 7 funciones NULL; conteo de sobrecargas = 2 |
| columnas | `{active,created_at,display_name,display_name_cn,id,last_login_at,pin_hash,region,role,roles,tenant_id,tms_driver_id,updated_at,warehouse_id}` (sin `pin_cifrado`) · sin ACL por columna |
| RLS | `relrowsecurity = t`, `relforcerowsecurity = f` |
| privilegios | anon: todo `f`; authenticated: sólo `sel = t` (y `pin_hash = t`, el defecto); service_role: `sel`, `ins`, `upd`, `del` y `trunc` `t` (ACL `arwdDxtm`, la que leíste; el preflight exige DELETE y no mira TRUNCATE/REFERENCES/TRIGGER/MAINTAIN, que 0475 deja como están) |
| policies | **una sola**: «operario_pins select by admin of tenant», `r`, permisiva, `{authenticated}`, normalizada `tenant_id=get_user_tenant_id` |
| pgcrypto | las 4 funciones no NULL (en `extensions`) |
| Vault | `vault.decrypted_secrets` existe; existe `vault.create_secret`; **sin** `operario_pin_key` en `vault.secrets`; el conteo de `kommo_cron_key` es 1 (postgres lee la vista) |
| enum | `{cn,ve}` |
| overrides | `studio_role_module_overrides_pkey` = `PRIMARY KEY (tenant_id, role, module_id)`; `…_edit_implies_view` = `CHECK (((NOT can_edit) OR can_view))`; `…_role_check` con los 6 roles; `auth_escribe` y `anon_escribe` = `f` |
| catálogo | sin fila `operario` |
| servidor | sin `GOTRUE_HOOK_*`; imagen `supabase/gotrue:v2.197.0` |

Opcional, con autorización de Sam porque lee filas (metadatos de permisos, no PII):
`select role, can_view, can_edit, count(*) from public.studio_role_module_overrides
where module_id = 'operarios' group by 1, 2, 3;` — si un tenant ya tiene un desvío
de Operarios, la vista, la edición y «Ver PIN» cambian en el momento de aplicar.

## Orden de despliegue

**MIGRATE-FIRST y desplegar enseguida.** Las RPC de alta y restablecimiento
cambian de firma (motivo de la lista) y la app nueva llama a
`admin_ver_operario_pin`:

- con la app nueva y sin 0475, alta, restablecimiento y «Ver PIN» fallan con un
  error de PostgREST, sin cambiar nada (declarado en el gate de símbolos; «Ver
  PIN» falla después de confirmar bien la contraseña);
- con 0475 y la app de antes, alta y restablecimiento responden «Elige un motivo
  de la lista.» hasta el despliegue, y «Ver PIN» no existe en esa app.

Secuencia: OK nominal → aplicar 0475 (runbook, una transacción con la fila del
ledger) → postflight → fusionar y desplegar la PR → smoke. Fuera de la ventana del
corte del jueves 2026-10-15 en la noche.

## Smoke propuesto después de aplicar y desplegar

1. Studio › Operarios como **admin** y como **operations**: la lista carga; cada
   fila dice «Entra por dtdcargo.com/m/cn/login» o «…/m/ve/login» según su
   región, y la columna «Rol» dice Bodeguero o Camionero donde corresponde.
2. «Ver PIN» de un operario anterior, con motivo y la contraseña: muestra «Este
   PIN es anterior al cambio: restablécelo una vez para poder verlo.»
3. **El `amr`.** «Ver PIN» con una contraseña equivocada: «Esa contraseña no es la
   tuya…» y nada más. Con la correcta: el paso 2 ya prueba que la base recibió el
   `amr` (sin él, la respuesta sería «Confirma tu contraseña para ver el PIN.»).
4. «Restablecer PIN» con «Se le olvidó» → se muestra el PIN nuevo con «Entra por
   https://dtdcargo.com/m/<región>/login»; esa app entra con ese PIN y no con el
   anterior.
5. «Ver PIN» del mismo operario con «Otro» y un texto: muestra ese PIN y la
   ruta; al cerrar desaparece.
6. Alta de un operario con PIN generado y «Empleado nuevo»: se muestra el PIN con
   `/m/cn/login` y entra.
7. Desactivar a un operario y tocar su toggle: abre «Reactivar»; con motivo,
   vuelve activo con un PIN nuevo que entra.
8. Catálogo, sin filas: `has_column_privilege('authenticated','public.operario_pins','pin_hash','select') = f`
   y lo mismo para `pin_cifrado`; `operario_pin_key` existe en `vault.secrets`.
9. Los eventos (`operario_pin_reset`, `pin_visto`, `operario_created`,
   `operario_reactivated`) son filas de negocio: con OK de Sam o desde el visor de
   auditoría del Studio. Esperado: `payload.motivo` con el código; `reason` con el
   código o el texto de «Otro»; ni PIN ni contraseña.

## Datos personales y credenciales (`/revisar-datos-ve`)

Advisory; resultado completo en la spec. ENCONTRADO con riesgo aceptado por Sam:
PIN recuperable y pérdida de valor probatorio de las acciones del operario.
CORRECTO: nada de la API lee `pin_hash`/`pin_cifrado`; el PIN no va a logs,
tablas ni al navegador; la contraseña sólo viaja a Supabase Auth; el motivo es un
código y sólo «Otro» guarda texto, que no puede llevar el PIN. NO VERIFICABLE:
dónde vive la raíz de Vault del servidor propio y si viaja con los respaldos
(disparador de rotación, runbook § 6); duplicados existentes en producción.

## Impacto documental y conocimiento

- Canónico actualizado: spec 0515, índice de specs y
  `docs/runbooks/servidor-contabo.md` § 6 (rotación de `operario_pin_key`). Sin
  cambios en `docs/architecture/module-sdd-map.md` (la fila de Operarios la
  agrega quien cierre la SDD).
- `node scripts/knowledge-sync.mjs status`: `ok: false` en este worktree — sin
  `graphify-out/graph.json` (`graph_missing_or_invalid`, `graph_empty`). No se
  reconstruyó el grafo (corrida pesada; el Director publica desde main) ni se
  generó preview. Ninguna fuente del piloto semántico modificada.

## HANDOFF AL DIRECTOR

- Revisar la PR draft #212 (la migración, su contrato, la sesión efímera de
  `lib/db/password-confirmed.ts` y la app), correr el contrato con Docker y
  `check-schema-rebuild` si da el turno.
- Correr las lecturas de preflight actualizadas y pedir a Sam el OK nominal de
  `0475_pin_operarios_endurecer`. Las tres decisiones que la spec le hacía a Sam
  quedaron resueltas (5, 6 y 7).
- Cambios compartidos: `lib/db/password-confirmed.ts` es nuevo y genérico (sólo
  lo usa Operarios); `lib/studio/operario-pin.ts` y el generador sólo los consume
  el módulo Operarios.
- Sin otras sesiones consumidoras de este worktree. Ownership liberado al cerrar.
