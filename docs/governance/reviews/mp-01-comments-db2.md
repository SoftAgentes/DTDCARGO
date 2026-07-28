# Revisión local de DB-2 para comentarios MP-01

| Control | Valor |
|---|---|
| Revisión | REV-MP-004 |
| SDD | [SDD-0168](../../specs/0168-mp-01-comentarios-permanencia-restauracion/spec.md) |
| Diseño | [DT-SDD-0168 v1.0](../../specs/0168-mp-01-comentarios-permanencia-restauracion/diseno-tecnico.md) |
| Migración | `0265_comments_lifecycle_hardening` |
| Fecha | 2026-07-28 |
| Resultado técnico | implementación local y aplicación Cloud verificadas |
| Estado operativo | Cloud cerrado; push, integración, `main` y Producción APP cerrados |

## 1. Veredicto

DB-2 quedó implementado y validado localmente como gate independiente. Sam
(founder) autorizó por basename exacto
`0265_comments_lifecycle_hardening`, que fue aplicada y verificada en Supabase
Cloud el 2026-07-28.

La migración reduce el acceso directo a `comments`, endurece la visibilidad de
comentarios eliminados y alinea menciones y reacciones con el estado visible
del comentario padre. Esta aplicación no autoriza push, integración, cambios
en `main` ni Producción APP.

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

## 4. Recibo de Supabase Cloud

- ledger: versión `20260728220034`, basename exacto
  `0265_comments_lifecycle_hardening`;
- preflight fresco: 0265 ausente, 0264 como última migración, tres tablas con
  RLS, seis columnas lifecycle, 14 políticas esperadas y cero locks;
- postcondiciones: contrato exacto de 14 políticas, `authenticated` sin UPDATE
  general y con `UPDATE (body, edited_at)`, `service_role` sin
  UPDATE/DELETE/TRUNCATE directo y RPCs lifecycle con ACL intacto;
- `comments_freeze_immutable()` conserva owner `postgres`, `search_path` vacío,
  no es security definer, bloquea cambios lifecycle directos y no tiene EXECUTE
  para `anon`, `authenticated` ni `service_role`;
- la política de lectura verifica recuperación admin, Deshacer propio durante
  `00:00:10`, reloj de base de datos y `lifecycle_contract_version = 1`;
- cero locks al terminar y cero hallazgos de seguridad del dominio en los
  advisors.

Los avisos de rendimiento del dominio son informativos y preexistentes:
foreign keys sin índice de cobertura e índices todavía no observados en uso.
No fueron introducidos ni ampliados por 0265.

## 5. Límites y siguiente gate

La corrección global de ACL históricos continúa fuera de alcance. También
permanecen fuera de alcance la purga/hard-delete y la ampliación de restauración
a roles no administradores.

El siguiente gate exige consultar y confirmar el costo vigente de un entorno
efímero nuevo, crearlo sin datos de Producción, vincularlo exclusivamente al
Preview y repetir el recorrido E2E autenticado. Push e integración conservan
sus autorizaciones separadas.
