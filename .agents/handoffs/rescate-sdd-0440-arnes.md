# Rescate SDD-0440 — arnés ya incorporado en main

- Fecha: 2026-09-10.
- Task ID: `rescate-sdd-0440-arnes`.
- Owner / sesión: `rescate-sdd-0440-arnes-20260910-worker`, sesión Worker actual.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr28-e2e-harness-validation-20260906`.
- Rama: `codex/pr28-e2e-harness-validation-20260906`.
- HEAD recibido: `02b5674fd11df9086732e8b001c1c6470a5a0439`.
- Base de comparación actualizada por fetch: `origin/main`, `13facbada82da3f09e295e90bbcccbfc10ed165c`.
- SDD existente: `docs/specs/0440-e2e-harness-general-determinista/spec.md`; no se asigna otro ID ni se declara done.
- Estado: lista-para-revision; rescate terminado por redundancia demostrada, sin PR nueva ni integración pendiente.
- Alcance autorizado: los seis archivos del fix asignados por Sam y los handoffs de esta tarea. Primero se preservó sin editar el handoff histórico pendiente.
- Dependencias: verificación de main actual y revisión de #49/#52; no requiere entorno Supabase.
- Permisos: commits, push explícito de la rama propia y PR draft si falta el fix. Sin merge, migraciones, ruleset ni eliminación de ramas/worktrees.

## OBJETIVO ORIGINAL

Preservar el trabajo sin respaldo y rescatar `b08116f8` en una PR sobre main actual, o demostrar que ya es redundante. La primera operación de escritura de archivos versionados debía ser guardar el handoff pendiente y publicar la rama antes de investigar o portar el fix.

## COMPLETADO

- Guard, raíz, rama, estado, procesos vinculados y disponibilidad del claim comprobados. Claim adquirido sin desplazar otro owner.
- El único archivo modificado recibido, `.agents/handoffs/pr28-e2e-harness-validation-20260906.md`, se guardó íntegro en `b8d2b26153984354a5ac09d5b4199b8c2e46ce87` y se publicó antes del fetch/comparación del fix.
- **Veredicto: el fix ya está en main.** `386254fd2b1576e43532da601152e28642662dad` materializó las correcciones bajo otro SHA y llegó mediante [PR #28](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/28), merge `ba16f02426926d17aec66f0620c97715620249ee` del 2026-09-09. Los cuatro archivos de implementación/pruebas y `e2e/README.md` de `b08116f8` son idénticos en ese commit (`git diff --exit-code`, exit 0). `386254fd` es ancestro de main (exit 0); que `b08116f8` no lo sea (exit 1) no significa que falte su contenido.
- Main conserva el guard de origen canónico, las regresiones de URL/aliases/entrypoint antes del cliente y el trim de kind. Agrega posteriormente concurrencia relativa a CPU, cobertura del límite WebKit y registro previo del seed.
- #49 (`1a1b51400aaf614deb0d6d33d9b412c4a55a5b63`) amplía diagnóstico de hidratación; #52 (`7921c120111acdc55b1d616e47c890c513afb57e`) clasifica omisiones en verify. Ninguna elimina las validaciones rescatadas.
- No se porta código ni se abre una PR redundante. Se conserva esta rama como respaldo histórico.

| Aceptación del encargo | Cierre |
|---|---|
| 1. Guardar el pendiente y publicar primero | PASÓ: `b8d2b261` publicado antes de investigar el fix. |
| 2. Veredicto explícito frente a main actual | PASÓ: ya está; incorporación literal bajo `386254fd` y regresiones actuales 63/63. |
| 3. PR draft y prueba roja si falta | NO APLICA: no falta; no se porta ni se crea una PR duplicada. |
| 4. Solo arnés, pruebas de scripts y límites de producto explícitos | PASÓ: seis archivos fuente intactos; 18/18 del harness actual y 63/63 focales. DB/E2E/producción quedan separados abajo. |

## VALIDACIÓN

### Main actual, sin modificar su checkout

Se exportó `13facbada82da3f09e295e90bbcccbfc10ed165c` mediante `git archive` a `C:/Users/AKX generator/Desktop/Developer/DTD-backups/rescate-sdd-0440-arnes-20260910/main-13facbad`. No contiene `.git` ni credenciales copiadas. Se verificó igualdad byte a byte de siete archivos relevantes con los blobs del SHA, incluidos config/tests, README, package y configuración Vitest.

| Comando | Resultado | Evidencia |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` | PASÓ, exit 0 | 813 paquetes; pnpm 12.3.4; lockfile sin cambios. |
| `corepack pnpm exec vitest run scripts/__tests__/playwright-config.test.ts scripts/__tests__/sdd-0168-fixture.test.ts` | PASÓ, exit 0 | 63/63 tests, dos archivos; `main-focal.log`. |
| `corepack pnpm harness:test` | PASÓ, exit 0 | 18/18; cero fallos y SKIPs; `main-harness.log`. Incluye contratos de #52. |
| `corepack pnpm docs:check` | PASÓ, exit 0 | Índice sincronizado con 407 specs; `main-docs.log`. |
| `corepack pnpm sdd:check` | PASÓ, exit 0 | 407 specs, 414 migraciones; avisos de colisiones históricas declaradas, sin nuevas colisiones; `main-sdd.log`. |
| `corepack pnpm verify` sobre el snapshot | NO EJECUTADO | El gate integral tiene pruebas dependientes de metadatos Git; correrlas sobre un archive produciría fallos artificiales. La ejecución solicitada se realiza en la rama histórica, separada abajo. |

La evidencia de main conserva estos contratos:

- `playwright.config.ts:36-38` y test `playwright-config.test.ts:121-125`: kind con espacios sigue resolviendo un worker.
- `scripts/e2e/sdd-0168-fixture.ts:216-228`: exige el origen HTTPS completo y la cadena canónica, con slash raíz opcional.
- `scripts/__tests__/sdd-0168-fixture.test.ts:24-38,135-180`: trece URL negativas; host/sufijo, userinfo, puertos, path, query/hash y HTTP; alias/admin y entrypoint real del seed abortan antes de `createClient` (mock sin red). Acepta ambos orígenes raíz válidos.
- Restaurar los archivos viejos completos revertiría mejoras posteriores de concurrencia CPU, WebKit y diagnóstico del seed. No se hace.

Logs y recibo externo: `C:/Users/AKX generator/Desktop/Developer/DTD-backups/rescate-sdd-0440-arnes-20260910/`. `redundancy-evidence.json` registra comandos, salidas y hashes. SHA-256 de `main-13facbad.tar`: `b412f2310f15673b7b4aa4cbb931d084e921515f20725da0d2d72f09b10beca8`.

### Rama histórica, código en b8d2b261

| Comando | Resultado | Evidencia |
|---|---|---|
| `corepack pnpm install --frozen-lockfile` inicial | FALLÓ | `ERR_PNPM_PACKAGE_MANAGER_REMOVE_MODULES_DIR`, acceso denegado. La instalación quedó incompleta. |
| `corepack pnpm@11.19.0 install --frozen-lockfile` | FALLÓ en comprobación posterior | El proceso salió 0 y declaró up to date, pero seguían ausentes los entrypoints de Vitest/TypeScript/ESLint. No se toma como instalación válida. |
| `corepack pnpm install --frozen-lockfile --no-optimistic-repeat-install` | PASÓ, exit 0 | Reinstaló 813 paquetes; comprobados los entrypoints; sin editar configuración ni lockfile. |
| `corepack pnpm harness:test` | PASÓ, exit 0 | 12/12; `branch-harness.log`. Esta rama histórica aún no incluye los seis contratos de #52. |
| `corepack pnpm docs:check` | PASÓ, exit 0 | `branch-docs.log`. |
| `corepack pnpm sdd:check` | PASÓ, exit 0 | `branch-sdd.log`; conserva las excepciones históricas. |
| `corepack pnpm@11.19.0 verify` antes de reparar dependencias | FALLÓ, exit 1 | 12/16 pasos intentados, cinco fallos por módulos ausentes (lint, typecheck, test, components y build); `branch-verify.log`. No valida el fix. |
| `corepack pnpm verify` después de reparar dependencias | PASÓ en lo ejecutado, exit 0; cobertura incompleta | 12/16 pasos medidos y sin fallos; 6.216 tests en 501 archivos y build incluidos; `branch-verify-repaired.log`. |

Desglose del verify final: **PASÓ** harness (12/12), lint (cero errores, ocho advertencias), rsc-boundary (1.586 módulos), typecheck, edge-functions (4/4), test (6.216/6.216), docs:check, numbering, feature-constants (5/5), components:check, governance:check y build. **NO EJECUTADO** migrations-applied, sql-tests, schema-rebuild y e2e. El runner restauró `tsconfig.json` al terminar; no quedó cambio de producto por la compilación.

Se fijaron `VERIFY_SKIP_SQL=1` y `VERIFY_SKIP_E2E=1`; el worktree no contiene `.env.local` y el preflight de `migrations-applied` confirmó ausencia de credenciales antes de consultar el ledger. `migrations-applied`, `sql-tests`, `schema-rebuild` y `e2e` quedan **NO EJECUTADO**: este rescate solo compara y prueba arnés, no cambia DB ni producto, y no autoriza migraciones ni runtime Supabase. No se copian secretos ni se consulta producción.

No aplica validación visual, accesibilidad de producto ni validación de skills modificadas: no se cambia UI ni ninguna skill. La corrida hospedada de 168 E2E y la cobertura de paralelismo del SDD siguen separadas. El verify histórico no incluye la política de #52, por lo que se informa manualmente **cobertura de producto incompleta** ante las omisiones; los 18 tests actuales sí validan esa política. El rescate documental no certifica producto ni release.

## COMMITS

- `b08116f80bc0400653906fa880334ae8086ba292`: fix histórico asignado.
- `b8d2b26153984354a5ac09d5b4199b8c2e46ce87`: preservación íntegra del handoff pendiente, publicada al inicio.
- Commit que contiene este documento: evidencia y cierre del rescate, sin cambios al código.

## PR / BRANCH

- Rama de respaldo: https://github.com/hailuwaycom-sketch/DTDCARGO/tree/codex/pr28-e2e-harness-validation-20260906
- No hay PR de rescate: el contrato permite cierre por redundancia demostrada.
- Main comparado: `13facbada82da3f09e295e90bbcccbfc10ed165c`; no se modifica ni se fusiona.

## PENDIENTES DE ESTA TAREA

- Ninguno para la vía de redundancia: respaldo inicial publicado, equivalencia demostrada y validaciones proporcionales terminadas. La publicación de este cierre y la liberación terminal del claim se verifican al finalizar la sesión.

## FUERA DE ALCANCE DETECTADO

- SDD-0440 mantiene pendiente la corrida hospedada de 168 E2E; este rescate no la ejecuta ni cierra el SDD general.
- La rama histórica tiene divergencias ajenas al fix frente a main. No es candidata para integración completa ni deben importarse sus versiones antiguas sobre mejoras posteriores.
- Las ocho advertencias de lint pertenecen al código preexistente de esta rama; no se corrigen ni se mezclan con el rescate.
- El primer install falló y un reintento optimista dio un falso up to date. La recuperación de dependencias ya terminó: no es un bloqueo pendiente. No se modifican las políticas globales de pnpm ni la versión fijada en CI.

## HANDOFF AL DIRECTOR

- Revisar este cierre por redundancia; no hay fix pendiente de portar ni PR nueva que fusionar. La reconsulta final de origin/main mantuvo `13facbad`.
- Conservar la rama y el worktree como respaldo del handoff histórico. No se autoriza su limpieza ni la integración de la rama completa.
- No hubo cambios en los seis archivos fuente autorizados, ni nuevas dependencias de producto, migraciones, rulesets o runtime Supabase.
- Solo esta sesión reclamó el worktree; las dos revisiones delegadas fueron de lectura y terminaron. No queda trabajo escritor delegado.
- Secuencia terminal: guard/claim, commit selectivo de este documento, push explícito de la rama a sí misma, comprobación de SHA remoto y estado limpio, y `release --owner rescate-sdd-0440-arnes-20260910-worker`. La respuesta final confirma el recibo de liberación; el claim no se conserva para otra tarea.
