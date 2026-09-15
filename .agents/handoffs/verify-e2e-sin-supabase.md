# Handoff — verify-e2e-sin-supabase (SDD-0470)

- Fecha: 2026-09-15
- Owner: worker-verify-e2e-sin-supabase-20260915 (Claude Code, Worker)
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/verify-e2e-sin-supabase
- Rama: codex/verify-e2e-sin-supabase
- Base: origin/main c70956bf8b58b70e7e49676f29264d11796d7f81 + reserva c66b0381 (cherry-pick 99851f79)
- SDD: docs/specs/0470-verify-e2e-sin-supabase/spec.md
- Estado de tarea: ⟪PENDIENTE⟫
- Permisos: commits locales selectivos; push de la rama propia y PR draft contra
  main. Sin merge, deploy, lectura de producción ni borrado de ramas/worktrees.

## OBJETIVO ORIGINAL

En un worktree sin variables de Supabase, el paso e2e de `pnpm verify` deja de
fallar y colgarse por el entorno:
- los specs que necesitan Supabase se omiten con motivo visible y el resto corre;
- el veredicto marca esa omisión como crítica, no como cierre completo.

Además, diagnosticar el cuelgue recurrente en `[mobile-safari]
gastos-expense-void.spec.ts:99:7`.

## COMPLETADO

- **Detección única** en `e2e/_helpers/supabase-publico.cjs`, con tipos en
  `.d.cts`:
  - lee el entorno y los `.env*` que carga `next dev`, con la precedencia de
    `@next/env`;
  - un `.env.local` que no es archivo cuenta como ausente;
  - sólo aplica a destinos locales y nunca expone valores.
  - Es CJS porque Playwright 1.60 rompe al importar un `.mjs` desde un spec
    («exports is not defined in ES module scope», medido).
- **`requiereSupabase()`** (`e2e/_helpers/supabase.ts`) va en la primera línea
  de las 5 pruebas que fallaban en los 3 proyectos en la corrida base: 4 de
  `auth.spec.ts` y 1 de `global-search.spec.ts`. Sin las variables, quedan
  omitidas con el motivo `SIN SUPABASE PÚBLICO: …`.
- **`verify`:**
  - el preflight avisa qué falta;
  - `e2eCoberturaParcial` cuenta las omisiones marcadas en el reporte JSON e
    imprime `COBERTURA PARCIAL` con la lista de casos;
  - el resumen agrega `(con cobertura parcial: e2e)`.
- **`buildVerifyVerdict`** acepta `partial`: un crítico parcial queda como
  `CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL`, con el exit de una
  omisión crítica. Sin parciales, los mensajes no cambian.
- **Pruebas del harness** (`scripts/tests/verify-e2e-sin-supabase.node.mjs`,
  9 casos) e inventario explícito de specs.
- **Cuelgue de mobile-safari diagnosticado:** detalle en la spec, sección
  «Diagnóstico». ⟪PENDIENTE: cierre con E1/E2⟫
- `e2e/README.md` (sección «Sin Supabase público»), spec 0470 completa e índice
  regenerado.

Criterios de aceptación: ⟪PENDIENTE⟫

## VALIDACIÓN

⟪PENDIENTE⟫

## COMMITS

⟪PENDIENTE⟫

## PR / BRANCH

⟪PENDIENTE⟫

## PENDIENTES DE ESTA TAREA

⟪PENDIENTE⟫

## FUERA DE ALCANCE DETECTADO

- **Código de SDD-0320 fuera de main.** La spec figura `done` en el índice,
  pero su código (`8725a341`: servidor deny-only y cambios en
  `playwright.config.ts`) nunca se integró; sólo llegó la spec, con el bloque A
  de PR #21.
- **Los 5 casos no necesitan un Supabase real.** Con URL y anon key sintéticas
  (puerto cerrado) pasaron 8/8 en chromium. Un fallback sin secretos
  recuperaría 15 ejecuciones. Queda como propuesta de otra spec.
- **Cierre de WebKit en Windows:**
  - el worker no cierra al terminar (`did not exit within 300000ms`, visto en
    la corrida base);
  - queda un `WebKitNetworkProcess.exe` huérfano (PID 12540, creado a las
    13:22:27) que sigue listado incluso tras `Stop-Process -Force`.

  No depende de Supabase.
- **Flaky ajeno:** `calculadora-semantic-colors.spec.ts:53` («Selector
  combinado… en dark»), flaky en chromium y mobile-safari: el combobox trae
  «Valencia (sede)» y el texto tecleado se le concatena.
- **`WebServer` «Request timed out after 3000ms / Retrying 1/3»** en cada
  arranque de `next dev`, antes de los tests; ningún código del repo lo emite.
- **Scratchpad compartido** entre este Worker y el de SDD-0469: su cuerpo de PR
  sobrescribió `pr-body.md`.
- **SDD-0329** (`.next-verify-e2e`) no aparece en `scripts/verify.mjs` de main;
  no se verificó más.

## HANDOFF AL DIRECTOR

⟪PENDIENTE⟫

## Bitácora

- 2026-09-15: guard OK, claim adquirido, reserva incorporada (99851f79).
- 13:11–13:27: corrida base del paso e2e sin variables sobre c70956bf.
  FALLÓ en 2 intentos y 16,6 min: 15 fallos (5 casos × 3 proyectos) en cada
  pasada, worker forzado a los 300 s y un WebKitNetworkProcess huérfano.
- Commit 9177742c: detección, requiereSupabase, cobertura parcial, veredicto y
  pruebas.
- 13:35–13:40: demostración del paso e2e con el cambio. `outcome ok` en 1
  intento y 3,9 min; 152 passed, 33 skipped (15 con la marca), 0 failed y
  1 flaky ajeno; veredicto CIERRE INCOMPLETO con exit 0.
- Mutantes: el control pasó 9/9 y los 10 mutantes murieron.
- 13:40: E1, reproducción aislada en mobile-safari con los specs de la base.
- 13:43: contención con el Worker de SDD-0469. Su `node scripts/verify.mjs`
  (PID 33636, worktree `borrado-cliente-auditado`) arrancó a las 13:43:19 y
  corrió Vitest desde las 13:46:39, en paralelo con E1. Las fotos del monitor
  de 13:35 a 13:45 no muestran otros procesos de e2e: la demostración corrió
  sin contención.
- 13:50:58: el `verify` ajeno entró en su e2e (Playwright PID 32580 y
  `next dev` propio). Se superpuso con el último minuto de E1 y con todo E2.
- 13:52: E1 terminó sin el cambio: 40 failed, 24 passed y 16 skipped en
  11,1 min. Fueron 80 ejecuciones de WebKit sobre páginas del proxy caído, sin
  cuelgue: silencio máximo 12 s, sin corte ni «did not exit».
- 13:54: E2 con el cambio: 24 passed y 56 skipped en 1,4 min, silencio máximo
  11,2 s y 0 errores de Supabase en el WebServer. Se borraron las copias
  temporales `e2e/zz-base-*.spec.ts`.
- 13:55: `harness:test` PASÓ, 107/107 en 15 archivos.
