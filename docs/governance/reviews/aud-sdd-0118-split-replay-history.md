# Reparación del preflight `0271` ante ledger fragmentado

| Control | Valor |
|---|---|
| Revisión | REV-AUD-034 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0279_restore_tenant_lifecycle_acl_history` y `0280_repair_sdd0118_split_history` |
| Resultado | 0279 aplicada; R10/R11 cerrados; 0280 aprobada localmente |

## 1. Recibo individual de `0279`

La autorización nominal se recibió para
`0279_restore_tenant_lifecycle_acl_history`. El preflight metadata-only
confirmó:

- proyecto `xpfuzqombmjmxvprjgmi` `ACTIVE_HEALTHY`;
- sólo `main`, sin branches residuales;
- `0268_tenant_lifecycle_guardrails` con cardinalidad 1 y MD5
  `127a11d4eac9106d621a537b1886c6c3`;
- `0279` ausente;
- FK `entity_audit_log_tenant_id_fkey` validada y `RESTRICT`;
- `anon`, `authenticated` y `service_role` sin DELETE sobre tenants;
- `service_role` con SELECT/INSERT/UPDATE;
- cero policy DELETE sobre tenants.

La aplicación individual devolvió `success=true` y registró:

```text
20260729224850 · 0279_restore_tenant_lifecycle_acl_history
```

El postflight dejó `0268` con cardinalidad 2:

1. `6f6ddc2074c8f8c527fa6150ff8616c5` — REVOKE histórico de roles cliente;
2. `127a11d4eac9106d621a537b1886c6c3` — payload original de 0268.

La FK, ACL y ausencia de policy DELETE permanecieron iguales. Advisors:
125 security y 546 performance, con delta agregado/removido cero. No se
consultaron filas de negocio ni PII.

## 2. R10 falla cerrado

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r10` |
| `branch_id` | `d9406fd7-6311-4c43-84c4-67df434c1d8a` |
| `project_ref` | `xeorwuuvkjtiwnlgpgwo` |
| Costo | USD 0,01344/h |
| Estado final | `MIGRATIONS_FAILED` |

El replay llegó a `0271_repair_branch_replay_history` y abortó:

```text
SDD-0118 preflight: drift en 20260526213130 seed_team_invitation_template
```

No se ejecutaron seed, Auth, E2E ni consultas de negocio. `delete_branch`
devolvió `success=true`; el inventario posterior mostró únicamente `main`.

## 3. R11 demuestra la causa

R11 fue un branch diagnóstico nuevo, sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r11-diagnostic` |
| `branch_id` | `6e58c9e2-ca5c-4cae-b024-ba3aa78fe3ac` |
| `project_ref` | `hkzfdvdrqfngpaggcdbm` |
| Costo | USD 0,01344/h |
| Estado final | `MIGRATIONS_FAILED` |

La fila técnica del seed tenía cardinalidad 63, no 1 ni 2. La inspección
metadata-only de los once objetivos de `0271` confirmó que el motor de branch
fragmenta el SQL histórico en sentencias al materializar el ledger. No existe
drift CRLF: el payload de Producción conserva cero pares CRLF y sus hashes
canónicos.

Fingerprints observados:

| Versión | Nombre | Cardinalidad | MD5 conjunto LF |
|---|---|---:|---|
| 20260526213130 | seed_team_invitation_template | 63 | `b9da059306c4a80875e54947b9338252` |
| 20260527073053 | realtime_dispatch | 110 | `ffa4e66b1ca875226edc55a86b37d780` |
| 20260528060005 | 0026_welcome_email_template_seed | 2 | `c399ccef97c43bcb53a512ae7f89fb1c` |
| 20260528060006 | 0027_qr_print_orders | 24 | `fb618384a1a3f605c1fe8694a03ec937` |
| 20260528060007 | 0031_fix_studio_invite_gen_random_bytes | 1 | `e7f1e2878e508b2338f4f014f8e9578f` |
| 20260528060008 | 0032_fix_studio_invite_ambiguous_token | 1 | `45a1d8ecf3de592e7c2106bb704e709f` |
| 20260528060009 | 0033_grant_service_role_policies | 22 | `1ee346e5e133b78975092b3e35e85ee4` |
| 20260528060010 | 0035_fix_verify_operario_pin_extensions | 5 | `5f11aede669230b8ac8f9e192d71bdd1` |
| 20260528060011 | 0036_fk_user_tenants_profile | 2 | `3793eabacad9b8462e6d79b80c3df1ee` |
| 20260528060012 | 0037_harden_operario_pin_validator | 2 | `b518fb6c89d4e61d28fdde7b7d7cd23c` |
| 20260528060013 | 0039_fix_bug_advance_state_actor_type_cast | 1 | `8d9f6730f9b5d420d2cf807eedaa66d9` |

R11 también terminó con `delete_branch success=true` y ausencia posterior del
ID y project ref; sólo quedó `main`.

## 4. Diseño forward-only de `0280`

`0280_repair_sdd0118_split_history` modifica exclusivamente:

```text
20260729135053 · 0271_repair_branch_replay_history
```

El MD5 original de `0271` es
`0839e50eeb47a158382fc2f6c27d5fe9`. El payload objetivo tiene MD5
`c7b1f468087e249e2ca44359aa3f686f`.

La nueva versión conserva todos los estados anterior/objetivo ya aceptados y
añade, uno por uno, los once fingerprints de R11 al preflight y postflight.
No acepta cardinalidad sola, no usa `LIKE`, no reconstruye filas y no ejecuta
el DDL histórico sobre Producción.

`0280` sólo actualiza `supabase_migrations.schema_migrations`; la segunda
ejecución hace `UPDATE 0` y confirma el mismo digest final.

## 5. Verificación local

- generador determinista y `--check`: verde;
- Vitest focal: 4/4;
- PostgreSQL 15: `UPDATE 1/0`, once fingerprints presentes y rollback;
- PostgreSQL 17: mismo resultado;
- contenedores Docker propios residuales: cero;
- no se modificó producto, seed, Auth, Vercel ni datos de negocio.

REV-AUD-034 aprueba técnicamente el diseño local de 0280.

## 6. Límite operativo

Aplicar `0280_repair_sdd0118_split_history` requiere autorización nominal
nueva conforme al runbook. Sólo después corresponde crear otro branch
completamente nuevo para replay, seed, E2E, verificación y teardown terminal.

CMP-01 v1.1, `deprecated`, D1, slices, D2–D5 y PLG-P3 permanecen cerrados.
