# Aplicación de `0283`, replay R15 y reparación del split de `pin_search_path`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-038 |
| Fecha | 2026-07-30 |
| SDD | [SDD-0118](../../specs/0118-seed-migrations-idempotentes/spec.md) · [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0283_repair_calculator_settings_split_history` y `0284_repair_pin_search_path_split_history` |
| Resultado | 0283 aplicada; R15 cerrado; 0284 aprobada localmente |

## 1. Recibo individual de `0283`

El preflight metadata-only fresco confirmó Producción
`xpfuzqombmjmxvprjgmi` saludable, `0274` presente una sola vez con MD5 fuente
`6ddc823788cbdd6b280810d7ae61a86c`, `0282` presente y `0283` ausente. La
aplicación fue individual, usó el basename autorizado exacto y devolvió
`success=true`.

Producción registró:

```text
20260730132651 · 0283_repair_calculator_settings_split_history
```

El postflight confirmó:

- un único recibo de `0283`;
- `0274` con cardinalidad 1 y MD5 objetivo
  `7dec3bd4977326580000cbdb0d528305`;
- compatibilidad exacta con el split R14 y target canónico de `0103`;
- cero DDL, Auth o DML de negocio.

Los advisors posteriores conservaron el inventario previo:

- security: 125 avisos (`INFO` 5, `WARN` 120);
- performance: 546 avisos (`INFO` 430, `WARN` 116).

`0283` sólo sustituyó metadata del ledger. No se atribuye a ella ese backlog
preexistente.

## 2. Replay R15 y teardown terminal

Se confirmó el costo vigente de USD 0,01344/h y se creó un entorno sin datos:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-r15-20260730` |
| `branch_id` | `d97e81ba-94aa-4fd7-b4c6-bc4a9d8919df` |
| `project_ref` | `dmzhnfmiolvjsuzehcbq` |
| Padre | `xpfuzqombmjmxvprjgmi` |
| Estado final | `MIGRATIONS_FAILED` |

R15 superó `0283`. El replay abortó exactamente en:

```text
SDD-0118 pin_search_path: drift en 20260703235255 0210_pin_search_path_triggers
```

La inspección fue metadata-only. El ledger contenía el target de
`0210_pin_search_path_triggers` como 33 statements, con MD5 combinado
`442a34163980f1fc26bf6f930347b8a1`. Los fingerprints y longitudes están en
[REV-AUD-019](aud-tenant-fixtures-ephemeral-validation.md#25-decimoquinto-intento-después-de-0283).

No se ejecutaron seed, Auth ni E2E sobre el schema incompleto. No se leyeron
filas de negocio ni PII. `delete_branch` devolvió `success=true`; el
inventario posterior mostró únicamente `main`, por lo que el teardown quedó
terminal.

## 3. Diseño forward-only de `0284`

`0284_repair_pin_search_path_split_history` sustituye exclusivamente el
payload almacenado de:

```text
20260729152036 · 0275_restore_pin_search_path_history
```

El payload exacto de Producción tiene cardinalidad 1, longitud 5.105 y MD5
`a217fa825ff964f2c2a4cb26d31c3dbc`. El generador produce el payload objetivo
con MD5 `cad36533b4225b674f1d8fd7b8c165ea`.

La versión reparada:

1. conserva los estados NULL y canónico ya reconocidos por `0275`;
2. acepta sólo la variante de 33 statements y digest combinado observados en
   R15;
3. colapsa ese estado al target reproducible de un statement con MD5
   `c3131d8ea3756049d6455bc98b4d0ecc`;
4. aborta ante versión, nombre, cardinalidad o digest distintos;
5. modifica sólo `supabase_migrations.schema_migrations`;
6. es idempotente.

El archivo local mide 6.938 bytes y tiene SHA-256
`7E2886A86D6D2B99DA976329FA312D4867DC0DE8D336D74F12CCF78237B46F64`.

## 4. Verificación local

- generación determinista y `--check`: verde;
- Vitest focal: 4/4;
- contratos SQL PostgreSQL 15: 23/23;
- contratos SQL PostgreSQL 17: 23/23;
- el fixture reproduce los 33 statements de R15, aplica dos veces 0284,
  ejecuta el payload reparado de 0275, verifica las 33 firmas con
  `search_path=public` y termina en rollback;
- `0284` está clasificada como ledger-only en el rebuild;
- `0283` salió de pendientes y `0284` quedó registrada en
  `migrations-baseline.json`.

REV-AUD-038 aprueba técnicamente el diseño local de `0284`.

## 5. Límite operativo

`0284_repair_pin_search_path_split_history` es un basename nuevo descubierto
por evidencia de R15. Conforme al runbook, su aplicación en Producción exige
autorización que nombre literalmente ese basename.

Después de la aplicación individual corresponde crear R16 completamente
nuevo para replay, seed sintético, E2E, verificación y teardown terminal.
SDD-0118 y SDD-0172 continúan `in-progress` hasta demostrar ese recorrido.
