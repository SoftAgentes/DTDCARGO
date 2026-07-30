# Aplicación de `0281`, replay R13 y reparación del split de `platform_admins`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-036 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0281_repair_invite_skip_split_history` y `0282_repair_platform_admin_skip_split_history` |
| Resultado | 0281 aplicada; R13 cerrado; 0282 aprobada localmente |

## 1. Recibo individual de `0281`

La autorización nominal se recibió para
`0281_repair_invite_skip_split_history`. El preflight metadata-only fresco
confirmó:

- proyecto de Producción `xpfuzqombmjmxvprjgmi` saludable;
- un solo recibo de `0272_skip_superseded_invite_history`, versión
  `20260729140214`, con el payload fuente esperado;
- `0280_repair_sdd0118_split_history` presente una sola vez;
- `0281` ausente;
- archivo local de 4.535 bytes y SHA-256
  `A1364A506378EF031BFAA4DE88A9545C5CFCBA5BF8FFD3A9F30BC974B39EA631`.

La aplicación fue individual, con el basename exacto, y devolvió
`success=true`. Producción registró:

```text
20260730011643 · 0281_repair_invite_skip_split_history
```

El postflight confirmó:

- un único recibo de `0281`;
- `0272` con cardinalidad 1 y MD5 objetivo
  `4242bf102d649559d13793b53e46f43c`;
- presencia de los fingerprints fragmentados de `0031` y `0032`;
- cero DDL, Auth o DML de negocio.

Los advisors conservaron el inventario previo:

- security: 125 avisos (`INFO` 5, `WARN` 120);
- performance: 546 avisos (`INFO` 430, `WARN` 116).

`0281` sólo sustituyó metadata del ledger. No se atribuye a ella ese backlog
preexistente.

## 2. Replay R13 y teardown terminal

Se confirmó el costo vigente de USD 0,01344/h y se creó un entorno sin datos:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r13-20260729` |
| `branch_id` | `361cf50e-3fe0-47e9-b73c-7b54b05c8489` |
| `project_ref` | `tieiplsepiezyqkqfywe` |
| Padre | `xpfuzqombmjmxvprjgmi` |
| Estado final del intento | `MIGRATIONS_FAILED` |

R13 superó `0271` y `0272`. El siguiente preflight abortó exactamente en:

```text
SDD-0118 platform_admins: drift en 20260529071707 platform_admins
```

La inspección fue metadata-only. No leyó filas de negocio ni PII. El ledger
del branch contenía el target replay-safe de `platform_admins` como diez
statements:

| Ordinal | Longitud | MD5 |
|---:|---:|---|
| 1 | 1175 | `43f2ea05eb0ae13de285ce938f5c1490` |
| 2 | 159 | `9d3d7de154303b5aa9ccb35e1e06152e` |
| 3 | 60 | `8de52969792cd9e2cf497059316f9028` |
| 4 | 306 | `f502423fc129505bee3493700051eec7` |
| 5 | 331 | `3cce9d25173f4f3a7c086e65b9756408` |
| 6 | 55 | `4d486d82a86dbd6ade967f3096dd9e54` |
| 7 | 51 | `babee21a3d2cd93af5a9f1ccde8f8f62` |
| 8 | 433 | `fbf7f0d94cdfe8122795825c06419ba7` |
| 9 | 69 | `8d0596a81130a0d20c5cc512013dad32` |
| 10 | 138 | `8f5898d246c5d3f6281a7aedce7ced71` |

El MD5 de `array_to_string(statements, E'\n')` fue
`4912baa3058c9f1a4f2281b843499fcd`.

No se intentó reparar R13 manualmente y no se ejecutaron seed, Auth o E2E
sobre un schema incompleto. `delete_branch` devolvió `success=true`; el
inventario posterior mostró únicamente `main`, por lo que el teardown quedó
terminal.

## 3. Diseño forward-only de `0282`

`0282_repair_platform_admin_skip_split_history` sustituye exclusivamente el
payload almacenado de:

```text
20260729141805 · 0273_skip_platform_admin_bootstrap_history
```

El payload exacto de Producción tiene cardinalidad 1 y MD5
`22cac3383ef1d3c9a0a814508cc4c817`. El generador preserva su CRLF terminal y
produce el payload objetivo con MD5
`7866d00b211f8158f79117657fd8a8d1`.

La versión reparada:

1. conserva los tres estados de un statement ya reconocidos por `0273`;
2. acepta sólo la variante de diez statements y digest combinado observados
   en R13;
3. colapsa ese estado al target replay-safe de un statement con MD5
   `cb374d4ad4c3b2bb62915e80a5a13793`;
4. aborta ante versión, nombre, cardinalidad o digest distintos;
5. modifica sólo `supabase_migrations.schema_migrations`;
6. es idempotente.

El archivo local mide 6.567 bytes y tiene SHA-256
`B7219A4572243FF48C6EF3C6DE835C9FDFEDE6DAC815CE9E243BFB28BCA0ACB7`.
El CRLF contractual del payload se construye en runtime con
`chr(13) || chr(10)` para impedir que la normalización LF de Git altere el
digest almacenado.

## 4. Verificación local

- generación determinista y `--check`: verde;
- Vitest focal: 4/4;
- contratos SQL PostgreSQL 17: 21/21;
- el fixture ejecuta los nueve statements DDL previos, aplica dos veces 0282,
  reproduce 0273, confirma cero `platform_admins` y termina en rollback;
- `0282` está clasificada como ledger-only en el rebuild;
- `0281` salió de pendientes y `0282` quedó registrada en
  `migrations-baseline.json`.

REV-AUD-036 aprueba técnicamente el diseño local de `0282`.

## 5. Límite operativo

`0282_repair_platform_admin_skip_split_history` es un basename nuevo
descubierto por evidencia de R13. El runbook exige que el founder lo nombre
literalmente antes de aplicarlo en Producción. La autorización previa de 0281
no sustituye ese gate nominal.

Después de su aplicación individual corresponde crear R14 completamente nuevo
para replay, seed sintético, E2E, verificación y teardown terminal. SDD-0118 y
SDD-0172 continúan `in-progress` hasta demostrar ese recorrido.
