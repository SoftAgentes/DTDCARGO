---
sdd: "0118"
title: "Historial reproducible — habilitar validación en branch efímero de Supabase"
status: done
author: "Claude Code (Director) + founder"
created: 2026-06-29
updated: 2026-07-30
supersedes: null
superseded_by: null
related: ["0116", "0172"]
confidencialidad: interno
---

# SDD-0118 · Historial reproducible para branches efímeros

## 0. Decisión

Se repara el historial remoto mediante una migración forward-only y
fail-closed:

```text
0271_repair_branch_replay_history
```

La migración no ejecuta el DDL histórico sobre Producción ni toca tablas de
negocio. Sólo corrige `supabase_migrations.schema_migrations.statements` para
que un branch nuevo pueda reproducir el schema desde cero. Cada cambio exige
versión, nombre y digest MD5 exactos; cualquier drift aborta toda la
transacción.

La aplicación Cloud de `0271` y la creación del branch posterior son gates
separados. Esta spec no autoriza `0270`, Vercel, Auth, lectura de filas de
negocio ni PII.

## 1. Causa raíz comprobada

El primer branch de SDD-0172 quedó en `MIGRATIONS_FAILED` después de 32
migraciones. La siguiente entrada era:

```text
20260526213130 · seed_team_invitation_template
```

El diagnóstico metadata-only corrigió la hipótesis original:

- el seed ya usa `ON CONFLICT DO NOTHING`;
- `0001_init_tenancy` sí crea un tenant bootstrap;
- el fallo ocurre porque el seed referencia `public.mail_templates` antes de
  que exista;
- la entrada remota `20260528060001 · 0018_mailing` contiene sólo un comentario
  post-hoc, no el DDL canónico de `0018_mailing.sql`;
- `0051_brand_v3_templates` también referencia `mail_templates` antes de esa
  entrada;
- `realtime_dispatch` referencia tablas de `0024_dispatch_core` antes del
  placeholder post-hoc que documentó su aplicación manual.

Por tanto, el problema no era un seed no idempotente aislado. Era historial
remoto incompleto y fuera de orden, originado por cambios antiguos aplicados
mediante SQL editor y registrados después sólo como comentarios.

## 2. Reparación exacta

`0271` modifica once entradas del ledger:

| Entrada remota | Acción para replay |
|---|---|
| `20260526213130 seed_team_invitation_template` | antepone `0018_mailing.sql` y conserva el seed original como segundo statement |
| `20260527073053 realtime_dispatch` | antepone `0024_dispatch_core.sql` y `0025_operario_roles_extend.sql`; conserva realtime como tercero |
| `20260528060005 0026_welcome_email_template_seed` | reemplaza el comentario por el SQL canónico |
| `20260528060006 0027_qr_print_orders` | reemplaza el comentario por el SQL canónico |
| `20260528060007 0031_fix_studio_invite_gen_random_bytes` | reemplaza el comentario por el SQL canónico |
| `20260528060008 0032_fix_studio_invite_ambiguous_token` | reemplaza el comentario por el SQL canónico |
| `20260528060009 0033_grant_service_role_policies` | reemplaza el comentario por el SQL canónico |
| `20260528060010 0035_fix_verify_operario_pin_extensions` | reemplaza el comentario por el SQL canónico |
| `20260528060011 0036_fk_user_tenants_profile` | reemplaza el comentario por el SQL canónico |
| `20260528060012 0037_harden_operario_pin_validator` | reemplaza el comentario por el SQL canónico |
| `20260528060013 0039_fix_bug_advance_state_actor_type_cast` | reemplaza el comentario por el SQL canónico |

No se reejecuta contenido sobre Producción: los archivos históricos se
almacenan como elementos `text[]` para el próximo replay. Al llegar a `0271`
en un branch ya reparado, la migración reconoce el estado final por digest y
no duplica statements.

Los placeholders `0020b`, `0057` y `0058` quedan fuera:

- `0020b` tiene sus cambios funcionales cubiertos por entradas anteriores y
  reemplazos posteriores del mismo flujo;
- `0057_user_profiles_locale_nullable` ya tiene SQL real en
  `20260528024234`;
- `0058_user_invitations_region` ya tiene SQL real en `20260528035934`.

### Corrección posterior al segundo replay

El segundo branch llegó a 63 migraciones y reveló que `0031` y `0032` no
debían restaurarse. El historial anterior ya había creado el overload vigente
de `studio_invite_user(text,text,text)`; el `COMMENT ON FUNCTION` sin firma de
`0031` quedó ambiguo al recrear el overload antiguo de dos parámetros.

La migración candidata:

```text
0272_skip_superseded_invite_history
```

restaura únicamente los comments no-op de `0031` y `0032`. Las dos entradas
son fixes supersedidos por la implementación de tres parámetros ya registrada.
`0272` no modifica funciones ni tablas de negocio.

### Bloqueo posterior al tercer replay

El tercer branch confirmó que `0272` resolvió el bloqueo anterior y avanzó a
83 migraciones. La entrada siguiente,
`20260529071707 platform_admins`, ejecuta el seed histórico de
`0058_platform_admins.sql` con un UUID fijo de Auth. Como un branch sin datos
no contiene esa identidad, PostgreSQL aborta por
`platform_admins_user_id_fkey`.

El gate no debe fabricar ese usuario ni corregir el branch manualmente. La
reparación requiere diseño, prueba y migración forward-only propios antes de
repetir el recorrido en otro entorno nuevo.

La reparación aprobada localmente es:

```text
0273_skip_platform_admin_bootstrap_history
```

`0273` reemplaza únicamente el statement técnico de
`20260529071707 platform_admins`. Conserva tabla, FK hacia `auth.users`, RLS,
policies, grants y `is_platform_admin()`, pero omite el INSERT del UUID fijo.
La fila real de Producción no se borra: el payload queda almacenado como texto
para futuros replays y no se ejecuta sobre el proyecto padre.

### Bloqueo posterior al cuarto replay

R4 confirmó que `0273` resolvió el bloqueo anterior y avanzó a 120
migraciones. La entrada siguiente,
`20260607034503 calculator_settings_container_limits`, requiere
`public.calculator_settings`, pero el branch no contiene esa tabla.

El prerequisito remoto `20260604131310 0103_calculator_settings` tiene
`statements = NULL`, por lo que un branch fresco no recibe el DDL canónico de
`0103_calculator_settings.sql`. La reparación exige otro gate forward-only;
no se debe ejecutar el archivo manualmente sobre el branch fallido.

La reparación aprobada localmente es:

```text
0274_restore_calculator_settings_history
```

`0274` convierte únicamente el `NULL` técnico de esa entrada en un array con
el payload canónico de `0103_calculator_settings.sql`. Producción no ejecuta
ese payload: sólo lo almacena para futuros replays. La segunda ejecución
reconoce el digest final y no vuelve a escribir.

### Bloqueo posterior al quinto replay

R5 confirmó la reparación de `0103` y avanzó de 120 a 266 migraciones. El
preflight de `0262_comments_lifecycle_contract` abortó porque
`comments_freeze_immutable()` y `comments_validate_entity()` nacieron sin
`search_path=public`.

El diagnóstico metadata-only confirmó que ambas funciones tienen
`proconfig = NULL`. La entrada que debía fijar esa propiedad es:

```text
20260703235255 · 0210_pin_search_path_triggers · statements = NULL
```

El próximo gate debe restaurar forward-only el payload reproducible de
`0210`; no debe ejecutar esos `ALTER FUNCTION` directamente sobre un branch
fallido ni aplicar un basename nuevo sin autorización expresa.

La reparación aprobada localmente es:

```text
0275_restore_pin_search_path_history
```

`0275` convierte únicamente el `NULL` técnico de esa entrada en un array con
el payload canónico completo de `0210_pin_search_path_triggers.sql`.
Producción no ejecuta los 33 `ALTER FUNCTION`: sólo almacena el texto para
futuros replays. La segunda ejecución reconoce el digest final y no vuelve a
escribir.

### Bloqueo posterior al sexto replay

R6 confirmó la reparación de `0210`: el replay avanzó de 266 a 268
migraciones y aplicó `0262` y `0263`. El preflight de
`0264_harden_comment_mentions_validate_execute` abortó porque
`comment_mentions_validate()` todavía concede EXECUTE a `anon`.

El diagnóstico metadata-only confirmó que la función conserva el ACL por
defecto de PUBLIC junto con `anon`, `authenticated` y `service_role`. La
entrada que debía establecer el ACL previo esperado es:

```text
20260703234254 · 0209_revoke_anon_rpc_sweep · statements = NULL
```

El próximo gate debe restaurar forward-only el payload reproducible de
`0209`; no debe ejecutar el sweep directamente sobre un branch fallido ni
aplicar un basename nuevo sin autorización expresa.

La reparación aprobada localmente es:

```text
0276_restore_revoke_anon_rpc_sweep_history
```

`0276` convierte únicamente el `NULL` técnico de esa entrada en un array con
el payload canónico completo de `0209_revoke_anon_rpc_sweep.sql`. Producción
no ejecuta los 48 pares `REVOKE/GRANT`: sólo almacena el texto para futuros
replays. La segunda ejecución reconoce el digest final y no vuelve a escribir.

### Bloqueo posterior al décimo replay

Después de aplicar individualmente `0279`, R10 volvió a fallar en el preflight
de `0271`. El ledger de Producción era exacto y no existía CRLF: el problema
era que el motor de replay fragmenta cada archivo histórico en sentencias
individuales antes de registrar la fila del branch.

R11, creado sólo para diagnóstico metadata-only, comprobó los once estados
materializados. Entre ellos:

- `seed_team_invitation_template`: 63 statements, digest conjunto
  `b9da059306c4a80875e54947b9338252`;
- `realtime_dispatch`: 110 statements, digest conjunto
  `ffa4e66b1ca875226edc55a86b37d780`;
- los otros nueve estados quedan anclados por cardinalidad y digest en el
  generador de `0280`.

La reparación local:

```text
0280_repair_sdd0118_split_history
```

sustituye únicamente el payload histórico de
`20260729135053 · 0271_repair_branch_replay_history`. El payload reparado
conserva todas las precondiciones anteriores y añade como alternativas los
once fingerprints exactos observados en R11 tanto al preflight como al
postflight. No usa comodines, no reejecuta `0271` en Producción y no modifica
las entradas de negocio.

### Bloqueo posterior al duodécimo replay

`0280` se aplicó individualmente y R12 superó `0271`. El siguiente preflight,
`0272_skip_superseded_invite_history`, abortó porque los payloads de `0031` y
`0032` también fueron materializados en su representación fragmentada:

```text
0031 · e7f1e2878e508b2338f4f014f8e9578f
0032 · 45a1d8ecf3de592e7c2106bb704e709f
```

Esos estados exactos ya estaban anclados por `0280`, pero el payload histórico
de `0272` sólo reconocía los hashes compactos previos o sus no-op finales.

La reparación local:

```text
0281_repair_invite_skip_split_history
```

sustituye únicamente el payload histórico de
`20260729140214 · 0272_skip_superseded_invite_history`. Conserva sus
precondiciones, añade los dos fingerprints exactos y los transforma a los
no-op finales ya aprobados. No ejecuta funciones históricas ni modifica datos
de negocio.

## 3. Generación y control de drift

El generador
`scripts/build-sdd-0118-repair.mjs`:

1. valida los digests del estado remoto observado;
2. lee los quince archivos fuente del repositorio;
3. normaliza únicamente finales de línea;
4. calcula y publica el digest de cada payload;
5. genera `0271`, `0272`, `0273`, `0274`, `0275`, `0276` y sus pruebas
   transaccionales;
6. ofrece `--check` para impedir drift entre fuentes y artefactos.

El generador complementario
`scripts/build-sdd-0118-split-history.mjs` ancla el MD5 original de `0271`,
verifica su generación canónica, incorpora los once fingerprints de R11 y
genera `0280` con su prueba transaccional.

El generador
`scripts/build-sdd-0118-invite-skip-split-history.mjs` ancla byte a byte el
payload remoto de `0272`, incluido su CRLF terminal, incorpora los dos estados
fragmentados de R12 y genera `0281` con `--check` y prueba transaccional.

`0281` se aplicó individualmente con recibo `20260730011643`. R13 superó
`0272`, pero `0273_skip_platform_admin_bootstrap_history` abortó ante la
representación de diez statements del target replay-safe de
`platform_admins`. La inspección metadata-only confirmó cardinalidad 10, MD5
combinado `4912baa3058c9f1a4f2281b843499fcd` y los diez fingerprints
individuales. R13 fue destruido y el inventario terminal volvió a mostrar
únicamente `main`.

El generador
`scripts/build-sdd-0118-platform-admin-split-history.mjs` reconstruye esos
statements desde el target canónico de `0058`, valida sus diez fingerprints,
ancla byte a byte el payload remoto de `0273` y genera
`0282_repair_platform_admin_skip_split_history`. La reparación sólo amplía el
preflight/update de `0273` para colapsar esa variante al target de un statement
con MD5 `cb374d4ad4c3b2bb62915e80a5a13793`.

`0282` se aplicó individualmente con recibo `20260730130403`. R14 superó
`0273` y falló cerrado en `0274` porque el target de
`0103_calculator_settings` apareció fragmentado en doce statements. La
inspección metadata-only confirmó MD5 combinado
`f7102aeb22551a4628923dfba5d11793` y doce fingerprints individuales. R14 fue
destruido y el inventario terminal volvió a mostrar únicamente `main`.

El generador
`scripts/build-sdd-0118-calculator-split-history.mjs` reconstruye esa
representación desde `0103`, ancla byte a byte el payload remoto de `0274` y
genera `0283_repair_calculator_settings_split_history`. La reparación sólo
amplía el preflight/update de `0274` para colapsar ese split al target de un
statement con MD5 `0f7deee22e3a978c52159b6fc211ee2c`.

`0283` se aplicó individualmente con recibo `20260730132651`. R15 superó
`0274` y falló cerrado en `0275` porque el target de
`0210_pin_search_path_triggers` apareció fragmentado en 33 statements. La
inspección metadata-only confirmó MD5 combinado
`442a34163980f1fc26bf6f930347b8a1` y los 33 fingerprints individuales. R15
fue destruido y el inventario terminal volvió a mostrar únicamente `main`.

El generador `scripts/build-sdd-0118-pin-split-history.mjs` reconstruye la
representación observada desde `0210`, ancla byte a byte el payload remoto de
`0275` y genera `0284_repair_pin_search_path_split_history`. La reparación
sólo amplía el preflight/update de `0275` para colapsar ese split al target de
un statement con MD5 `c3131d8ea3756049d6455bc98b4d0ecc`.

### Cierre de la recursión de splits

Las aplicaciones individuales posteriores repararon, en orden, la
representación fragmentada de `0276`, `0279` y de los propios gates
forward-only:

```text
0284_repair_pin_search_path_split_history
0285_repair_revoke_anon_split_history
0286_repair_tenant_acl_split_history
0287_repair_replay_gate_split_history
0288_finalize_replay_gate_split_history
```

Producción registró los cinco basenames exactos entre
`20260730160209` y `20260730165010`. R29 reprodujo 293 entradas hasta `0288`,
completó seed, E2E y verificación, y terminó con teardown terminal. La
evidencia integral está en
[REV-AUD-039](../../governance/reviews/aud-sdd-0118-0172-final-closure.md).

No descarga ni guarda secretos. Los únicos datos Cloud incorporados son
metadatos técnicos del ledger.

## 4. Seguridad

- una versión, nombre o digest inesperado aborta antes de escribir;
- la operación es una sola transacción corta;
- los `UPDATE` apuntan exclusivamente a
  `supabase_migrations.schema_migrations`;
- no se consulta ni modifica ninguna fila de negocio;
- no se reordena ni elimina una migración;
- no se usa `migration repair` para fingir ejecución;
- no se toca Auth, Storage, Vercel ni `0270`;
- el branch fallido anterior permanece destruido.

## 5. Allowlist

| Tipo | Archivo |
|---|---|
| Generador | `scripts/build-sdd-0118-repair.mjs` |
| Unit | `scripts/__tests__/build-sdd-0118-repair.test.ts` |
| Migración | `supabase/migrations/0271_repair_branch_replay_history.sql` |
| DB test | `supabase/tests/0271_repair_branch_replay_history.test.sql` |
| Follow-up migración | `supabase/migrations/0272_skip_superseded_invite_history.sql` |
| Follow-up DB test | `supabase/tests/0272_skip_superseded_invite_history.test.sql` |
| Platform admin migración | `supabase/migrations/0273_skip_platform_admin_bootstrap_history.sql` |
| Platform admin DB test | `supabase/tests/0273_skip_platform_admin_bootstrap_history.test.sql` |
| Calculator migración | `supabase/migrations/0274_restore_calculator_settings_history.sql` |
| Calculator DB test | `supabase/tests/0274_restore_calculator_settings_history.test.sql` |
| Pin search_path migración | `supabase/migrations/0275_restore_pin_search_path_history.sql` |
| Pin search_path DB test | `supabase/tests/0275_restore_pin_search_path_history.test.sql` |
| Revoke anon migración | `supabase/migrations/0276_restore_revoke_anon_rpc_sweep_history.sql` |
| Revoke anon DB test | `supabase/tests/0276_restore_revoke_anon_rpc_sweep_history.test.sql` |
| RLS history generador | `scripts/build-sdd-0118-rls-history.mjs` |
| RLS history unit | `scripts/__tests__/build-sdd-0118-rls-history.test.ts` |
| RLS versionada | `supabase/migrations/0277_version_rls_auto_enable.sql` |
| RLS history migración | `supabase/migrations/0278_restore_rls_auto_enable_history.sql` |
| RLS history DB tests | `supabase/tests/0277_version_rls_auto_enable.test.sql` · `supabase/tests/0278_restore_rls_auto_enable_history.test.sql` |
| Tenant ACL generador | `scripts/build-sdd-0172-tenant-acl-history.mjs` |
| Tenant ACL unit | `scripts/__tests__/build-sdd-0172-tenant-acl-history.test.ts` |
| Tenant ACL migración | `supabase/migrations/0279_restore_tenant_lifecycle_acl_history.sql` |
| Tenant ACL DB test | `supabase/tests/0279_restore_tenant_lifecycle_acl_history.test.sql` |
| Split history generador | `scripts/build-sdd-0118-split-history.mjs` |
| Split history types | `scripts/build-sdd-0118-split-history.d.mts` |
| Split history unit | `scripts/__tests__/build-sdd-0118-split-history.test.ts` |
| Split history migración | `supabase/migrations/0280_repair_sdd0118_split_history.sql` |
| Split history DB test | `supabase/tests/0280_repair_sdd0118_split_history.test.sql` |
| Invite skip split generador | `scripts/build-sdd-0118-invite-skip-split-history.mjs` |
| Invite skip split types | `scripts/build-sdd-0118-invite-skip-split-history.d.mts` |
| Invite skip split unit | `scripts/__tests__/build-sdd-0118-invite-skip-split-history.test.ts` |
| Invite skip split migración | `supabase/migrations/0281_repair_invite_skip_split_history.sql` |
| Invite skip split DB test | `supabase/tests/0281_repair_invite_skip_split_history.test.sql` |
| Platform admin split generador | `scripts/build-sdd-0118-platform-admin-split-history.mjs` |
| Platform admin split types | `scripts/build-sdd-0118-platform-admin-split-history.d.mts` |
| Platform admin split unit | `scripts/__tests__/build-sdd-0118-platform-admin-split-history.test.ts` |
| Platform admin split migración | `supabase/migrations/0282_repair_platform_admin_skip_split_history.sql` |
| Platform admin split DB test | `supabase/tests/0282_repair_platform_admin_skip_split_history.test.sql` |
| Calculator split generador | `scripts/build-sdd-0118-calculator-split-history.mjs` |
| Calculator split types | `scripts/build-sdd-0118-calculator-split-history.d.mts` |
| Calculator split unit | `scripts/__tests__/build-sdd-0118-calculator-split-history.test.ts` |
| Calculator split migración | `supabase/migrations/0283_repair_calculator_settings_split_history.sql` |
| Calculator split DB test | `supabase/tests/0283_repair_calculator_settings_split_history.test.sql` |
| Pin split generador | `scripts/build-sdd-0118-pin-split-history.mjs` |
| Pin split types | `scripts/build-sdd-0118-pin-split-history.d.mts` |
| Pin split unit | `scripts/__tests__/build-sdd-0118-pin-split-history.test.ts` |
| Pin split migración | `supabase/migrations/0284_repair_pin_search_path_split_history.sql` |
| Pin split DB test | `supabase/tests/0284_repair_pin_search_path_split_history.test.sql` |
| Revoke split generador | `scripts/build-sdd-0118-revoke-split-history.mjs` |
| Revoke split migración | `supabase/migrations/0285_repair_revoke_anon_split_history.sql` |
| Tenant ACL split generador | `scripts/build-sdd-0172-tenant-acl-split-history.mjs` |
| Tenant ACL split migración | `supabase/migrations/0286_repair_tenant_acl_split_history.sql` |
| Gates replay generador | `scripts/build-sdd-0118-replay-gates-split-history.mjs` |
| Gates replay migración | `supabase/migrations/0287_repair_replay_gate_split_history.sql` |
| Finalizador generador | `scripts/build-sdd-0118-replay-gate-finalizer.mjs` |
| Finalizador migración | `supabase/migrations/0288_finalize_replay_gate_split_history.sql` |
| Spec | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| Cierre | `docs/governance/reviews/aud-sdd-0118-0172-final-closure.md` |

## 6. Evidencia local

| Gate | Resultado |
|---|---|
| Generación determinista | verde · `node scripts/build-sdd-0118-repair.mjs --check` |
| Vitest focal | verde · 1 archivo · 10 pruebas |
| PostgreSQL 15 | verde · 11 cambios + segunda ejecución idempotente + rollback |
| PostgreSQL 17 | verde · 11 cambios + segunda ejecución idempotente + rollback |
| Residuo Docker propio | cero |
| Cloud | `0271` aplicada individualmente · [REV-AUD-021](../../governance/reviews/aud-sdd-0118-branch-replay-application.md) |
| Segundo branch | 63 migraciones; fallo preciso en `0031`; teardown terminal |
| Follow-up local | `0272` verde en Vitest y PostgreSQL 15/17 · [REV-AUD-022](../../governance/reviews/aud-sdd-0118-branch-replay-followup.md) |
| Follow-up Cloud | `0272` aplicada individualmente; recibo `20260729140214` · [REV-AUD-023](../../governance/reviews/aud-sdd-0118-branch-replay-followup-application.md) |
| Tercer branch | 83 migraciones; fallo preciso en `platform_admins`; teardown terminal |
| Platform admin local | `0273` determinista · Vitest 6/6 · PostgreSQL 15/17 · [REV-AUD-024](../../governance/reviews/aud-sdd-0118-platform-admin-bootstrap.md) |
| Platform admin Cloud | `0273` aplicada individualmente; recibo `20260729141805` · [REV-AUD-025](../../governance/reviews/aud-sdd-0118-platform-admin-bootstrap-application.md) |
| Cuarto branch | 120 migraciones; falta `calculator_settings` por `0103` con statements NULL; teardown terminal |
| Calculator local | `0274` determinista · Vitest 8/8 · PostgreSQL 15/17 · [REV-AUD-026](../../governance/reviews/aud-sdd-0118-calculator-settings-history.md) |
| Calculator Cloud | `0274` aplicada individualmente; recibo `20260729143620` · [REV-AUD-027](../../governance/reviews/aud-sdd-0118-calculator-settings-history-application.md) |
| Quinto branch | 266 migraciones; `0262` detecta `proconfig = NULL` porque `0210` tiene statements NULL; teardown terminal · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Pin search_path local | `0275` determinista · PostgreSQL 15/17 · 33 firmas · UPDATE 1/0 · rollback · [REV-AUD-028](../../governance/reviews/aud-sdd-0118-pin-search-path-history.md) |
| Pin search_path Cloud | `0275` aplicada individualmente; recibo `20260729152036` · [REV-AUD-029](../../governance/reviews/aud-sdd-0118-pin-search-path-history-application.md) |
| Sexto branch | 268 migraciones; `0264` detecta EXECUTE de `anon` porque `0209` tiene statements NULL; teardown terminal · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Revoke anon local | `0276` determinista · Vitest 12/12 · PostgreSQL 15/17 · 48 pares ACL · UPDATE 1/0 · rollback · [REV-AUD-030](../../governance/reviews/aud-sdd-0118-revoke-anon-history.md) |
| Revoke anon Cloud | `0276` aplicada individualmente; recibo `20260729163005` · [REV-AUD-031](../../governance/reviews/aud-sdd-0118-revoke-anon-history-application.md) |
| Séptimo branch | 215 migraciones; `0209` falla porque `rls_auto_enable()` no existe en el historial; teardown terminal · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Versión canónica RLS | `0277` recuperada byte-idéntica; ya aplicada como `0277_version_rls_auto_enable` |
| Octavo branch | fallo idéntico en `0209`; demuestra que 0277 llega demasiado tarde; teardown terminal · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| RLS history local | `0278` determinista · Vitest 3/3 · PostgreSQL 15/17 · UPDATE 1/0 · rollback · [REV-AUD-032](../../governance/reviews/aud-sdd-0118-rls-auto-enable-history.md) |
| RLS history Cloud | `0278` aplicada individualmente; recibo `20260729223452`; postcondiciones y advisors verdes · [REV-AUD-033](../../governance/reviews/aud-sdd-0172-tenant-acl-history.md) |
| Noveno branch | supera 0209; `0268` falla porque un rol cliente conserva DELETE; teardown terminal · [REV-AUD-019](../../governance/reviews/aud-tenant-fixtures-ephemeral-validation.md) |
| Tenant ACL history local | `0279` determinista · Vitest 3/3 · PostgreSQL 15/17 · UPDATE 1/0 · replay + rollback · [REV-AUD-033](../../governance/reviews/aud-sdd-0172-tenant-acl-history.md) |
| Tenant ACL history Cloud | `0279` aplicada individualmente; recibo `20260729224850`; postcondiciones y advisors verdes · [REV-AUD-034](../../governance/reviews/aud-sdd-0118-split-replay-history.md) |
| Décimo branch | R10 falla en `0271` por representación fragmentada del ledger; sin seed/Auth/E2E; teardown terminal |
| Diagnóstico R11 | once fingerprints metadata-only capturados; sin filas de negocio; teardown terminal |
| Split history local | `0280` determinista · Vitest 4/4 · PostgreSQL 15/17 · UPDATE 1/0 · rollback · [REV-AUD-034](../../governance/reviews/aud-sdd-0118-split-replay-history.md) |
| Split history Cloud | `0280` aplicada individualmente; recibo `20260730002206`; digest objetivo y advisors verificados · [REV-AUD-035](../../governance/reviews/aud-sdd-0118-invite-skip-split-history.md) |
| Duodécimo branch | R12 supera `0271`; `0272` no reconoce los estados fragmentados de `0031/0032`; teardown terminal |
| Invite skip split local | `0281` determinista · Vitest 4/4 · contratos SQL 20/20 · UPDATE 1/0 + rollback · [REV-AUD-035](../../governance/reviews/aud-sdd-0118-invite-skip-split-history.md) |
| Invite skip split Cloud | `0281` aplicada individualmente; recibo `20260730011643`; digest objetivo y advisors verificados · [REV-AUD-036](../../governance/reviews/aud-sdd-0118-platform-admin-split-history.md) |
| Decimotercer branch | R13 supera `0272`; `0273` no reconoce el target fragmentado de `platform_admins`; teardown terminal |
| Platform admin split local | `0282` determinista · Vitest 4/4 · contratos SQL 21/21 · replay del fixture + rollback · [REV-AUD-036](../../governance/reviews/aud-sdd-0118-platform-admin-split-history.md) |
| Platform admin split Cloud | `0282` aplicada individualmente; recibo `20260730130403`; postcondiciones verificadas |
| Decimocuarto branch | R14 supera `0273`; `0274` no reconoce el target de `calculator_settings` fragmentado en doce statements; teardown terminal |
| Calculator split local | `0283` determinista · Vitest 4/4 · contratos SQL 22/22 · replay del fixture + rollback · [REV-AUD-037](../../governance/reviews/aud-sdd-0118-calculator-split-history.md) |
| Calculator split Cloud | `0283` aplicada individualmente; recibo `20260730132651`; postcondiciones y advisors verificados · [REV-AUD-038](../../governance/reviews/aud-sdd-0118-pin-split-history.md) |
| Decimoquinto branch | R15 supera `0274`; `0275` no reconoce el target de `pin_search_path` fragmentado en 33 statements; teardown terminal |
| Pin split local | `0284` determinista · Vitest 4/4 · contratos SQL 23/23 en PostgreSQL 15/17 · replay del fixture + rollback · [REV-AUD-038](../../governance/reviews/aud-sdd-0118-pin-split-history.md) |
| Reparaciones finales Cloud | `0284`–`0288` aplicadas individualmente; recibos exactos y advisors sin drift atribuible |
| Replay final R29 | 293 entradas hasta `0288`; seed, E2E y verificación verdes |
| Teardown R29 | terminal; branch y project ref ausentes; sólo `main` saludable · [REV-AUD-039](../../governance/reviews/aud-sdd-0118-0172-final-closure.md) |
| Diff | verde |

## 7. Cierre

Los gates restantes fueron completados. SDD-0118 pasa a `done`: R29 demostró
el replay completo desde cero y SDD-0172 validó el consumidor E2E sobre ese
schema.

## 8. Rollback

- antes de Cloud: revertir el commit local;
- después de Cloud: forward-fix; no restaurar comentarios ciegamente;
- branch fallido: destruir el branch completo, sin reset, rebase ni SQL ad hoc.
