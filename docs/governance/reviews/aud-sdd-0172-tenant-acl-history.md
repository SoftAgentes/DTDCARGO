# Reparación histórica del ACL tenant antes de `0268`

| Control | Valor |
|---|---|
| Revisión | REV-AUD-033 |
| Fecha | 2026-07-29 |
| SDD | [SDD-0172](../../specs/0172-tenant-fixtures-lifecycle/spec.md) |
| Basenames | `0278_restore_rls_auto_enable_history` y `0279_restore_tenant_lifecycle_acl_history` |
| Resultado | 0278 aplicada; R9 cerrado; 0279 aprobada localmente |

## 1. Recibo individual de `0278`

La autorización nominal se recibió para
`0278_restore_rls_auto_enable_history`. El preflight metadata-only confirmó:

- proyecto `xpfuzqombmjmxvprjgmi` `ACTIVE_HEALTHY`;
- sólo `main`, sin branches residuales;
- `0209_revoke_anon_rpc_sweep` con un statement y MD5
  `c6c722efdb7ff79ef037e0d826739205`;
- `0278` ausente;
- statement 0277 MD5 `3be131a05cb2d712fc92996004ae8b33`;
- función, trigger y ACL RLS sin drift.

La aplicación individual devolvió `success=true`. El ledger registró:

```text
20260729223452 · 0278_restore_rls_auto_enable_history
```

Postcondiciones:

- `0209` conserva una fila y ahora tiene cardinalidad 2;
- statement 1 MD5 `3be131a05cb2d712fc92996004ae8b33`;
- statement 2 MD5 `c6c722efdb7ff79ef037e0d826739205`;
- `pg_get_functiondef(rls_auto_enable)` conserva MD5
  `6998ea6b4c2480f5d2e34b5dcf3f8d36`;
- `anon` y `authenticated` siguen sin EXECUTE;
- `service_role` conserva EXECUTE;
- `ensure_rls` sigue activo con sus tres tags exactos;
- advisors: 125 security y 546 performance, delta agregado/removido cero.

No se consultaron filas de negocio ni PII.

## 2. R9 falla cerrado en `0268`

Se creó un branch nuevo sin datos de Producción:

| Campo | Valor |
|---|---|
| Nombre | `sdd-0172-ephemeral-20260729-r9` |
| `branch_id` | `6746b74f-6fe4-4485-b0ef-d06cae5b259a` |
| `project_ref` | `csekuuxlrtmtubnjxaep` |
| Costo | USD 0,01344/h |
| Estado final | `MIGRATIONS_FAILED` |

El replay superó `0209` y llegó a
`0268_tenant_lifecycle_guardrails`. Su preflight abortó con:

```text
0268 abortado: un rol cliente puede borrar tenants
```

Esto demuestra otro supuesto histórico no reproducible: Producción ya había
retirado `DELETE` de roles cliente cuando se aplicó 0268, pero el replay fresco
llega al preflight con ese privilegio efectivo. El fail-closed es correcto.
No se ejecutaron seed, Auth, fixtures o E2E.

## 3. Teardown terminal R9

`delete_branch` devolvió `success=true` para el ID exacto. El inventario
posterior mostró únicamente `main` `ACTIVE_HEALTHY`; el `branch_id` y
`project_ref` R9 quedaron ausentes.

## 4. Diseño forward-only de `0279`

`0279_restore_tenant_lifecycle_acl_history` modifica únicamente la fila:

```text
20260729053713 · 0268_tenant_lifecycle_guardrails
```

El statement original de 0268 coincide byte a byte con el archivo del
repositorio:

```text
MD5 127a11d4eac9106d621a537b1886c6c3
```

La reparación antepone un único statement:

```sql
revoke delete on table public.tenants from public, anon, authenticated;
```

Su MD5 es `6f6ddc2074c8f8c527fa6150ff8616c5`. Después conserva 0268
como segundo statement. La migración no ejecuta ese REVOKE en Producción, no
toca tablas de negocio y no cambia el comportamiento vivo: sólo hace
reproducible el estado previo que 0268 exige.

El preflight admite exclusivamente cardinalidad 1 con el MD5 original o
cardinalidad 2 con ambos MD5 en ese orden. Cualquier otro estado aborta.

## 5. Verificación local

- generador determinista y `--check`: verde;
- Vitest: 3/3;
- PostgreSQL 15: reproduce R9, aplica 0279 dos veces (`UPDATE 1/0`), ejecuta
  ambos statements, verifica FK RESTRICT, ACL mínima y rollback;
- PostgreSQL 17: mismo resultado;
- `authenticated` pierde DELETE y el intento destructivo falla;
- `service_role` conserva SELECT/INSERT/UPDATE y pierde DELETE;
- Docker residual propio: cero.

REV-AUD-033 aprueba técnicamente el diseño local de 0279.

## 6. Límite operativo

Aplicar 0279 requiere una nueva autorización nominal conforme al runbook.
Después debe crearse otro entorno completamente nuevo para replay, seed, E2E,
verificación y teardown terminal.

No se abren todavía CMP-01 v1.1, `deprecated`, D1, slices, D2–D5 o PLG-P3.
