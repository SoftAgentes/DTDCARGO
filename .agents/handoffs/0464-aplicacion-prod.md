# 0464 aplicada a producción — registro en el repositorio (SDD-0484)

- Fecha: 2026-09-18, 21:30 en Caracas (2026-09-19, 01:30 UTC). Estado de la tarea: **lista para
  revisión**. Es una PR chica de docs y baseline: no trae código ni migraciones.
- Owner / sesión escritora: `claude-1048f9` (Claude Opus 5, Worker, sesión «Registrar la 0464
  aplicada a producción»). Director: `dtdcargo-18`, que aplicó la 0464, leyó la evidencia y asignó
  esta tarea. La sesión Worker original de la SDD-0484 ya había cerrado.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/0464-aplicacion-prod`.
- Rama: `codex/0464-aplicacion-prod`, creada con `harness-worktree start` desde `origin/main` =
  `a90c242b`. `guard` → `Guard OK`, y el claim `claude-1048f9` se tomó antes de editar.
- SDD: [0484](../../docs/specs/0484-reporte-pago-factura-pagada/spec.md). Sigue `in-progress`.
  Migración: `0464_reporte_pago_factura_pagada`, aplicada.
- Alcance: `supabase/migrations-baseline.json`, la spec 0484, el handoff
  [0484](0484-reporte-pago-factura-pagada.md) y este documento. No se tocan la cabecera de la
  migración, las demás esperas, el `cutoff` ni el código.
- Permisos del encargo: commits en esta rama, en un solo commit. Reportar al Director antes de abrir
  la PR; él revisa e integra. **No merge.** Nada de producción, y en esta sesión no hubo conector de
  Supabase. No correr `verify` completo ni suites pesadas sin pedirle turno al Director.

## OBJETIVO ORIGINAL

Registrar en el repositorio que la 0464 (SDD-0484) ya está aplicada en producción, en un solo commit
`chore(db): SDD-0484 — 0464 aplicada a producción`:

1. sacar `0464_reporte_pago_factura_pagada` de `pendingBelowCutoff`;
2. registrar la aplicación, con la evidencia del Director, en la spec y en el handoff de la 0484;
3. dejar la spec en `in-progress`, con el último criterio pendiente de la verificación de Sam en
   producción (bloque 3.2 de la prueba de reportes de pago: el motivo de la cancelación sigue visible
   al recargar). Dejar escrito que el rechazo sobre una factura pagada no se prueba en producción,
   porque la factura de prueba se anula, y que eso lo cubren los contratos;
4. no tocar la cabecera de `supabase/migrations/0464_reporte_pago_factura_pagada.sql`.

## Evidencia de la aplicación

Salvo lo marcado como «comprobado aquí», la leyó el Director, sólo del ledger y del catálogo:

- OK nominal de Sam por AskUserQuestion del 2026-09-19 a las 00:29Z
  («0464_reporte_pago_factura_pagada»), confirmado también en la sesión Worker con «Autorizo aplicar
  la 0464_reporte_pago_factura_pagada».
- Aplicada por el Director a las 01:00:07Z, después del despliegue de la PR #150.
- Ledger `20260919010007 0464_reporte_pago_factura_pagada`, 1 sentencia. `statements` tiene md5
  `44fabe4d2643844fbe489e2ba88fa4fb` y 22209 bytes.
- Preflight: `md5(prosrc)` de `payment_private.run_report_command`, releído justo antes,
  `7814b3911f1e273a52bf870d8db08155` (el cuerpo de 0421). 0 sesiones activas.
- Postflight: `md5(prosrc)` `c3aab7fcb10e3bf5de0fa40cc562a45d`; DEFINER, owner `postgres`,
  `search_path=""`; EXECUTE sólo para `authenticated`. El comentario de `resolution_reason` quedó
  actualizado y el postflight interno de la migración pasó.
- Advisors de seguridad: la misma huella antes y después (md5 normalizado
  `c80be09588e4dd2dd588379f246765f5`).
- **Comprobado aquí, en Git:** el blob de la 0464 en `main` es
  `0b2d0065460ad345b9ee8c4db12cbf6fc00955b5`, con md5 `44fabe4d…`, 22209 bytes y 0 retornos de carro.
  La copia del worktree da el mismo md5.
- **Comprobado aquí, en GitHub:** la PR #150 está MERGED desde las 00:51:43Z, con merge `26983062` y
  head `1cc16e9c`. El estado `Vercel` de `26983062` es `success` («Deployment has completed») desde
  las 00:54:23Z.
- **No comprobado aquí:** nada de producción. Sin conector de Supabase no se repitió la lectura del
  ledger, del catálogo ni de los advisors.

## COMPLETADO

- **Baseline:** sale `0464_reporte_pago_factura_pagada`. Quedan `0422_payment_report_command_boundary`
  y `0423_payment_report_historical_identity`, con el mismo texto que en `main`, y `$doc` y
  `cutoff` (238) no cambian. Antes de editar se verificó que `JSON.stringify(…, null, 2)` reproduce el
  archivo byte a byte; el cambio se hizo así y se comparó clave por clave contra `origin/main`.
- `supabase/pending-migration-symbol-declarations.json`: sin cambios, porque no tenía declaraciones de
  la 0464.
- **Spec 0484**, que sigue en `in-progress`:
  - `updated: 2026-09-19` y una línea en el resumen;
  - una nota en «Orden de release» con el orden que se siguió;
  - el último criterio, sin marcar, con la nota de la verificación de Sam;
  - la sección nueva «Aplicación en producción (2026-09-19)», con la evidencia y la subsección
    «Verificación en producción, pendiente de Sam». Allí está el bloque 3.2 y la nota de que el
    rechazo sobre una factura pagada no se prueba en producción y lo cubren los contratos;
  - «No ocurrió» en el riesgo de aplicar antes del despliegue.
  El índice `docs/specs/README.md` no cambia, porque el estado es el mismo.
- **Handoff 0484:** estado (integrada; 0464 aplicada), la línea de la migración, la espera, commits,
  PR, la sección «APLICACIÓN DE LA 0464», pendientes y la actualización al Director.
- La cabecera de `0464_reporte_pago_factura_pagada.sql` no se tocó. El diff no incluye ese archivo.

## VALIDACIÓN

Árbol de trabajo de esta rama sobre `a90c242b`, antes del commit. Sólo corridas focales, con
`--pool=threads`, por la máquina compartida.

| Comprobación | Resultado |
| --- | --- |
| `git diff --check` y, con el stage armado, `git diff --cached --check` | **PASÓ** |
| `corepack pnpm docs:check` | **PASÓ**: índice sincronizado con 470 specs |
| `node scripts/build-docs-index.mjs` | **PASÓ**: 470 specs, 14 huecos; `docs/specs/README.md` sin cambios |
| `corepack pnpm sdd:check` | **PASÓ**: sin números repetidos; sólo los choques históricos exentos |
| `node scripts/check-pending-migration-symbols.mjs` | **PASÓ**: 0 ROJO · 0 AMARILLO |
| `vitest run scripts/check-migrations-applied.test.mjs scripts/check-pending-migration-symbols.test.mjs scripts/__tests__/spec-migration-refs.test.ts scripts/__tests__/ci-workflow-contract.test.mjs --pool=threads` | **PASÓ**: 4 archivos, 69/69 |
| `node --test scripts/tests/merge-generated-records.node.mjs scripts/tests/pending-migration-symbols-do-blocks.node.mjs scripts/tests/pending-migration-symbols-utf16.node.mjs` (driver de merge del baseline y gate de símbolos) | **PASÓ**: 35/35 |
| `corepack pnpm governance:check` | **PASÓ**: 28 políticas aprobadas, cápsula vigente |
| Baseline: JSON válido, y 0422, 0423, `$doc` y `cutoff` iguales a `origin/main` | **PASÓ** |
| `node scripts/check-migrations-applied.mjs` | **NO DISPONIBLE**: SKIP (exit 3), sin `NEXT_PUBLIC_SUPABASE_URL` ni `SUPABASE_SERVICE_ROLE_KEY` en el worktree. Es el gate que cruza el ledger real |
| `pnpm verify` completo | **NO EJECUTADO**: el cambio es de docs y baseline, y las corridas pesadas necesitan turno del Director. Las comprobaciones que tocan estos archivos corrieron sueltas, arriba |
| Lectura de producción | **NO DISPONIBLE**: sin conector de Supabase en esta sesión |

Dependencias instaladas en el worktree con `corepack pnpm install --frozen-lockfile --prefer-offline`.

## COMMITS

Sobre `a90c242b`:

- El commit que contiene este documento: `chore(db): SDD-0484 — 0464 aplicada a producción`. Trae el
  baseline, la spec, el handoff 0484 y este handoff.

## PR / BRANCH

- Rama `codex/0464-aplicacion-prod`, base `main`, worktree de arriba.
- La PR se abre contra `main` después de reportarle al Director. Su número y el resultado del CI van
  en la propia PR y por mensaje, no en otro commit.

## PENDIENTES DE ESTA TAREA

- Reportarle a `dtdcargo-18` y, después, publicar la rama y abrir la PR.
- Informar el CI de la PR por mensaje. Si `main` avanza antes de integrar, traerlo con el driver de
  merge y repetir las comprobaciones de arriba.

De la SDD-0484, fuera de esta tarea: la verificación de Sam en producción (bloque 3.2). Con su OK,
una PR de docs marca el último criterio y pasa la SDD a `done`.

## FUERA DE ALCANCE DETECTADO

1. **La guía de la prueba de Sam quedó desactualizada en el paso que ahora hay que verificar.**
   `.agents/handoffs/smokes-app-l14-0454-0472-guion.md`, bloque 3, paso 2, dice que el
   «Motivo: …» desaparece al recargar y que es un hallazgo conocido, no una falla. Con la 0464
   aplicada, desaparecer sí sería una falla. Quien le pida el bloque 3.2 a Sam tiene que avisarle la
   nueva expectativa. No se editó: es un handoff fechado y no estaba en el alcance.
2. **Comentario condicional vencido en código.** `lib/portal/payment-report-commands.ts:39` dice:
   «Los dos de 0464 (SDD-0484) no llegan hasta aplicar esa migración: el mapa va antes.» Con la 0464
   aplicada, ya no describe el estado. Es código, y el encargo lo excluye.

## HANDOFF AL DIRECTOR

- Siguiente acción: revisar el diff (el baseline, la spec 0484, el handoff 0484 y este documento) e
  integrar cuando corresponda.
- **El merge dispara un build de Vercel.** El `ignoreCommand` excluye `docs/**` y los `.md` de la
  raíz, pero no `supabase/migrations-baseline.json` ni `.agents/handoffs/*.md`. No hay cambio de app.
- **Cambio compartido:** `supabase/migrations-baseline.json`, que usa el driver `dtd-generated-records`.
  `codex/carrera-cobro-factura` (SDD-0488, 12 commits sobre `a90c242b`) también lo toca: agrega la
  espera `0467_cobro_factura_atomico` en las líneas vecinas. La que entre segunda va a salir
  CONFLICTING en GitHub, que no tiene el driver, y hay que traer `main` con el driver.
- SDD-0484: pedirle a Sam el bloque 3.2, avisándole que ahora el motivo tiene que seguir visible al
  recargar y que sirve un reporte cancelado después de la 0464. El rechazo sobre una factura pagada y
  el del excedente no se prueban en producción; los cubren los contratos.
- Sesiones consumidoras: ninguna fuera de esta.
- Ownership: el claim `claude-1048f9` se libera cuando termina la escritura, después del push y de
  la PR. Si hay que corregir algo por CI o revisión, se vuelve a reclamar.

## Impacto documental y conocimiento

- **Canónicos actualizados:** la spec 0484 y el handoff 0484. En datos: la espera sale de
  `supabase/migrations-baseline.json`. El índice de specs no cambia.
- **No aplica:** `BRAND.md`, `docs/design/**`, `docs/marketing/**` y `docs/governance/**`, porque no
  hay UI, textos públicos ni política nueva. No corre `/ui-check`.
- **`knowledge:status`** (revisión `a90c242b`, rama `codex/0464-aplicacion-prod`, Graphify 0.9.61):
  - estructural INVALID, porque el worktree es nuevo y no tiene `graphify-out` (4241 pendientes y
    3130 faltantes);
  - semántica global 0/1111 y piloto 0/16. Ninguna de las 16 fuentes de `semanticPilot` está en el
    diff, así que esta tarea no debe recibo;
  - Archify PENDING (`ARCHIFY_RUNTIME_MISSING`) y Obsidian PENDING.
- **`graphify update .` no se ejecutó** ni se generó la preview de Obsidian: Graphify lo publica el
  Director desde `main` integrado, y hay una sola corrida pesada a la vez.
