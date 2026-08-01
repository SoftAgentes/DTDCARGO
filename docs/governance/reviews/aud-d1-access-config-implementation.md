# Revisión técnica de implementación D1 — acceso y configuración

| Control | Valor |
|---|---|
| Revisión | REV-AUD-018 |
| SDD | [SDD-0174](../../specs/0174-audit-atomicidad-dominios/spec.md) |
| Migración | `0289_audit_d1_access_configuration` |
| Fecha | 2026-07-30 |
| Resultado | aplicado y verificado en Producción por REV-AUD-042 |

## Veredicto

Las 24 operaciones obligatorias de acceso/configuración dejaron de depender de
escrituras posteriores best-effort. `audit_d1_execute` encapsula negocio y
evento en una sola transacción PostgreSQL. Suspender/reactivar usuarios usa un
registro durable de intención, efecto externo Auth y transición final
reconciliable; no se declara atomicidad ACID distribuida.

## Evidencia

- la migración aborta ante colisiones y fija `search_path=''`;
- `PUBLIC` y `anon` no ejecutan las fronteras;
- el actor y tenant derivan de sesión y membresía admin activas;
- `operation_id` evita duplicados y detecta conflictos;
- la auditoría usa allowlists sin secretos, tokens, cuentas o PII;
- la prueba SQL pasó en PostgreSQL 17 y termina con rollback;
- siete pruebas Vitest de adapters y workflow pasaron;
- TypeScript y `git diff --check` pasaron.

## Aplicación en Producción

REV-AUD-042 registra `0289_audit_d1_access_configuration` con basename exacto,
RLS, ACL, tres funciones selladas y ledger verificados. El primer transporte
truncado hizo rollback total antes del reintento íntegro.

## Límites

La aplicación no declara atomicidad ACID entre PostgreSQL y Supabase Auth.
Corte E, correos, PDF, Vercel y plugin no forman parte de D1.
