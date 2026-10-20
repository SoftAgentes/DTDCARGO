# Handoff · SDD-0565 · Ninguna cuenta del plan queda huérfana

| Campo | Valor |
|---|---|
| Fecha | 2026-10-19, en Caracas de 14:10 a 14:50 aprox. (UTC 18:10 a 18:50) |
| Task ID / owner | `contabilidad-2026-10-18` / sesión Worker «Contabilidad» |
| Worktree | `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\sdd-0565-cuenta-padre-obligatoria` |
| Rama | `codex/sdd-0565-cuenta-padre-obligatoria`, desde `origin/main` `d06f50b4` |
| SDD | [0565](../../docs/specs/0565-cuenta-padre-obligatoria/spec.md), `in-progress`. La reserva es `codex/sdd-reserve-0565` (`0eb673a7`, con `sdd:next --reserve cuenta-padre-obligatoria --number 0565 --push`) y entró por cherry-pick |
| Estado | lista para revisión: PR #291 en borrador, con `verify` 16/17 sin fallos sobre `4297bfbf` y `main` mezclado en `ea831aec` |
| Permisos | El Director la asignó el 2026-10-19, como el paso 2 de la cola después de la #288. Eso cubre commits selectivos, push de la rama propia y PR en borrador. No incluye producción, base de datos ni migración |

## OBJETIVO ORIGINAL

Decisión del Director del 2026-10-19 (revisable por Sam), citada textual en la spec:
- exigir la cuenta padre en `validateAccountInput`;
- bloquear el borrado de una cuenta con subcuentas;
- las dos como propiedad, con su control rojo, resueltas primero en `lib/`.

## COMPLETADO

- **`lib/studio/account-types.ts`:**
  - `cuentaPadreFaltante` y `subcuentasDe`, puras. Las subcuentas se buscan por prefijo de código y punto, y por `parent_id`;
  - `validateAccountInput(input, plan)` con el plan obligatorio: el plan del tenant al crear y `"edicion"` al editar.
- **`lib/studio/account-queries.ts`:** `planDeCuentas` lee el plan paginado y lanza si no llega completo.
- **`app/studio/(app)/contabilidad/actions.ts`:**
  - `createAccount` exige el padre y `deleteAccount` se niega si la cuenta tiene subcuentas, antes de mirar los movimientos;
  - `errorDelPlan` no deja pasar el texto de la base (ERR-01).
- **La propiedad, por las acciones reales:** `app/studio/(app)/contabilidad/__tests__/plan-de-cuentas-sin-huerfanas.test.ts`. Corre sobre el doble de PostgREST, con `insert` y `delete` que escriben en las mismas tablas.

## VALIDACIÓN

| Comprobación | Alcance | Resultado |
|---|---|---|
| `vitest run` de `app/studio/(app)/contabilidad`, `account-types`, `account-balances`, `contabilidad-qbo`, `rbac-actions-guard`, `rbac` y `lib/studio/accounting` | contabilidad, cuentas y las guardas de RBAC | PASÓ: `Test Files  22 passed (22)`, `Tests  742 passed (742)` (antes de agregar las dos pruebas de ERR-01) |
| `plan-de-cuentas-sin-huerfanas.test.ts`, `account-types.test.ts` y `contabilidad-qbo.test.ts` | la propiedad (con el doble que emula el `on delete cascade`) y las puras, sobre el código final | PASÓ: `Test Files  3 passed (3)`, `Tests  36 passed (36)` |
| Control rojo, 8 mutantes, restaurados por copia con la huella sha256 igual antes y después | M1 no exige el padre; M2 `createAccount` valida como edición; M3 `deleteAccount` no mira las subcuentas; M4 sin `parent_id`; M5 prefijo sin punto; M6 un ancestro cuenta como padre; M7 se acepta el plan cortado; M8 el error muestra el texto de la base | `MUERTOS 8/8 · restaurados 8/8` |
| `typecheck`, eslint `--max-warnings=0` (6 archivos), `check-rsc-boundary` | repo y archivos tocados | PASÓ |
| `docs:check` (550 specs), `sdd:check`, `governance:check` | documentación | PASÓ |
| `pnpm verify` sobre `4297bfbf` (turno del Director, 2026-10-19 de 18:19:13Z a 18:50:29Z) | completo | `VERIFY_EXIT=0`: «CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied. No hubo fallos en lo medido (16/17)». Detalle abajo |

Detalle del `verify`, copiado de su salida:
- **PASÓ:** harness, lint, rsc-boundary, typecheck, edge-functions, test, docs:check, numbering, feature-constants, components:check, governance:check, pending-migration-symbols («0 ROJO · 1 AMARILLO declarado(s)»: `client_outstanding`, la 0492, ya aplicada; la sella el Director en la #289), sql-tests («243 contrato(s) de SQL verificado(s) · rollback total»), schema-rebuild («radiografía de integridad verificada sobre el esquema completo (63 filas, conteos)»), e2e y build.
- **test:** la primera vuelta dio `Tests  1 failed | 11969 passed | 1 skipped (11971)`. El rojo fue `scripts/__tests__/radiografia-integridad.test.ts` › «guarda de Git…», que llegó al tope de 20 s. Esta rama sale de un `main` sin el tope lento que trae la #288 (SDD-0563); se arregla cuando esa entre. El reintento dio `Tests  11970 passed | 1 skipped (11971)`.
- **e2e:** `1 flaky`, `177 passed (5.0m)`.
- **NO DISPONIBLE:** migrations-applied (el worktree no tiene `.env.local`). Esta SDD no lleva migración.
- **`ea831aec`** mezcla `origin/main` (`b34c8d57`, la #285). Contra `4297bfbf` solo cambian 6 archivos de documentación: el organigrama, la spec 0564 y el índice. `docs:check` (551 specs) y `sdd:check` dieron OK. Por el criterio del Director, docs sin código no piden otro verify.

## Impacto documental y conocimiento

La spec 0565 y el índice. No hay cambios de esquema, RBAC ni pantallas. Graphify y Archify los publica el Director desde `main`.

## PENDIENTES DE ESTA TAREA

1. Integración por el Director. No lleva migración.
2. **Hecho:** la #288 entró a `main` (`76021662`). `72a266a6` trae `main` y la corrección del texto va en el commit siguiente: la prueba de paridad, la spec y el handoff de la 0563 ya no dicen que «por la pantalla» se puede eliminar la 1.1.2. Es solo texto; con `main` también llegó el tope lento de la guarda de Git que hizo falta en el `verify`.

## FUERA DE ALCANCE DETECTADO (para el Director)

1. **El candado en la base, con destino en la 2.4 (candado del mayor), por decisión del Director del 2026-10-19.** `accounts` tiene grant de insert, update y delete para `authenticated` (`0078_contabilidad.sql:137`), con RLS por tenant, y `parent_id` es `on delete cascade` (`0078_contabilidad.sql:28`). La garantía de `lib/` cubre la acción y no la API directa: una sesión puede crear una huérfana, cambiar un código o borrar por la API. **Hoy ninguna pantalla llama a `deleteAccount`** (`git grep deleteAccount` encuentra solo su definición), así que en la práctica una cuenta solo se borra con un `delete` directo. La 0493 no se tomó. La 2.4 lleva las policies por rol, sin UPDATE ni DELETE para `authenticated`, y se cruza con la SDD del cierre con superclave.
4. **Dos rojos de `AsistenteBorrado.test.tsx` (embarques) en la primera vuelta del `verify` de la #288** (`8790c441`), los dos en «recálculo: dos personas a la vez». Fueron **rojos rápidos, no topes de tiempo**: 873ms y 1841ms, contra el tope de 20 s.
   - `:182`, «si el paso sigue siendo el siguiente…»: la alerta ya había aparecido (pasó el `waitFor`), y el `getByRole("button", { name: "Anular factura" })` síncrono que sigue no encontró el botón. Huele a una carrera de render entre la alerta y el botón.
   - `:194`, «si la acción no responde…»: el `waitFor` no encontró `role="alert"` en su 1 s por defecto.
   - Pasaron en el reintento. Ninguno es de contabilidad.
2. **El selector de cuenta padre del cajón** (`AccountDrawer.tsx`) deja elegir un `parent_id` que no coincide con el código. Esta SDD lo cubre al borrar, porque `subcuentasDe` mira las dos cosas, pero no impide crear esa inconsistencia.
3. **Prevenir antes de informar (ERR-01):** el cajón podría ofrecer crear la cuenta padre que falta. Hoy informa el error en el campo.
