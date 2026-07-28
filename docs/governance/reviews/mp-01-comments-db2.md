# Revisión local de DB-2 para comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-004 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Diseño | [DT-SDD-0168 v1.0](../../specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md) |
| Migración | `0265_comments_lifecycle_hardening` |
| Fecha | 2026-07-28 |
| Resultado técnico | implementación y revisión local aprobadas |
| Estado operativo | Cloud, push, integración, `main` y Producción cerrados |

## 1. Veredicto

DB-2 queda implementado y validado localmente como gate independiente. La
migración reduce el acceso directo a `comments`, endurece la visibilidad de
comentarios eliminados y alinea menciones y reacciones con el estado visible
del comentario padre.

Esta revisión no autoriza aplicar `0265_comments_lifecycle_hardening` en
Supabase Cloud. Tampoco autoriza push, integración, cambios en `main` ni
Producción.

## 2. Controles implementados

- `authenticated` conserva `SELECT`, `INSERT` y únicamente
  `UPDATE (body, edited_at)` sobre `comments`;
- `service_role` pierde `UPDATE`, `DELETE` y `TRUNCATE` directos sobre
  `comments`; las transiciones quedan detrás de las RPC owner-controlled;
- `comments_freeze_immutable()` bloquea cualquier transición lifecycle directa
  y deja de ser invocable por roles cliente o `service_role`;
- un comentario activo es visible para el tenant; uno eliminado sólo queda
  visible al autor durante los 10 segundos de Deshacer y a administradores
  activos para recuperación;
- la edición directa queda limitada al autor de un comentario activo;
- menciones y reacciones sólo son visibles si el comentario padre es visible,
  y sus mutaciones fallan cerrado cuando el padre está eliminado;
- no se introduce hard-delete, purga ni ampliación de restauración a roles no
  administradores.

## 3. Evidencia local

- contrato positivo de `0265` aprobado en PostgreSQL 15 desechable;
- cuatro variantes de drift rechazadas antes del primer cambio:
  política, grant, guard y ACL de RPC;
- regresión encadenada aprobada para
  `0261b → 0262 → 0263 → 0264 → 0265`;
- el contrato prueba edición normal, separación de tenant, usuario
  deshabilitado, visibilidad de Deshacer, recuperación admin, preservación de
  identidad, menciones, reacciones y `read_at`;
- el contrato prueba que `authenticated` no puede cambiar `deleted_at`, que
  `service_role` no puede borrar directamente y que las RPC siguen operativas.

Todos los contenedores de prueba fueron desechables y se eliminaron al
finalizar. No se consultaron filas de negocio.

## 4. Límites y siguiente gate

La corrección global de ACL históricos continúa fuera de alcance. También
permanecen fuera de alcance la purga/hard-delete y la ampliación de restauración
a roles no administradores.

El siguiente gate de base de datos exige autorización individual que nombre
exactamente `0265_comments_lifecycle_hardening`, seguida del runbook de
migraciones de Producción, preflight metadata-only, aplicación de una sola
migración y postcondiciones. Un entorno efímero nuevo conserva además su gate de
costo y creación.
