# Aplicación de `0280` y reparación del skip de invitaciones fragmentado

| Control | Valor |
|---|---|
| Revisión | REV-AUD-035 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0280_repair_sdd0118_split_history` y `0281_repair_invite_skip_split_history` |
| Resultado | 0280 aplicada; replay R12 cerrado; 0281 aprobada localmente |

## 1. Recibo individual de `0280`

La autorización nominal se recibió para
`0280_repair_sdd0118_split_history`. El preflight metadata-only fresco
confirmó:

- proyecto de Producción `xpfuzqombmjmxvprjgmi` saludable;
- `0271_repair_branch_replay_history` con versión `20260729135053`,
  cardinalidad 1 y MD5
  `0839e50eeb47a158382fc2f6c27d5fe9`;
- `0279_restore_tenant_lifecycle_acl_history` presente;
- `0280` ausente;
- archivo local de 138.546 bytes y SHA-256
  `760320EC7A033F7586CC9D349A820C7F3419A2C04B1B6B9C75D7F1915C32BB72`.

La aplicación fue individual y devolvió `success=true`. Producción registró:

```text
20260730002206 · 0280_repair_sdd0118_split_history
```

El postflight confirmó cardinalidad 1 para `0280` y transformó sólo el
payload de `0271` al MD5 objetivo
`c7b1f468087e249e2ca44359aa3f686f`. Los once fingerprints fragmentados
quedaron presentes. No se ejecutó DDL histórico ni se consultaron filas de
negocio o PII.

Los advisors conservaron el inventario previo:

- security: 125 avisos (`INFO` 5, `WARN` 120);
- performance: 546 avisos (`INFO` 430, `WARN` 116).

No se atribuye ese backlog preexistente a `0280`: la migración sólo modifica
metadata del ledger y no crea schema, funciones, policies o índices.

## 2. Replay R12 falla cerrado

El branch llevaba `r10` en su nombre operativo, pero se registra como **R12**
porque R10 y R11 ya estaban cerrados en REV-AUD-034.

| Campo | Valor |
|---|---|
| Nombre proveedor | `sdd-0172-r10-20260729` |
| `branch_id` | `5b6d5aae-2490-4a5b-8ee0-e0c19d30f8d0` |
| `project_ref` | `pmrzaqhrfnhplodltuql` |
| Costo | USD 0,01344/h |
| Estado observado | `MIGRATIONS_FAILED` |

R12 superó `0271`, lo que demuestra la postcondición principal de `0280`.
El siguiente preflight que falló fue `0272_skip_superseded_invite_history`:

```text
SDD-0118 follow-up: drift en
20260528060007 0031_fix_studio_invite_gen_random_bytes
```

La inspección fue metadata-only. El ledger del branch contenía:

| Versión | Nombre | Cardinalidad | MD5 |
|---|---|---:|---|
| `20260528060007` | `0031_fix_studio_invite_gen_random_bytes` | 1 | `e7f1e2878e508b2338f4f014f8e9578f` |
| `20260528060008` | `0032_fix_studio_invite_ambiguous_token` | 1 | `45a1d8ecf3de592e7c2106bb704e709f` |

Son exactamente los estados fragmentados ya reconocidos por `0280`; `0272`
todavía sólo admitía los hashes compactos anteriores o sus no-op finales.
No se ejecutaron seed, Auth, E2E ni consultas de negocio.

`delete_branch` devolvió `success=true`. El inventario terminal posterior
mostró únicamente `main`; el ID y el project ref de R12 ya no existen.

## 3. Diseño forward-only de `0281`

`0281_repair_invite_skip_split_history` modifica exclusivamente el payload
almacenado de:

```text
20260729140214 · 0272_skip_superseded_invite_history
```

El payload exacto de Producción tiene MD5
`887cc625c50ba8f6a2292bad25989fc5`. El generador preserva su CRLF terminal,
valida ese digest y produce un payload objetivo con MD5
`4242bf102d649559d13793b53e46f43c`.

La versión reparada:

1. conserva todos los estados originales de `0272`;
2. admite de forma exacta los hashes fragmentados de `0031` y `0032`;
3. transforma esos dos estados a los no-op finales ya definidos por `0272`;
4. aborta ante versión, nombre, cardinalidad o digest distintos;
5. actualiza sólo `supabase_migrations.schema_migrations`;
6. confirma idempotencia con `UPDATE 1` y luego `UPDATE 0`.

No inventa usuarios, no ejecuta funciones históricas y no toca tablas de
negocio, Auth, Storage o Vercel.

## 4. Verificación local

- generador determinista y `--check`: verde;
- Vitest focal: 4/4;
- contratos SQL: 20/20, incluido rollback total de `0281`;
- TypeScript: verde;
- `0281` clasificada como ledger-only en el rebuild del schema;
- baseline de migraciones: `0279` retirada de pendientes y `0281` registrada
  con gate nominal.

REV-AUD-035 aprueba técnicamente el diseño local de `0281`.

## 5. Límite operativo

`0281_repair_invite_skip_split_history` es un basename nuevo descubierto por
evidencia de R12. El runbook exige autorización literal de ese basename antes
de aplicarlo en Producción. Hasta entonces no corresponde crear R13.

Después de su aplicación individual, R13 debe ser un entorno completamente
nuevo para replay, seed sintético, E2E, verificación y teardown terminal.
SDD-0118 y SDD-0172 continúan `in-progress` hasta demostrar ese recorrido.
