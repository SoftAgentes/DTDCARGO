# Validación efímera y teardown de SDD-0172

| Control | Valor |
|---|---|
| Revisión | REV-AUD-019 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Runbook | [E2E con Supabase efímero](../../runbooks/e2e-supabase-efimero.md) |
| Fecha | 2026-07-29 |
| Resultado | bloqueado fail-closed; teardown terminal verificado |

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
