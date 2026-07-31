# Revisión técnica de implementación D1 — acceso y configuración

| Control | Valor |
|---|---|
| Revisión | REV-AUD-018 |
| SDD | [SDD-0174](../../specs/0174-audit-atomicidad-dominios/spec.md) |
| Migración | `0289_audit_d1_access_configuration` |
| Fecha | 2026-07-30 |
| Resultado | aprobado localmente |

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

## Límites

La revisión no afirma aplicación en Producción. `0289` requiere preflight
metadata-only fresco, autorización nominal y aplicación individual. D2–D5,
`0270`, Corte E, correos, PDF, Vercel y plugin no forman parte de D1.
