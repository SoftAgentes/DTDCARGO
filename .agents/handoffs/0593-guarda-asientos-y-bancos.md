# Handoff — SDD-0593 · Escribir asientos queda para accounting y admin; las cuentas bancarias, por su RPC

- **Owner / sesión:** Claude Opus 5.5, `eeeb0433-bf95-4b6b-8cdc-d201699e5f95`. Es la sesión del Director, que hizo la tarea por pedido literal de Sam: «Haz esta tarea aquí: “Restringir quién escribe asientos y cuentas bancarias”».
- **Ruta:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\guarda-asientos`
- **Rama:** `codex/guarda-asientos`, desde `origin/main` `1c2286f1f`
- **SDD:** 0593. Reserva local por plumbing, igual que la 0591.
- **Migración:** 0511. La 0510 es de la SDD-0591, rama `codex/guarda-accounts`. Las dos ramas no comparten archivos salvo `supabase/migrations-baseline.json` y `docs/specs/README.md`.

## Objetivo

Que solo `accounting` y `admin` escriban asientos por el cliente de sesión, que las líneas solo se inserten, y que las cuentas bancarias de la empresa solo se escriban por `audit_d1_execute`.

## Alcance y aceptación

Allowlist y aceptación en `docs/specs/0593-guarda-asientos-y-bancos/spec.md`.

## Dependencias y permisos

- Sin dependencia de cuerpos de la 0497; va después en el orden del ledger.
- **Producción:** solo lectura de catálogo y conteos, sin filas. No se escribió nada.
- **Aplicar la 0511:** exige OK de Sam nombrando el archivo, por `docs/runbooks/aplicar-migraciones-prod.md`. No está autorizado.
- **Publicar:** PR en borrador contra `main`, sin fusionar.

## Validación

| Comprobación | Resultado | Evidencia |
|---|---|---|
| Contrato, control rojo y mutantes en PGlite | PASÓ, 20 de 20 | `rls-escritura-asientos-y-bancos.migration.test.ts` |
| Contrato en `postgres:17` con psql | PASÓ, 175 aserciones | control rojo: `commercial-A pudo crear un asiento` |
| Preflight contra el catálogo de producción | PASÓ, solo lectura y con ROLLBACK | 2026-11-02 |
| `docs:check`, `sdd:check`, `governance:check`, `pending-migration-symbols`, ESLint del archivo | PASÓ | |
| CI «Calidad local sin secretos» | pendiente al publicar | |
| `pnpm verify` | NO EJECUTADO: espera turno pesado | |
| Aplicar en producción | NO EJECUTADO: exige OK de Sam | |

**Límite:** `audit_d1_execute` es un doble en el contrato; el preflight comprueba en producción que la real es DEFINER de postgres. Esa pantalla no se probó de punta a punta: conviene guardar una cuenta bancaria como administrador en prueba después de aplicar la migración allí.

La misma lección de la SDD-0591 con el WITH CHECK de UPDATE: el contrato agregó el caso que no lee columnas.

## FUERA DE ALCANCE DETECTADO

1. `accounting` y `admin` todavía pueden alterar un asiento asentado por PATCH a `journal_entries`.
2. `company_offices` y otras tablas sin medir pueden tener el mismo patrón: conviene un barrido por catálogo.
3. La lectura de asientos sigue siendo de todo el equipo, deuda deliberada de la 0407.

## Impacto documental

Spec nueva e índice de specs regenerado. Sin cambios en runbooks. Graphify y Archify: pendiente de registrar al cierre.
