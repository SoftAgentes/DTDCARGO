# Handoff — verify-e2e-sin-supabase (SDD-0470)

- Fecha: 2026-09-15
- Owner: worker-verify-e2e-sin-supabase-20260915 (Claude Code, Worker)
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/verify-e2e-sin-supabase
- Rama: codex/verify-e2e-sin-supabase
- Base: origin/main c70956bf8b58b70e7e49676f29264d11796d7f81 + reserva c66b0381 (cherry-pick 99851f79)
- SDD: docs/specs/0470-verify-e2e-sin-supabase/spec.md, estado `done` (los 6 criterios cumplidos; merge y release van aparte)
- Estado de tarea: lista-para-revision
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

- **Detección única** en `e2e/_helpers/supabase-publico.cjs` (tipos en
  `.d.cts`):
  - Lee el entorno y los `.env*` que carga `next dev` (`.env.development.local`,
    `.env.local`, `.env.development`, `.env`), con la precedencia de
    `@next/env` 16.2.11.
  - Un `.env.local` que no es archivo cuenta como ausente. Sólo aplica a destinos
    locales y nunca expone valores.
  - Es CJS porque Playwright 1.60 no puede importar un `.mjs` desde un spec
    («exports is not defined in ES module scope», medido).
- **`requiereSupabase()`** (`e2e/_helpers/supabase.ts`) va en la primera línea
  de las 5 pruebas que fallaban en los 3 proyectos en la corrida base:
  - `auth.spec.ts`: Studio, Back y las dos del Portal;
  - `global-search.spec.ts`: el rebote sin sesión.

  Sin las variables quedan omitidas con motivo `SIN SUPABASE PÚBLICO: …`. Las
  demás pruebas no se tocaron.
- **`verify`:**
  - el preflight avisa lo que falta;
  - `e2eCoberturaParcial` cuenta las omisiones marcadas en el reporte JSON e
    imprime `COBERTURA PARCIAL` con la lista de casos;
  - el resumen dice `(con cobertura parcial: e2e)` y agrega una línea
    `parcial:`.
- **`buildVerifyVerdict`** acepta `partial`. Un crítico parcial queda como
  `CIERRE INCOMPLETO — CRÍTICOS CON COBERTURA PARCIAL`, con el exit de una
  omisión crítica. Sin parciales, los mensajes no cambian.
- **Pruebas del harness:** `scripts/tests/verify-e2e-sin-supabase.node.mjs`
  (9 casos) con inventario explícito de specs y control rojo de 10 mutantes.
- **Diagnóstico del cuelgue**, en la sección «Diagnóstico» de la spec:
  - de 7 cortes locales del watchdog, 6 empiezan justo en una navegación de
    mobile-safari a una ruta del proxy sin Supabase (p≈1e-4);
  - `gastos-expense-void.spec.ts` sólo era la última línea impresa y no se
    tocó;
  - no se reprodujo en aislamiento (E1: 0 de 80 ejecuciones);
  - el cambio quita el disparador (E2, demostración y verify completo);
  - el riesgo residual y la propuesta de política quedan documentados, sin
    implementar.
- **Documentación:** `e2e/README.md` (sección «Sin Supabase público»), spec
  0470 completa e índice regenerado.

Criterios de aceptación:

| # | Estado | Evidencia |
|---|---|---|
| 1 | cumplido | Sin variables, las 5 pruebas quedan `skipped` con la marca en los 3 proyectos (15 en total) y el resto corre: 152 passed. La selección es explícita, con evidencia de la corrida base. |
| 2 | cumplido | `[AVISO] e2e: COBERTURA PARCIAL — 15 prueba(s) omitidas…` y el veredicto `CIERRE INCOMPLETO — … CRÍTICOS CON COBERTURA PARCIAL: e2e […]`, con exit 0 como omisión crítica. |
| 3 | cumplido | Prueba del harness con variables presentes. Con URL y clave sintéticas, 0 omitidas y 8/8 casos corren. |
| 4 | cumplido | En la demostración y en el verify completo: e2e con 1 intento, 0 failed, sin reintento del gate ni watchdog. En la base: 2 intentos, 16,6 min y worker forzado. |
| 5 | cumplido | Diagnóstico con recibos, E1 y E2. La causa está en el producto sin configuración más WebKit en Windows; propuesta de política sin implementar. |
| 6 | cumplido | 9 casos: presentes, ausentes, `.env.local` directorio, precedencia, remoto, reporte, veredicto, cableado e inventario. Control rojo: 10/10 mutantes muertos. |

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
|---|---|---|
| `harness-worktree guard` / `claim` | worktree propio | PASÓ: guard OK antes de cada commit; claim adquirido |
| Corrida base del paso e2e, sin variables | `c70956bf` | FALLÓ (esperado): 2 intentos, 16,6 min; 15 fallos por pasada; `worker-45 … force-killed` |
| Demostración del paso e2e con el cambio, sin variables | `9177742c` | PASÓ con cobertura parcial: 1 intento, 3,9 min; 152 passed, 33 skipped (15 con la marca), 0 failed, 1 flaky ajeno; veredicto CIERRE INCOMPLETO, exit 0 |
| Focal chromium sin variables | `9177742c` | PASÓ: 3 passed, 7 skipped (5 con la marca) |
| Focal chromium con URL y anon key sintéticas | `9177742c` | PASÓ: 8 passed, 2 skipped (sólo Tier 3), 0 con la marca, 0 errores de `proxy.ts`. Límite: no es un Supabase real |
| E1: mobile-safari aislado con los specs de la base, `--repeat-each=8` | copias temporales de `c70956bf` | 40 failed (esperado), 24 passed, 16 skipped en 11,1 min; 0 cuelgues en 80 ejecuciones; silencio máximo 12 s |
| E2: la misma selección con el cambio | `9177742c` | PASÓ: 24 passed, 56 skipped en 1,4 min; silencio máximo 11,2 s; 0 errores de Supabase |
| Mutantes (control rojo), reporter TAP | `9177742c` | PASÓ: control 9/9, 10/10 mutantes muertos |
| `node --test` de la prueba nueva + `verify-critical-coverage` | `9177742c` | PASÓ, 16/16 |
| `corepack pnpm harness:test` | `9177742c` + docs | PASÓ, 107/107 en 15 archivos |
| `tsc --noEmit` | `9177742c` | PASÓ |
| ESLint de los scripts tocados | `9177742c` | PASÓ; `e2e/**` está excluido por la configuración |
| `docs:index` / `docs:check` / `sdd:check` | final | PASÓ; índice regenerado tras pasar la spec a `done` |
| `git diff --check` | cada commit | PASÓ |
| `scripts/__tests__/verify-e2e.test.mjs` | — | NO EJECUTADO por separado: no se modificó; corre dentro del paso `test` de verify |
| **`corepack pnpm verify`** | `5e935504`, de 13:56:14 a 14:09:58; HEAD igual y árbol limpio al inicio y al final; sin variables | **exit 0, CIERRE INCOMPLETO**: 16 de 17 pasos corrieron (con cobertura parcial: e2e) |
| verify — harness, lint, rsc-boundary, typecheck, edge-functions | `5e935504` | PASÓ (rsc-boundary: 1602 módulos) |
| verify — test | `5e935504` | PASÓ, 562 archivos y 7279 pruebas |
| verify — docs:check, numbering, feature-constants, components:check, governance:check | `5e935504` | PASÓ (457 specs) |
| verify — migrations-applied | `5e935504` | NO DISPONIBLE: `[SKIP]` sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`; no se midió el ledger |
| verify — pending-migration-symbols | `5e935504` | PASÓ, 0 ROJO · 0 AMARILLO |
| verify — sql-tests | `5e935504` | PASÓ, 195 contratos con rollback total |
| verify — schema-rebuild | `5e935504` | PASÓ: 433 desde cero, 18 sólo-ledger; aislamiento en 219 tablas con 2 tenants |
| verify — e2e | `5e935504` | PASÓ con cobertura parcial: `[OK] e2e`, 152 passed, 33 skipped, 1 flaky ajeno (`calculadora-semantic-colors:53` light, aprobado en su reintento), 3,2 min; sin reintento ni watchdog; aviso con los 5 casos × 3 proyectos |
| verify — build | `5e935504` | PASÓ: 160/160 páginas, `[build] build de producción OK` |
| CI «Calidad local sin secretos» | head publicado | NO DISPONIBLE al escribir: corre al publicar; ver los checks de la PR |
| Producción / Supabase | — | NO EJECUTADO por límite del encargo: no se leyó ni se escribió |

Veredicto literal de verify: `verify: CIERRE INCOMPLETO — CRÍTICOS SIN MEDIR:
migrations-applied. CRÍTICOS CON COBERTURA PARCIAL: e2e [15 prueba(s) omitidas
sin Supabase público (falta NEXT_PUBLIC_SUPABASE_URL,
NEXT_PUBLIC_SUPABASE_ANON_KEY)]. No hubo fallos en lo medido (16/17, con
cobertura parcial: e2e); exit 0 NO equivale a cierre verde completo.`

Entre `5e935504` y el head publicado sólo cambian la spec (estado y evidencia),
el índice regenerado y este handoff: nada que verify ejecute como código.

## COMMITS

- `99851f79` — cherry-pick de la reserva `c66b0381` (stub de la spec 0470).
- `9177742c` — detección única, `requiereSupabase()`, cobertura parcial en
  verify, `partial` en el veredicto, pruebas del harness y README del e2e.
- `5e935504` — spec 0470 con el diagnóstico, índice regenerado, README citado
  por títulos y handoff intermedio.
- Commit que contiene este documento: cierre de la spec (`done`), resultado de
  verify, índice regenerado y handoff final. Su hash va en la PR.

## PR / BRANCH

- Rama: `codex/verify-e2e-sin-supabase`, publicada con
  `git push -u origin codex/verify-e2e-sin-supabase`.
- PR draft contra `main`. La URL va en la propia PR y en el mensaje final al
  Director: ponerla aquí exigiría otro commit después de publicar, y la rama
  queda congelada.
- Base: `origin/main` `c70956bf`, sin cambios durante la tarea (comprobado con
  `git ls-remote` a las 13:47).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/verify-e2e-sin-supabase`.

## PENDIENTES DE ESTA TAREA

- Ninguno para la aceptación de SDD-0470.
- Queda por ver la corrida de la CI «Calidad local sin secretos» sobre el head
  publicado (ubuntu, `harness:test` incluido). Si falla, la corrección vuelve a
  esta tarea.

## FUERA DE ALCANCE DETECTADO

- **Código de SDD-0320 fuera de main.** La spec figura `done` en el índice,
  pero su código (`8725a341`: servidor deny-only y cambios en
  `playwright.config.ts`) nunca se integró; sólo llegó la spec, en el bloque A
  de PR #21.
- **Los 5 casos no necesitan un Supabase real.** Con URL y anon key sintéticas
  pasan 8/8 en chromium. Un fallback sin secretos, en otra spec, recuperaría 15
  ejecuciones.
- **Cierre de WebKit en Windows**, que no depende de Supabase:
  - el worker no cierra al terminar (`did not exit within 300000ms`, visto en
    la corrida base);
  - un `WebKitNetworkProcess.exe` quedó huérfano (PID 12540, creado a las
    13:22:27, padre muerto) y seguía listado tras `Stop-Process -Force`.
- **Flaky ajeno:** `calculadora-semantic-colors.spec.ts:53`, «Selector combinado…»
  en light o dark. Fue flaky en la base, en la demostración y en el verify: el
  combobox trae «Valencia (sede)» y lo tecleado se concatena.
- **`WebServer` «Request timed out after 3000ms / Retrying 1/3»** en cada
  arranque de `next dev`, antes de los tests; ningún código del repo lo emite.
- **Scratchpad compartido:** el Worker de SDD-0469 escribe en el mismo
  directorio de scratchpad de esta sesión; su cuerpo de PR sobrescribió
  `pr-body.md`. No se tocó; este Worker pasó a usar nombres con prefijo
  `0470-`.
- **Contención con el `verify` de SDD-0469** (worktree
  `borrado-cliente-auditado`, PID 33636, de 13:43:19 a ~14:05):
  - su Vitest coincidió con E1;
  - su e2e (13:50:58–~14:03:10) coincidió con el final de E1 y con E2;
  - no coincidió con el e2e del verify completo de esta tarea (14:05:07).
- **SDD-0329** (`.next-verify-e2e`): no aparece en el `scripts/verify.mjs` de
  main; no se verificó más.
- **Índice de specs:** muestra el hueco 0469, porque la reserva de SDD-0469
  todavía no está en esta rama. La PR que entre segunda regenera el índice.

## HANDOFF AL DIRECTOR

- **Revisión:** PR draft con 13 archivos, todos en la allowlist de la spec.
  `verify-runner.mjs`, `playwright.config.ts` y `gastos-expense-void.spec.ts`
  no cambian. Sin producto, CI ni migraciones.
- **Decisiones para el Director:**
  1. **`attachments-gastos-pilot-network`.** No se omite: pasa y lo que afirma
     no depende de Supabase, pero sigue abriendo `/studio/login` en
     mobile-safari. Riesgo residual declarado.
  2. **Fallback sin secretos** (SDD-0320 o equivalente) en otra spec.
     Recuperaría esas 15 ejecuciones en vez de omitirlas.
  3. **Política de WebKit en Windows:** propuesta en la spec, sin implementar.
- **Integración:**
  - El merge a `main` dispara el deploy de Vercel: `scripts/**` y `e2e/**` no
    están excluidos. El artefacto no cambia, pero la autorización tiene que
    cubrir ese deploy.
  - Si entra antes SDD-0469, esta rama regenera el índice, y al revés.
- **Sesiones consumidoras:** ninguna conocida de este worktree.
- **Ownership:** claim liberado al terminar
  (`release --owner worker-verify-e2e-sin-supabase-20260915`). No se borró
  rama ni worktree.

## Bitácora

- 2026-09-15: guard OK, claim adquirido, reserva incorporada (99851f79).
- 13:11–13:27: corrida base del paso e2e sin variables sobre c70956bf. FALLÓ en
  2 intentos y 16,6 min: 15 fallos por pasada, worker forzado a los 300 s y un
  WebKitNetworkProcess huérfano.
- Commit 9177742c.
- 13:35–13:40: demostración del paso e2e con el cambio. `outcome ok` en
  3,9 min, con veredicto CIERRE INCOMPLETO y exit 0.
- Mutantes: 10/10 muertos.
- 13:40–13:52: E1 sin cambio, 0 cuelgues en 80 ejecuciones.
- 13:52–13:54: E2 con cambio, 0 navegaciones al proxy.
- 13:55: harness:test 107/107; commit 5e935504.
- 13:56–14:10: verify completo, exit 0, CIERRE INCOMPLETO (16/17, e2e parcial,
  migrations-applied sin medir).
