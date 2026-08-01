# Validación efímera y teardown de SDD-0172

| Control | Valor |
|---|---|
| Revisión | REV-AUD-019 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Runbook | [E2E con Supabase efímero](../../runbooks/e2e-supabase-efimero.md) |
| Fecha | 2026-07-29 · cierre 2026-07-30 |
| Resultado | aprobado en R29; teardown terminal verificado |

## 1. Preflight

- proyecto padre: `xpfuzqombmjmxvprjgmi`;
- estado padre: `ACTIVE_HEALTHY`;
- ramas previas: únicamente `main`;
- costo confirmado por el control plane: USD 0,01344 por hora;
- branch solicitado: `sdd-0172-ephemeral-20260729`;
- producción de datos: desactivada (`with_data=false`);
- lectura de filas de negocio o PII: ninguna.

## 2. Identidad efímera

| Campo | Valor |
|---|---|
| `branch_id` | `89181245-7fb0-47fe-add1-20f1b2e63acf` |
| `project_ref` | `zemkubdbodzbbumndbrr` |
| Creado | 2026-07-29T13:03:48.935288Z |
| Padre | `xpfuzqombmjmxvprjgmi` |
| Persistente | no |

No se registraron claves, contraseñas, URLs firmadas ni payloads.

## 3. Resultado del replay

El branch pasó de `CREATING_PROJECT` a `MIGRATIONS_FAILED`. Su ledger contiene
32 migraciones y termina en:

```text
20260526212625 back_content_admin
```

La siguiente migración presente en el ledger de Producción es:

```text
20260526213130 seed_team_invitation_template
```

El resultado reproduce la deuda ya descrita en
[SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md): ese seed
histórico depende de datos que no existen en una base fresca.

## 4. Decisión fail-closed

No se ejecutaron:

- `seed:e2e`;
- creación de usuarios Auth;
- fixture SDD-0168;
- SQL correctivo o migraciones manuales;
- reset, rebase o merge del branch;
- lectura de filas de Producción;
- Vercel.

El recorrido de aceptación SDD-0172 no queda aprobado. Un branch parcial no
tiene el schema requerido y no sirve para validar `0268` ni el lifecycle del
fixture.

## 5. Teardown terminal

El control plane eliminó únicamente el `branch_id` efímero y devolvió
`success=true`. La consulta posterior de ramas devolvió solo:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y el `project_ref` efímeros quedaron ausentes. Esto satisface la
evidencia terminal del teardown; no satisface el seed/E2E pendiente.

## 6. Veredicto técnico

REV-AUD-019 aprueba el comportamiento fail-closed y el teardown terminal del
intento. Rechaza cerrar SDD-0172 hasta resolver SDD-0118 en un gate propio y
repetir el recorrido completo sobre un entorno nuevo.

No se autoriza editar migraciones históricas, crear otra rama, aplicar SQL a
Producción ni abrir D1 o D2–D5 mediante esta revisión.

## 7. Segundo intento después de `0271`

Después de aplicar y verificar individualmente
`0271_repair_branch_replay_history`, se creó un entorno totalmente nuevo:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r2` |
| `branch_id` | `9c4d596b-02de-4759-ac1f-59fde07504de` |
| `project_ref` | `efnbhwrbdpgwlgtynacw` |
| Creado | 2026-07-29T13:53:18.736494Z |
| Datos de Producción | no |

El replay avanzó de 32 a 63 entradas. Su última migración confirmada fue:

```text
20260528060006 · 0027_qr_print_orders
```

PostgreSQL registró después:

```text
20260528060007 · 0031_fix_studio_invite_gen_random_bytes
ERROR: function name "public.studio_invite_user" is not unique
```

La causa es el `COMMENT ON FUNCTION` sin firma de `0031`: el historial ya
había creado el overload vigente de tres parámetros. No se ejecutaron seed,
Auth, fixtures, reset, rebase ni SQL correctivo.

## 8. Teardown terminal R2

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y `project_ref` R2 quedaron ausentes. La corrección propuesta
se documenta en
[REV-AUD-022](aud-sdd-0118-branch-replay-followup.md).

## 9. Tercer intento después de `0272`

Después de aplicar y verificar individualmente
`0272_skip_superseded_invite_history`, se creó un tercer entorno totalmente
nuevo. El costo confirmado fue USD 0,01344 por hora.

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r3` |
| `branch_id` | `7c0c93f7-4813-4dcd-98d5-0af8a6b34986` |
| `project_ref` | `snoupcomlgekwhlzxfvr` |
| Creado | 2026-07-29T14:04:39.064837Z |
| Datos de Producción | no |

El replay avanzó de 63 a 83 entradas. Su última migración confirmada fue:

```text
20260529070616 · fix_seal_status_enum_cast
```

La siguiente entrada del ledger de Producción es:

```text
20260529071707 · platform_admins
```

PostgreSQL registró:

```text
insert or update on table "platform_admins" violates foreign key constraint
"platform_admins_user_id_fkey"
```

La causa es el seed histórico de `0058_platform_admins.sql`: intenta insertar
un UUID fijo que existe en Auth de Producción, pero no existe en un branch
fresco sin datos. Crear esa identidad o alterar el branch manualmente habría
falseado el replay, por lo que el recorrido volvió a detenerse fail-closed.

No se ejecutaron seed E2E, Auth, fixtures, reset, rebase, merge ni SQL
correctivo. Tampoco se leyeron filas de negocio o PII.

## 10. Teardown terminal R3

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y `project_ref` R3 quedaron ausentes. REV-AUD-019 aprueba el
comportamiento fail-closed y el teardown terminal del tercer intento, pero no
aprueba SDD-0172: hace falta un nuevo gate de reparación del historial y un
entorno nuevo para completar seed, E2E y verificación.

## 11. Cuarto intento después de `0273`

Después del postflight verde de
`0273_skip_platform_admin_bootstrap_history`, se creó otro entorno sin datos
de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r4` |
| `branch_id` | `64a6045c-77aa-4833-bd01-979677fe476f` |
| `project_ref` | `uatrwwydcvsheojkbjfi` |
| Creado | 2026-07-29T14:19:41.896265Z |
| Costo | USD 0,01344 por hora |
| Datos de Producción | no |

El replay avanzó de 83 a 120 entradas. La última migración confirmada fue:

```text
20260605120742
```

La siguiente entrada de Producción es:

```text
20260607034503 · calculator_settings_container_limits
```

El diagnóstico metadata-only comprobó que el branch no contenía
`public.calculator_settings`. Su prerequisito histórico está registrado como:

```text
20260604131310 · 0103_calculator_settings · statements = NULL
```

Al no existir un payload reproducible para `0103`, el replay omitió la
creación de la tabla y falló al llegar a `0110`. No se ejecutaron seed E2E,
Auth, fixtures, reset, rebase, merge ni SQL correctivo. Tampoco se leyeron
filas de negocio o PII.

## 12. Teardown terminal R4

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi
```

El `branch_id` y `project_ref` R4 quedaron ausentes. REV-AUD-019 aprueba el
comportamiento fail-closed y el teardown terminal del cuarto intento. No
aprueba SDD-0172: `0103_calculator_settings` requiere otro gate forward-only
antes de crear un entorno nuevo.

## 13. Quinto intento después de `0274`

Después del postflight verde de
`0274_restore_calculator_settings_history`, se creó un quinto entorno sin
datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r5` |
| `branch_id` | `bec996e4-bd52-461b-8c07-66315e5307de` |
| `project_ref` | `jmgisgfeoosvxztwjple` |
| Creado | 2026-07-29T14:37:41.853027Z |
| Costo | USD 0,01344 por hora |
| Datos de Producción | no |

El replay avanzó de 120 a 266 entradas. La última migración confirmada fue:

```text
20260723135825 · 0261b_comments_acl_least_privilege
```

La siguiente entrada de Producción es:

```text
20260723140120 · 0262_comments_lifecycle_contract
```

PostgreSQL abortó el preflight DB-1 con:

```text
DB-1 detectó drift en propiedades de funciones comments
```

El diagnóstico metadata-only aisló el estado exacto. Las funciones
`comments_freeze_immutable()` y `comments_validate_entity()` existen, son
`SECURITY INVOKER` y retornan `trigger`, pero ambas tienen `proconfig = NULL`.
El contrato de `0262` exige `search_path=public`.

La entrada histórica que debía fijar esa propiedad está registrada en
Producción como:

```text
20260703235255 · 0210_pin_search_path_triggers · statements = NULL
```

Así, el replay fresco no ejecuta los dos `ALTER FUNCTION ... SET search_path`
del archivo canónico. No se ejecutaron seed E2E, Auth, fixtures, reset,
rebase, merge ni SQL correctivo. Tampoco se leyeron filas de negocio o PII.

## 14. Teardown terminal R5

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi · ACTIVE_HEALTHY
```

El `branch_id` y `project_ref` R5 quedaron ausentes. REV-AUD-019 aprueba el
comportamiento fail-closed y el teardown terminal del quinto intento. No
aprueba SDD-0172: el payload reproducible de
`0210_pin_search_path_triggers` requiere un gate forward-only propio y
autorización expresa de su nuevo basename antes de cualquier aplicación.

## 15. Sexto intento después de `0275`

Después del postflight verde de
`0275_restore_pin_search_path_history`, se creó otro entorno completamente
nuevo y sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r6` |
| `branch_id` | `4e44e488-8951-4def-9bd5-8cc4444ea93e` |
| `project_ref` | `xxgeviqtsyyewgapdeay` |
| Creado | 2026-07-29T15:36:46.638778Z |
| Costo | USD 0,01344 por hora |
| Datos de Producción | no |

El replay avanzó de 266 a 268 entradas. La última migración confirmada fue:

```text
20260723141742 · 0263_harden_postgres_public_default_table_acl
```

La siguiente entrada de Producción es:

```text
20260723141803 · 0264_harden_comment_mentions_validate_execute
```

PostgreSQL abortó su preflight con:

```text
0264 detectó un ACL previo inesperado en comment_mentions_validate()
```

El diagnóstico metadata-only comprobó que
`public.comment_mentions_validate()` conserva EXECUTE para PUBLIC, `anon`,
`authenticated` y `service_role`. La entrada histórica que debía retirar
PUBLIC/anon y conceder sólo los roles previstos está registrada como:

```text
20260703234254 · 0209_revoke_anon_rpc_sweep · statements = NULL
```

R6 no recibió ese payload y llegó a `0264` con el ACL por defecto. No se
ejecutaron seed E2E, Auth, fixtures, Playwright, verificación de teardown por
script, reset, rebase, merge ni SQL correctivo. Tampoco se leyeron filas de
negocio o PII.

## 16. Teardown terminal R6

`delete_branch` devolvió `success=true` para el `branch_id` exacto. El
inventario posterior volvió a mostrar únicamente:

```text
main · xpfuzqombmjmxvprjgmi · ACTIVE_HEALTHY
```

El `branch_id` y `project_ref` R6 quedaron ausentes. REV-AUD-019 aprueba el
comportamiento fail-closed y el teardown terminal del sexto intento. No
aprueba SDD-0172: el payload reproducible de
`0209_revoke_anon_rpc_sweep` requiere un gate forward-only propio antes de
crear otro entorno.

## 17. Séptimo intento después de `0276`

Después del postflight verde de
`0276_restore_revoke_anon_rpc_sweep_history`, se creó otro entorno
completamente nuevo y sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r7` |
| `branch_id` | `ab5ab1b5-2db5-462b-bd39-50fad398fab1` |
| `project_ref` | `mlwggagdcvwrrprqrhrn` |
| Creado | 2026-07-29T16:31:14.51346Z |
| Costo | USD 0,01344 por hora |
| Datos de Producción | no |

R7 ejecutó 215 migraciones. La última confirmada fue:

```text
20260703213609 · 0208_purchase_order_code_ca
```

Al ejecutar el payload ya restaurado de
`20260703234254 0209_revoke_anon_rpc_sweep`, PostgreSQL abortó con:

```text
function public.rls_auto_enable() does not exist
```

Los logs muestran que los pares ACL anteriores se procesaron y el fallo ocurrió
en:

```sql
revoke execute on function public.rls_auto_enable() from public, anon;
```

El diagnóstico metadata-only de Producción comprobó que
`public.rls_auto_enable()` existe como `SECURITY DEFINER`, retorna
`event_trigger`, usa `search_path=pg_catalog`, pertenece a `postgres` y sólo
concede EXECUTE a `postgres` y `service_role`. El event trigger
`ensure_rls` la invoca en `ddl_command_end` para `CREATE TABLE`,
`CREATE TABLE AS` y `SELECT INTO`.

El repositorio no contiene una migración que cree esa función o el event
trigger: `0209` y `0211` sólo referencian la función para ajustar ACL. Por eso
el payload canónico de `0209`, aunque ya está presente, no es autosuficiente en
un replay desde cero.

No se ejecutaron seed E2E, Auth, fixtures, Playwright, verificación por script,
reset, rebase, merge ni SQL correctivo. Tampoco se leyeron filas de negocio o
PII.

## 18. Teardown terminal R7

`delete_branch` devolvió `success=true` para
`ab5ab1b5-2db5-462b-bd39-50fad398fab1`. El inventario posterior devolvió
únicamente:

```text
main · xpfuzqombmjmxvprjgmi · ACTIVE_HEALTHY
```

El `branch_id` y `project_ref` R7 quedaron ausentes. REV-AUD-019 aprueba el
comportamiento fail-closed y el teardown terminal del séptimo intento. No
aprueba SDD-0172: el contrato reproducible de `rls_auto_enable()` y
`ensure_rls` requiere diseño forward-only propio y, si produce un basename
nuevo, autorización expresa antes de cualquier aplicación Cloud.

## 19. Octavo intento después de `0277`

Producción ya contenía `0277_version_rls_auto_enable`, pero esa migración tiene
una versión posterior a 0209. Se creó R8 para comprobar el comportamiento real:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r8` |
| `branch_id` | `fdcc9a71-e7b7-4cbd-a278-52551e10f70e` |
| `project_ref` | `alcyqfunqvszooxmufqd` |
| Costo | USD 0,01344 por hora |
| Datos de Producción | no |

El branch terminó `MIGRATIONS_FAILED` con el mismo error:

```text
function public.rls_auto_enable() does not exist
```

Los logs confirman que el fallo volvió a ocurrir en el REVOKE de 0209. No se
ejecutaron seed, Auth, fixtures, Playwright o SQL correctivo.

## 20. Teardown terminal R8

`delete_branch` devolvió `success=true` para el ID exacto. El inventario
posterior contiene únicamente `main` con `ACTIVE_HEALTHY`; el `branch_id` y
`project_ref` R8 están ausentes.

REV-AUD-019 aprueba el fail-closed y teardown de R8. La reparación local
resultante se documenta en
[REV-AUD-032](aud-sdd-0118-rls-auto-enable-history.md).

## 21. Noveno intento después de `0278`

Después de aplicar y verificar individualmente
`0278_restore_rls_auto_enable_history`, se creó otro entorno sin datos de
Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r9` |
| `branch_id` | `6746b74f-6fe4-4485-b0ef-d06cae5b259a` |
| `project_ref` | `csekuuxlrtmtubnjxaep` |
| Costo | USD 0,01344 por hora |
| Estado final | `MIGRATIONS_FAILED` |

R9 superó el payload restaurado de 0209 y avanzó hasta
`0268_tenant_lifecycle_guardrails`. El preflight abortó con:

```text
0268 abortado: un rol cliente puede borrar tenants
```

No se ejecutaron seed, Auth, fixtures, Playwright o SQL correctivo. Tampoco se
leyeron filas de negocio o PII.

## 22. Teardown terminal R9

`delete_branch` devolvió `success=true` para
`6746b74f-6fe4-4485-b0ef-d06cae5b259a`. El inventario posterior devolvió
únicamente `main` `ACTIVE_HEALTHY`; el `branch_id` y `project_ref` R9 quedaron
ausentes.

El análisis y la reparación forward-only local resultante están en
[REV-AUD-033](aud-sdd-0172-tenant-acl-history.md).
## 23. Decimotercer intento después de `0281`

La aplicación individual de `0281_repair_invite_skip_split_history` quedó
registrada con recibo `20260730011643`. Después se creó R13 sin datos:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r13-20260729` |
| Branch | `361cf50e-3fe0-47e9-b73c-7b54b05c8489` |
| Project ref | `tieiplsepiezyqkqfywe` |
| Resultado | `MIGRATIONS_FAILED` en `0273` |

R13 superó `0271` y `0272`. El target replay-safe de
`20260529071707 · platform_admins` apareció fragmentado en diez statements con
MD5 combinado `4912baa3058c9f1a4f2281b843499fcd`; `0273` sólo reconocía estados
de cardinalidad 1. No se ejecutaron seed, Auth ni E2E sobre el schema
incompleto.

La inspección fue exclusivamente de metadata del ledger. El branch fue
eliminado y el inventario terminal volvió a mostrar únicamente `main`.

La reparación forward-only local
`0282_repair_platform_admin_skip_split_history` quedó aprobada en
[REV-AUD-036](aud-sdd-0118-platform-admin-split-history.md).

## 24. Decimocuarto intento después de `0282`

La aplicación individual de
`0282_repair_platform_admin_skip_split_history` quedó registrada con recibo
`20260730130403`. Las postcondiciones confirmaron el payload objetivo de
`0273`, y los advisors conservaron el inventario previo: security 125
(`INFO` 5, `WARN` 120) y performance 546 (`INFO` 430, `WARN` 116).

Después se creó R14 sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r14-20260730` |
| Branch | `ab5435b9-ec23-4d45-b475-9a32a4c945a4` |
| Project ref | `stgnxiuofbxzzsndcqlw` |
| Costo | USD 0,01344 por hora |
| Resultado | `MIGRATIONS_FAILED` en `0274` |

R14 superó `0273`. El preflight siguiente abortó exactamente con:

```text
SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings
```

La inspección fue exclusivamente metadata-only. El target de
`0103_calculator_settings` apareció fragmentado en doce statements con MD5
combinado `f7102aeb22551a4628923dfba5d11793`:

| Ordinal | Longitud | MD5 |
|---:|---:|---|
| 1 | 3614 | `62307ab8c52471c4a07efc14d48417b8` |
| 2 | 306 | `f42e11b7e85267542456c38c47b4ce98` |
| 3 | 151 | `3a89ebc313211e1bcee3c6872dabbcdb` |
| 4 | 217 | `db433f4d92f7bd7741670660d67506ef` |
| 5 | 209 | `6e66fd2bd2616aeea5b222dc8cc8d19b` |
| 6 | 218 | `2065b24a0b96e70a683d5d904b9c1927` |
| 7 | 343 | `ffdb26231d26ff81b8caea2bd2ee424c` |
| 8 | 249 | `a4947fa5a62c7f29b76e9c9f0c17914a` |
| 9 | 777 | `977a827bc590173bc3df1f97fc47a98c` |
| 10 | 323 | `afc02ba3eea09eb599cc9aadedd0b3d0` |
| 11 | 126 | `3f3ece1b4bc4d4f60353d51154e6bc80` |
| 12 | 82 | `4d1e18a14ce0aede9602e54ef650c3a2` |

No se ejecutaron seed, Auth ni E2E sobre el schema incompleto. No se leyeron
filas de negocio ni PII. `delete_branch` devolvió `success=true` y el
inventario terminal mostró únicamente `main`.

La reparación forward-only local
`0283_repair_calculator_settings_split_history` quedó aprobada en
[REV-AUD-037](aud-sdd-0118-calculator-split-history.md).

## 25. Decimoquinto intento después de `0283`

La aplicación individual de
`0283_repair_calculator_settings_split_history` quedó registrada con recibo
`20260730132651`. Las postcondiciones confirmaron el payload objetivo de
`0274`, y los advisors conservaron el inventario previo: security 125
(`INFO` 5, `WARN` 120) y performance 546 (`INFO` 430, `WARN` 116).

Después se creó R15 sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r15-20260730` |
| Branch | `d97e81ba-94aa-4fd7-b4c6-bc4a9d8919df` |
| Project ref | `dmzhnfmiolvjsuzehcbq` |
| Costo | USD 0,01344 por hora |
| Resultado | `MIGRATIONS_FAILED` en `0275` |

R15 superó `0283`. El replay abortó exactamente con:

```text
SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers
```

La inspección fue exclusivamente metadata-only. El target de
`0210_pin_search_path_triggers` apareció fragmentado en 33 statements con MD5
combinado `442a34163980f1fc26bf6f930347b8a1`:

| Ordinal | Longitud | MD5 |
|---:|---:|---|
| 1 | 1102 | `4aec76173fe77cc54722dab274ace2b5` |
| 2 | 84 | `ab61c1d455599424528a582dd86041c4` |
| 3 | 75 | `51d8f913f75e329d9466642a63eb5523` |
| 4 | 82 | `7c1b6fbbda34ff110553349b53ccbfb8` |
| 5 | 74 | `42761756f2f44a46ce3e3b4567876e00` |
| 6 | 73 | `2563c1daaa0e36b74ad80644447d5080` |
| 7 | 88 | `fe85c07ffacef0994f104ab29f7a1d33` |
| 8 | 74 | `b948705b8fe07c440d2bdb7b11dd52f9` |
| 9 | 78 | `eecaa4b9021bafe3ec69bfaaa608a61a` |
| 10 | 67 | `bb97013b0f7776c43ab583b2af224161` |
| 11 | 88 | `bf993074c063e38318e4539e5f165884` |
| 12 | 81 | `34fa549de3b31da01ad725020761884b` |
| 13 | 79 | `7543ef5be1f22a77c8e2fcc882cff270` |
| 14 | 75 | `45680909caefce5545d61974f3f231d1` |
| 15 | 76 | `58e8551dcc70c99ebc5d3f55fb2ee3e7` |
| 16 | 82 | `10472888b24e316e4569a70d3dd0f5cb` |
| 17 | 76 | `b95cf72852e1c5b72208d4499d4ce6ba` |
| 18 | 78 | `060467c11e8f99c5a2be1bcbadcc63b3` |
| 19 | 85 | `de760ab1d066d4f324b04122876ca1ec` |
| 20 | 80 | `0f2c8dd05b95ac18d33075e7ae80966d` |
| 21 | 80 | `805cca12026d19e95d6442501b0e845c` |
| 22 | 80 | `c635ecad307f74055eff03b7555885a1` |
| 23 | 77 | `9e0d12b1963ae0549b717a9064d5a386` |
| 24 | 77 | `2ef7fa90329099f525330cbbf288257f` |
| 25 | 75 | `401d18e45b05341f762417f151abd513` |
| 26 | 76 | `c9c368e38db9081cfcf44b344c1b767d` |
| 27 | 69 | `ceb167f93ad235ba32edb4450e77185f` |
| 28 | 71 | `e04707233161408d92ea9868e0b5b079` |
| 29 | 76 | `7b84ce45e569be2c1eae1e5c47df7608` |
| 30 | 81 | `9e3ba25ab5319876d8068f30995de658` |
| 31 | 83 | `03ef41e7c9ac837ed11c37b07b348a1f` |
| 32 | 71 | `8dec68319f1e0ec01d7db9c863715445` |
| 33 | 87 | `007def051c605511fd7ec271eb6a6a67` |

No se ejecutaron seed, Auth ni E2E sobre el schema incompleto. No se leyeron
filas de negocio ni PII. `delete_branch` devolvió `success=true` y el
inventario terminal mostró únicamente `main`.

La reparación forward-only local
`0284_repair_pin_search_path_split_history` quedó aprobada en
[REV-AUD-038](aud-sdd-0118-pin-split-history.md).

## 26. Reparaciones R16–R20

Los replays posteriores revelaron de forma secuencial las representaciones
fragmentadas de `0276`, `0279` y de los propios gates forward-only. Se
aplicaron individualmente:

```text
20260730160209 · 0284_repair_pin_search_path_split_history
20260730160939 · 0285_repair_revoke_anon_split_history
20260730161446 · 0286_repair_tenant_acl_split_history
20260730162532 · 0287_repair_replay_gate_split_history
20260730165010 · 0288_finalize_replay_gate_split_history
```

R19 falló durante el aprovisionamiento antes de obtener ledger. R20 comprobó
que `0280`–`0286` también se materializaban como arrays fragmentados y produjo
el finalizador `0288`. Todos los entornos se destruyeron completos; ninguno
recibió SQL correctivo, cleanup por filas o datos de Producción.

## 27. Recorridos R21–R29

Desde R21, el replay alcanzó 293 entradas y la última migración
`20260730165010`. Los intentos intermedios mantuvieron el comportamiento
fail-closed mientras se corrigieron supuestos del harness:

- estabilidad del composer tras App Router;
- uso del picker real de menciones;
- preservación de la contraseña sintética en un solo proceso;
- binding IPv4 explícito en Windows;
- carga de `SUPABASE_SERVICE_ROLE_KEY` sólo para adapters server-side;
- cierre del árbol Next completo;
- lectura de auditoría como `authenticated`, respetando que
  `service_role` no tiene `SELECT`.

R29, branch `d4df25d3-951e-47ca-af61-fe508b15e76a` y project ref
`inxjipnsdccxdllfuudm`, completó:

```text
replay=293
seed=success
e2e=1/1
tenants=1
memberships=2
audit_events=4
database_cleanup_performed=false
```

`delete_branch` devolvió éxito para el ID exacto. El inventario posterior no
contiene el branch ni el project ref y conserva únicamente `main`
`ACTIVE_HEALTHY`.

REV-AUD-019 aprueba finalmente el recorrido efímero. La revisión de cierre y
los recibos están consolidados en
[REV-AUD-039](aud-sdd-0118-0172-final-closure.md).
