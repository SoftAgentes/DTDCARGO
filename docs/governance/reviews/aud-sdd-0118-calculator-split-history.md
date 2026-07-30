# Aplicación de `0282`, replay R14 y reparación del split de `calculator_settings`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-037 |
| Fecha | 2026-07-30 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0282_repair_platform_admin_skip_split_history` y `0283_repair_calculator_settings_split_history` |
| Resultado | 0282 aplicada; R14 cerrado; 0283 aprobada localmente |

## 1. Recibo individual de `0282`

El preflight metadata-only fresco confirmó el proyecto de Producción
`xpfuzqombmjmxvprjgmi` saludable, `0273` presente una sola vez con el payload
fuente esperado y `0282` ausente. La aplicación fue individual, usó el
basename autorizado exacto y devolvió `success=true`.

Producción registró:

```text
20260730130403 · 0282_repair_platform_admin_skip_split_history
```

El postflight confirmó:

- un único recibo de `0282`;
- `0273` con cardinalidad 1 y MD5 objetivo
  `7866d00b211f8158f79117657fd8a8d1`;
- presencia del fingerprint combinado R13
  `4912baa3058c9f1a4f2281b843499fcd`;
- cero DDL, Auth o DML de negocio.

Los advisors posteriores conservaron el inventario anterior:

- security: 125 avisos (`INFO` 5, `WARN` 120);
- performance: 546 avisos (`INFO` 430, `WARN` 116).

`0282` sólo sustituyó metadata del ledger. No se atribuye a ella ese backlog
preexistente.

## 2. Replay R14 y teardown terminal

Se confirmó el costo vigente de USD 0,01344/h y se creó un entorno sin datos:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r14-20260730` |
| `branch_id` | `ab5435b9-ec23-4d45-b475-9a32a4c945a4` |
| `project_ref` | `stgnxiuofbxzzsndcqlw` |
| Padre | `xpfuzqombmjmxvprjgmi` |
| Estado final | `MIGRATIONS_FAILED` |

R14 superó `0273`. El siguiente preflight abortó exactamente en:

```text
SDD-0118 calculator_settings: drift en 20260604131310 0103_calculator_settings
```

La inspección fue metadata-only. El ledger contenía el target de
`calculator_settings` como doce statements, con MD5 combinado
`f7102aeb22551a4628923dfba5d11793`. Los doce fingerprints y sus longitudes
quedaron registrados en
[REV-AUD-019](aud-tenant-fixtures-ephemeral-validation.md#24-decimocuarto-intento-después-de-0282).

No se intentó reparar R14 manualmente y no se ejecutaron seed, Auth o E2E
sobre un schema incompleto. `delete_branch` devolvió `success=true`; el
inventario posterior mostró únicamente `main`, por lo que el teardown quedó
terminal.

## 3. Diseño forward-only de `0283`

`0283_repair_calculator_settings_split_history` sustituye exclusivamente el
payload almacenado de:

```text
20260729143620 · 0274_restore_calculator_settings_history
```

El payload exacto de Producción tiene cardinalidad 1, longitud 8.093 y MD5
`6ddc823788cbdd6b280810d7ae61a86c`. El generador preserva su CRLF terminal y
produce el payload objetivo con MD5
`7dec3bd4977326580000cbdb0d528305`.

La versión reparada:

1. conserva los estados NULL y canónico ya reconocidos por `0274`;
2. acepta sólo la variante de doce statements y digest combinado observados
   en R14;
3. colapsa ese estado al target reproducible de un statement con MD5
   `0f7deee22e3a978c52159b6fc211ee2c`;
4. aborta ante versión, nombre, cardinalidad o digest distintos;
5. modifica sólo `supabase_migrations.schema_migrations`;
6. es idempotente.

El archivo local mide 10.531 bytes y tiene SHA-256
`CBC0A001D43BFC28A16B2F1BB93D1A5076B50A27424E2974978A1EBE6D0E4823`.
El CRLF contractual se construye en runtime con
`chr(13) || chr(10)` para impedir que la normalización LF de Git altere el
digest almacenado.

## 4. Verificación local

- generación determinista y `--check`: verde;
- Vitest focal: 4/4;
- contratos SQL PostgreSQL 17: 22/22;
- el fixture reproduce los doce statements de R14, aplica dos veces 0283,
  ejecuta el payload reparado de 0274, verifica tabla, FKs, RLS, ACL, trigger,
  RPC y seed sintético, y termina en rollback;
- `0283` está clasificada como ledger-only en el rebuild;
- `0282` salió de pendientes y `0283` quedó registrada en
  `migrations-baseline.json`.

REV-AUD-037 aprueba técnicamente el diseño local de `0283`.

## 5. Límite operativo

`0283_repair_calculator_settings_split_history` es un basename nuevo
descubierto por evidencia de R14. El runbook exige que el founder lo nombre
literalmente antes de aplicarlo en Producción. Las autorizaciones anteriores
no sustituyen ese gate nominal.

Después de su aplicación individual corresponde crear R15 completamente nuevo
para replay, seed sintético, E2E, verificación y teardown terminal. SDD-0118 y
SDD-0172 continúan `in-progress` hasta demostrar ese recorrido.
