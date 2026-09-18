# e2e-supabase-sintetico-deny-only — Supabase sintético deny-only para el e2e local (SDD-0479)

- Fecha: 2026-09-18.
- Owner / sesión escritora: `worker-0479-supabase-sintetico-20260918`, sesión Claude Code `dtdcargo-09`
  (Worker). Coordinación: Director `dtdcargo-18`, que reservó la 0479, y supervisor `dtdcargo-53`.
- Encargo de Sam, textual: «Migraciones 0414 y 0415, la retención de 30 días y las tres decisiones
  de la SDD-0470». Esta rama ejecuta la decisión 1-2 de SDD-0470.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/e2e-supabase-sintetico-deny-only`.
- Rama: `codex/e2e-supabase-sintetico-deny-only`, desde `origin/main` `78410913` más el stub
  publicado `aabe70e2` (`origin/codex/sdd-reserve-0479-e2e-supabase-sintetico-deny-only`).
- SDD: `docs/specs/0479-e2e-supabase-sintetico-deny-only/spec.md`, `in-progress`. Sin migración.
- Estado de tarea: lista-para-revision, sin publicar.
- Permisos: edición focal, instalación congelada, pruebas locales y commits selectivos. Publicar
  requiere la autorización de Sam; el merge, otra.

## OBJETIVO ORIGINAL

Las tres decisiones de SDD-0470, tomadas por Sam el 2026-09-18 (AskUserQuestion, textual):

- «Spec nueva; attachments igual» (decisiones 1 y 2): abrir la spec del Supabase sintético para el e2e
  local, y que `attachments-gastos-pilot-network` siga corriendo.
- «Medir y no cambiar» (decisión 3): WebKit en Windows sin cambios.

## COMPLETADO

- **Plan único `planSupabaseE2E`** (`e2e/_helpers/supabase-publico.cjs`), con cinco modos: remoto,
  configurado, parcial, ausente y sintético. Además, el puerto del deny-only, la anon key sintética
  visible y la detección efectiva.
- **Servidor deny-only** `scripts/e2e/supabase-deny-server.mjs`:
  - sólo en `127.0.0.1`;
  - salud en 200, OPTIONS en 204 y todo lo demás en 503;
  - sin eco, sin leer cabeceras y sin guardar nada.
- **`playwright.config.ts`:** `resolveSupabaseE2E`, `buildWebServers` (primero el deny-only, después
  `next dev` con el entorno sintético) y `metadata.supabaseE2E.modo`. Sin mutar `process.env`.
- **`requiereSupabase()`** no omite en modo sintético. Ningún `*.spec.ts` cambia.
- **`verify`:**
  - `planSupabaseDelPaso` en los dos caminos del preflight;
  - `destinoE2E`, réplica de `resolvePlaywrightRuntime`, con prueba de paridad;
  - puerto del deny-only comprobado, `candidatosSupabaseSintetico`;
  - aviso nuevo del preflight y cobertura con la detección efectiva.
- **SDD-0470:** nota fechada con las tres decisiones. `attachments-gastos-pilot-network` y WebKit no se
  tocan.
- `e2e/README.md` actualizado.

## VALIDACIÓN

- PASÓ · harness (`node --test --test-reporter=tap`): `e2e-supabase-sintetico.node.mjs` y
  `verify-e2e-sin-supabase.node.mjs`, 28/28, sobre `ef973bb4`.
- PASÓ · Vitest `scripts/__tests__/playwright-config.test.ts`, 34/34 (`--pool=threads`, por la carga).
- PASÓ · control rojo: 16/16 mutantes muertos, con los controles pasando antes y después. Detalle en la
  spec, «Evidencia».
- PASÓ · `tsc --noEmit` 0, ESLint de lo tocado 0, `docs:index` y `docs:check` (465 specs),
  `check-numbering` y `git diff --check`.
- **e2e focal sin variables:** ver «Evidencia e2e», abajo.
- **`corepack pnpm verify` completo:** ver «Evidencia e2e», abajo.

## Evidencia e2e

Todas las corridas fueron sin variables de Supabase ni `.env*` en el worktree, sin leer producción y
con Playwright 1.60.0.

- **Focal, sobre `efef3d93`:** `auth.spec.ts` y `global-search.spec.ts` en los tres proyectos, con
  puertos comprobados (app 3513 y deny-only 13513).
  - **Resultado:** 24 passed y 6 skipped (sólo los 2 Tier 3 por proyecto), 0 fallidos, 0 flaky, en
    47 s.
  - **Reporte:** `metadata.supabaseE2E.modo = "sintetico"`, 0 omisiones con la marca `SIN SUPABASE
    PÚBLICO` y 0 errores «Your project's URL and Key are required» de `proxy.ts` en el WebServer.
  - **Con SDD-0470 sola** (evidencia de su spec), el mismo par de specs en chromium daba 3 passed y 7
    skipped. Los 5 casos ahora corren y pasan.
- **`corepack pnpm verify` completo sobre `efef3d93`**, de 02:07:46 a 02:29:25 (−04:00), con el mismo
  HEAD al inicio y al final. Resultado: **exit 1**.
  - **Aviso del preflight:** «Sin Supabase público: el next dev del e2e corre contra un Supabase
    sintético deny-only en http://127.0.0.1:13269 (SDD-0479)».
  - **e2e `[OK]`, sin cobertura parcial:** 164 passed, 18 skipped (sólo Tier 3), 4 flaky y 0
    failed, en 4,9 min. En la corrida sin sintético de otra rama, a la misma hora: 153 passed y 33
    skipped.
  - **Los 4 flaky:**
    - `attachments-gastos-pilot:20` (chromium);
    - `auth.spec.ts:49` y `:81` (chromium, «Acceso»);
    - `cbm-ayuda:111` (mobile-chrome).
  - **No dependen del sintético:**
    - el gate de adjuntos lee sólo variables de entorno
      (`lib/studio/attachments/pilot-gate.ts:34-40`);
    - `/acceso` usa el cliente admin, que sigue sin service role.
  - **Repetidos en modo sintético** (`--repeat-each=3 --retries=0`): 12/12, 0 flaky. Fueron de carga.
  - **FALLÓ, `test`:** 7801/7803. `app/p/[token]/PackingListProductsStep.test.tsx` expiró a los 20 s
    en el intento y en el reintento; es ajena a esta rama y ya se sabía inestable en `main`. En la
    otra rama, aislada, pasó 9/9, y esa prueba sola tarda unos 21 s.
  - **PASÓ:**
    - harness, lint, rsc-boundary, typecheck y edge-functions;
    - docs:check, numbering, feature-constants, components:check y governance:check;
    - pending-migration-symbols, sql-tests, schema-rebuild y build.
  - **NO DISPONIBLE:** `migrations-applied`, SKIP sin credenciales.
  - **Veredicto literal:** `verify: 1 fallo(s) → test CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR:
    migrations-applied.` Ya no figura «CRÍTICOS CON COBERTURA PARCIAL: e2e»: 16 de 17 pasos corrieron
    de verdad, sin cobertura parcial.
- **Merge de `origin/main` `56fa2ae0`** en `ebe604da`: el cambio de `lib/calculadora.ts` es sólo de
  comentarios. Todo PASÓ:
  - `docs:check` (465 specs) y `check-numbering`;
  - harness 28/28;
  - Vitest de `calculadora-respaldo-alineado` y de la config, 40/40.

## COMMITS

- `aabe70e2`: reserva de SDD-0479, de dtdcargo-18.
- `ef973bb4` chore(harness): SDD-0479 — Supabase sintético deny-only para el e2e local de verify.
- `efef3d93` docs(SDD-0479): spec del Supabase sintético y decisiones de Sam sobre SDD-0470.
- «commit que contiene este documento»: handoff.

## PR / BRANCH

- Rama `codex/e2e-supabase-sintetico-deny-only`, sin publicar.

## PENDIENTES DE ESTA TAREA

- ~~Publicar la rama y abrir la PR en borrador~~: **autorizado por Sam el 2026-09-18**, textual:
  «Autorizo publicar las tres», con las tres ramas nombradas en la pregunta y sin merge ni
  producción.
- Los seis criterios de la spec están cumplidos: el 5 se marcó con la evidencia de arriba. El
  `status` sigue `in-progress` hasta la revisión del Director, que decide si pasa a `done`.

## FUERA DE ALCANCE DETECTADO

- En modo efímero (Tier 3), `next dev` no recibe `E2E_SUPABASE_URL` ni `E2E_SUPABASE_ANON_KEY` como
  variables públicas. SDD-0320 lo proponía, y no está en `main`.
- `app/p/[token]/PackingListProductsStep.test.tsx` («adds another group…») tarda unos 21 s aislada y
  su timeout es de 20 s. Con carga falla siempre, así que el paso `test` de `verify` no cierra verde
  en esta máquina. Necesita su propio arreglo: timeout de la prueba o partirla.
- Las páginas públicas (`getPublicCbmRate`, `getPublicCalculatorConfig` y otras) registran «RPC
  error» contra el deny-only en vez de «Faltan NEXT_PUBLIC_SUPABASE_URL…». Caen en el mismo respaldo
  y sus pruebas pasan, pero el log del WebServer del e2e es igual de ruidoso.

## Cierre documental

- **Impacto documental:**
  - `docs/specs/0479-…/spec.md`, nueva;
  - `docs/specs/0470-…/spec.md`, con la nota de decisiones;
  - `e2e/README.md`;
  - `docs/specs/README.md`, regenerado;
  - este handoff.
- **`node scripts/knowledge-sync.mjs status`** sobre `0d53d866`: `ok: false`.
  - **Estructural y semántico: `INVALID`.** El worktree no tiene grafo local: 4196 pendientes y 3103
    faltantes, casi todos anteriores a esta tarea.
  - **Archify: `PENDING`** (`ARCHIFY_RUNTIME_MISSING`). Instalarlo exige descargar `archify.zip`
    v2.16.0, y eso no se hizo sin autorización.
  - **Obsidian: `PENDING`.**
- **No se construyó el grafo en el worktree**, que es una extracción completa del repositorio. El
  Director lo actualiza desde `main` integrado, según el runbook. Ninguna capa se declara actualizada.

## Antes de publicar (2026-09-18)

- Se trajo `origin/main` `b43a39a5` (#138, sólo `docs/marketing/` y `public/interno/guia-peso.html`) en el merge `0d9b5125`, sin conflictos. `docs:check` y `check-pending-migration-symbols` PASÓ después del merge. Ese cambio no toca código ni pruebas de esta rama; las validaciones de arriba siguen vigentes.

## HANDOFF AL DIRECTOR

- Contratos compartidos: `playwright.config.ts`, `scripts/verify.mjs` y los helpers de `e2e/`. Revisar
  el orden si otra rama toca el gate.
- Integrar dispara el deploy de Vercel: `ignoreCommand` no excluye `scripts/**` ni `e2e/**`.
- El claim se libera al cerrar la escritura.
