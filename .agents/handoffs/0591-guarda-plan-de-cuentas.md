# Handoff — SDD-0591 · Cambiar el plan de cuentas queda para accounting y admin

- **Owner / sesión:** Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`. Es la sesión del Director, que hizo la tarea por pedido literal de Sam: «Haz esta tarea aquí: “Restringir quién puede cambiar la tabla de cuentas”».
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\guarda-accounts`
- **Rama:** `codex/guarda-accounts`, desde `origin/main` `1c2286f1f`
- **SDD:** 0591. Reserva local por plumbing: `sdd:next --reserve` se cancela porque GitHub corta la conexión a mitad del inventario de PR. El inventario sin reserva sí terminó y dio 0591.
- **Migración:** 0510. Las 0498 a 0509 están en ramas sin fusionar.

## Objetivo

Que solo `accounting` y `admin` puedan crear, cambiar o borrar cuentas de `public.accounts`, también por PostgREST. Es la condición que Sam aceptó al quitar el filtro de la 0497: antes del uso real del ERP.

## Alcance y aceptación

Allowlist y aceptación en `docs/specs/0591-guarda-plan-de-cuentas/spec.md`.

## Dependencias y permisos

- Sin orden obligatorio respecto de 0496 y 0497.
- **Producción:** solo lectura de catálogo y conteo de miembros por rol. No se escribió nada.
- **Aplicar la 0510:** exige OK de Sam nombrando el archivo, por `docs/runbooks/aplicar-migraciones-prod.md`. No está autorizado.
- **Publicar:** PR en borrador contra `main`, sin fusionar.

## Validación

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contrato, control rojo y mutantes en PGlite | PASÓ, 13 de 13 | `rls-escritura-accounts.migration.test.ts` |
| Contrato en `postgres:17` con psql | PASÓ, 101 aserciones | control rojo: `commercial-A pudo dar de alta en accounts` |
| Preflight contra el catálogo de producción | PASÓ, solo lectura y con ROLLBACK | 2026-11-02 |
| `docs:check`, `sdd:check`, `governance:check`, `pending-migration-symbols`, ESLint del archivo | PASÓ | |
| CI «Calidad local sin secretos» | pendiente al publicar | |
| `pnpm verify` | NO EJECUTADO: espera turno pesado | |
| Aplicar en producción | NO EJECUTADO: exige OK de Sam | |

Un mutante sobrevivió la primera vuelta: el WITH CHECK de UPDATE sin el tenant. Faltaba una prueba, no sobraba código: si la sentencia lee alguna columna, Postgres aplica también la policy de SELECT a la fila nueva, y eso tapaba la falta. El contrato agregó el caso sin leer columnas.

## FUERA DE ALCANCE DETECTADO

1. `accounting` y `admin` todavía pueden hacer el PATCH por PostgREST. La regla «una cuenta con movimientos no se vuelve grupo» vive solo en `updateAccount`.
2. `journal_entries`, `journal_lines` y `company_bank_accounts` tienen el mismo hueco: policy FOR ALL que solo pide el tenant, medido en producción el 2026-11-02. Necesitan su propio inventario de escritores.

## Impacto documental

Spec nueva e índice de specs regenerado. Sin cambios en runbooks. Graphify y Archify: pendiente de registrar al cierre.
