---
sdd: "0118"
title: "Historial reproducible — habilitar validación en branch efímero de Supabase"
status: in-progress
author: "Claude Code (Director) + founder"
created: 2026-06-29
updated: 2026-07-29
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

## 3. Generación y control de drift

El generador
`scripts/build-sdd-0118-repair.mjs`:

1. valida los digests del estado remoto observado;
2. lee los doce archivos fuente del repositorio;
3. normaliza únicamente finales de línea;
4. calcula y publica el digest de cada payload;
5. genera `0271` y su prueba transaccional;
6. ofrece `--check` para impedir drift entre fuentes y artefactos.

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
| Spec | `docs/specs/0118-seed-migrations-idempotentes/spec.md` |
| Revisión | `docs/governance/reviews/aud-sdd-0118-branch-replay.md` |

## 6. Evidencia local

| Gate | Resultado |
|---|---|
| Generación determinista | verde · `node scripts/build-sdd-0118-repair.mjs --check` |
| Vitest focal | verde · 1 archivo · 3 pruebas |
| PostgreSQL 15 | verde · 11 cambios + segunda ejecución idempotente + rollback |
| PostgreSQL 17 | verde · 11 cambios + segunda ejecución idempotente + rollback |
| Residuo Docker propio | cero |
| Cloud | `0271` aplicada individualmente · [REV-AUD-021](../../governance/reviews/aud-sdd-0118-branch-replay-application.md) |
| Segundo branch | 63 migraciones; fallo preciso en `0031`; teardown terminal |
| Follow-up local | `0272` verde en Vitest y PostgreSQL 15/17 · [REV-AUD-022](../../governance/reviews/aud-sdd-0118-branch-replay-followup.md) |
| Follow-up Cloud | `0272` aplicada individualmente; recibo `20260729140214` · [REV-AUD-023](../../governance/reviews/aud-sdd-0118-branch-replay-followup-application.md) |
| Tercer branch | 83 migraciones; fallo preciso en `platform_admins`; teardown terminal |
| Diff | verde |

## 7. Gates restantes

1. diseñar y aprobar una reparación forward-only del seed histórico de
   `platform_admins`;
2. aplicar esa reparación sólo con autorización expresa del basename;
3. crear un entorno efímero nuevo y completar replay, seed, E2E, verificación
   y teardown terminal.

SDD-0118 permanece `in-progress` hasta que un entorno nuevo demuestre el
replay completo. Un test local verde no sustituye esa evidencia.

## 8. Rollback

- antes de Cloud: revertir el commit local;
- después de Cloud: forward-fix; no restaurar comentarios ciegamente;
- branch fallido: destruir el branch completo, sin reset, rebase ni SQL ad hoc.
