# PR #28 — candidata limpia apilada sobre PR #29 y validación de SDD-0440

- Fecha: 2026-09-07 (candidata limpia). Validación previa fechada: 2026-09-06.
- Task ID: `pr28-clean-stack-20260907`, relevo de `pr28-e2e-harness-validation-20260906`.
- Owner / sesión: Worker B `claude-worker-b-clean-stack-20260907` (Claude Desktop).
- Director: `claude-director-desktop-20260907`.
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/pr28-clean-stack-20260907`.
- Rama: `codex/pr28-clean-stack-20260907`, sin upstream, creada por el Director desde
  `origin/codex/e2e-harness-general-20260905` = `80eea11e88120f0fb6a074a67c733e6bd19c6e59`.
- Refs reconsultadas el 2026-09-07T22:54:44Z (`git fetch origin` sin prune + `gh pr view`):
  `origin/main` = `74bb52ab9677f96908cc032a15f2364ab9d94716`;
  PR #28 head `codex/e2e-harness-general-20260905` = `80eea11e88120f0fb6a074a67c733e6bd19c6e59`
  (OPEN, `mergeable=CONFLICTING`, `mergeStateStatus=DIRTY` contra main);
  PR #29 head `codex/0448-replay-0223-history` = `03a7d0c0ce1975c97414960d846bcd1ff4224647`
  (OPEN, `MERGEABLE`/`CLEAN`). Sin drift respecto del encargo.
- Objeto de referencia revisado: `02b5674fd11df9086732e8b001c1c6470a5a0439` (cierre 2026-09-06);
  base histórica del delta focal: `17d58fe44f641c7af7ee6e874b5b56a96fb8f427`.
- SDD existente: `docs/specs/0440-e2e-harness-general-determinista/spec.md`, `in-progress`;
  sin reservar ni asignar número nuevo.
- Estado de tarea: lista-para-revision. SDD sigue in-progress por los 168 E2E hospedados.

## Objetivo y aceptación del relevo (2026-09-07)

Reconstruir una candidata limpia y revisable de PR #28 sobre la cabeza publicada
de PR #29, en un worktree nuevo, sin usar el working tree sucio histórico
(`pr28-e2e-harness-validation-20260906`, que no se abrió ni se leyó) y sin
reescribir historia remota. El diff respecto de
`origin/codex/0448-replay-0223-history` debe ser exactamente nueve paths, el
commit debe descender de los heads remotos de #28 y #29, y la unidad se valida,
se commitea y se entrega al Director. Sin push, sin editar la PR, sin merge.

## Candidata

- SHA candidato: el commit que contiene este documento (hijo de `386254fd`);
  el Director lo registra en la PR tras el push. Commits first-parent desde
  `03a7d0c0`, todos con identidad `Sam DTD-CARGO
  <285193249+hailuwaycom-sketch@users.noreply.github.com>` (la misma de
  `80eea11e` y de los commits previos con `Co-Authored-By: Claude`; fijada solo
  por variables de entorno porque este shell no tenía `user.name`/`user.email`
  en ninguna capa de config y no se escribió configuración compartida):
  1. `2849fe3484ea58c6d72dd82b43d91922f7448a1b` `chore(harness)`: merge
     `--no-ff` de `origin/codex/0448-replay-0223-history` sobre `80eea11e`;
     padres `80eea11e` + `03a7d0c0`; 42 archivos automerged; único conflicto
     `docs/specs/README.md`.
  2. `386254fd2b1576e43532da601152e28642662dad` `test(e2e)`: `git restore
     --source=02b5674f -- <ocho paths>`; seis con cambios (135+/10-), dos ya
     idénticos tras el merge (`docs/specs/README.md`, `scripts/seed-e2e.ts`).
  3. Commit que contiene este documento (`docs(harness)`): solo este handoff.
- Ancestría: `git merge-base --is-ancestor 80eea11e HEAD` → sí;
  `git merge-base --is-ancestor 03a7d0c0 HEAD` → sí;
  `merge-base(80eea11e, 03a7d0c0)` = `b8294664`. Un push normal a
  `codex/e2e-harness-general-20260905` es fast-forward.
- Conflicto del índice generado: candidatos calculados con
  `(b8294664..80eea11e) ∩ (b8294664..03a7d0c0)` = solo `docs/specs/README.md`.
  Resuelto con el blob `f04368b67d8eb94caeb43db41146df68b3716e85` de
  `02b5674f:docs/specs/README.md`; `node scripts/build-docs-index.mjs --check`
  exit 0 y la regeneración (`node scripts/build-docs-index.mjs`, 311 specs,
  133 huecos) produce exactamente el mismo blob. La fila 0440 del índice es
  idéntica en `80eea11e` y `02b5674f` (solo cambian `updated` y el cuerpo de la
  spec), por eso ambos caminos coinciden.
- Contenido focal: `git diff --stat 02b5674f HEAD -- <ocho paths>` vacío;
  `git diff --name-only 02b5674f HEAD` = solo este handoff y
  `.agents/handoffs/pr29-publication-review-20260907.md` (llega del merge de
  PR #29 y no se tocó). Nunca se copió nada desde el filesystem histórico.
- Instalación: `pnpm install --frozen-lockfile --prefer-offline` con pnpm
  11.19.0 aislado (runtime Codex, entrypoint `pnpm.mjs` SHA-256
  `ff3224d46b47fbb24a7e9fe15fededef7e00892d07d4e376b6762d4899906bfd`), Node
  v24.20.0 del PATH: 813 paquetes (813 descargados, 0 reutilizados), 2 m 39,6 s,
  exit 0, `pnpm-lock.yaml` sin cambios (`git status --short` vacío). Sin `.env`,
  sin variables Supabase/E2E en el entorno, sin `node_modules` copiado.

## Alcance exacto

`git diff --name-only origin/codex/0448-replay-0223-history` = exactamente:

- `.agents/handoffs/pr28-e2e-harness-validation-20260906.md` (este documento)
- `docs/specs/0440-e2e-harness-general-determinista/spec.md`
- `docs/specs/README.md` (índice generado)
- `e2e/README.md`
- `playwright.config.ts`
- `scripts/__tests__/playwright-config.test.ts`
- `scripts/__tests__/sdd-0168-fixture.test.ts`
- `scripts/e2e/sdd-0168-fixture.ts`
- `scripts/seed-e2e.ts`

Los archivos de PR #29 (`supabase/migrations/0448_*`, su test SQL y handoffs)
entran por el merge sin edición. No se tocaron árboles ajenos, ramas publicadas,
`main` ni el checkout principal.

## Validación de esta candidata (2026-09-07)

Entorno: Docker 29.7.2 con siete contenedores Supabase ajenos en ejecución
(`dtd-pr28-auth-02b5674f-20260906`, Up 3 h; no se tocaron); RAM libre 4,9–5,9 GB
de 31,4; sin Chromium en `%LOCALAPPDATA%\ms-playwright`; sin Deno en PATH ni
en `~/.deno/bin`; sin dev server ni `.next/dev/lock` en el árbol. Evidencia
externa: `C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr28-clean-stack-20260907-verify/`.

| Comprobación | Comando (cwd = worktree) | Resultado |
|---|---|---|
| Focal Vitest | `node node_modules/vitest/vitest.mjs run scripts/__tests__/playwright-config.test.ts scripts/__tests__/sdd-0168-fixture.test.ts` | PASÓ: 44/44, 2 archivos, 35,6 s, 0 skips (`focal-vitest.log`) |
| Harness: preflight E2E de verify | `node node_modules/vitest/vitest.mjs run scripts/__tests__/verify-e2e.test.mjs` | PASÓ: 12/12 (`harness-verify-e2e-vitest.log`) |
| sdd:check | `node scripts/check-numbering.mjs` | PASÓ: sin números repetidos; siete choques históricos aplicados en prod reconocidos, no renumerados |
| docs:check | `node scripts/build-docs-index.mjs --check` | PASÓ |
| rsc-boundary | `node scripts/check-rsc-boundary.mjs` | PASÓ: 1.586 módulos, sin cruces server→client |
| Secretos en el diff | `git diff origin/codex/0448-replay-0223-history` filtrado con `grep -nE -i` por `sbp_[A-Za-z0-9]{6,}`, `sb_secret`, `service_role`, JWT `eyJ….…`, `BEGIN … PRIVATE KEY`, `AKIA[0-9A-Z]{16}` y `(api[_-]?key|secret|token|password) = "literal"` | PASÓ: 0 coincidencias. Las URLs añadidas son entradas sintéticas de test (`ephemeralref…`, `.untrusted.invalid`) y el ref público `xpfuzqombmjmxvprjgmi`, ya presente en `origin/main` como `PRODUCTION_PROJECT_REF` (identificador de proyecto, no credencial) |
| Espacios/CRLF | `git diff --check origin/codex/0448-replay-0223-history` | PASÓ |
| Colección Playwright | `node node_modules/@playwright/test/cli.js test --list [--reporter=json]` en tres modos | Colección, no ejecución: 168 tests / 14 archivos / 56 por proyecto (`chromium`, `mobile-chrome`, `mobile-safari`); workers resueltos 8 (local), 1 (`CI=1`), 4 (`E2E_WORKERS=4`). `collection-{local,ci,override}.{txt,json}` |
| Diff final | `git diff --name-only` y `--stat origin/codex/0448-replay-0223-history` | Nueve paths exactos (ver Alcance): 379 inserciones y 6 eliminaciones en los ocho paths de producto/docs más este handoff |
| pnpm verify | `bash verify-runner.sh` → `node scripts/verify.mjs` con `NODE_OPTIONS=--max-old-space-size=4096`, `VITEST_MAX_WORKERS=4`, `VERIFY_SKIP_E2E=1` | exit 0; 14 de 16 gates medidos sin fallos; ver tabla de gates |

`pnpm verify` corrió una sola vez, sin reintentos manuales, sobre
`386254fd2b1576e43532da601152e28642662dad`, desde `2026-09-07T23:05:55Z` hasta
`2026-09-07T23:17:22Z` (11 min 27 s), exit 0. Resumen literal del script:
«14 de 16 pasos corrieron de verdad … sin fallos, pero 2 paso(s) NO se midieron
→ migrations-applied, e2e. Esto NO es un cierre verde completo».

| Gate | Resultado |
|---|---|
| harness | PASÓ: 12/12 (`node --test`, tres suites), 0 skips, 10,7 s |
| lint | PASÓ: 0 errores, 8 warnings preexistentes en archivos ajenos al cambio (`PurchaseStepDetalle.test.tsx`, `KommoBoardView.tsx`, `KommoClient.tsx`) |
| rsc-boundary | PASÓ: 1.586 módulos en app/lib, sin cruces server→client de valores |
| typecheck | PASÓ (`tsc --noEmit`, TypeScript 5.9.3) |
| edge-functions | PASÓ: 4 funciones compilan con `deno 2.x vía npx deno@2` (descarga por red; no hay Deno local) |
| test | PASÓ: 6.216/6.216 en 501 archivos, Vitest 4.1.7, 4 workers, 299,5 s, 0 skips |
| docs:check | PASÓ |
| numbering | PASÓ: sin números repetidos; choques históricos reconocidos |
| feature-constants | PASÓ: 5 banderas coinciden con lo declarado |
| components:check | PASÓ |
| governance:check | PASÓ: 28 políticas aprobadas, cápsula vigente |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`; ledger remoto no consultado ni credenciales aportadas |
| sql-tests | PASÓ: 140 contratos SQL en PostgreSQL desechable con rollback total, incluido `0448_restore_calculator_settings_0223_history.test.sql` |
| schema-rebuild | PASÓ: 399 migraciones reconstruidas sobre postgres:17 (381 aplicadas desde cero + 18 solo-ledger); aislamiento multi-tenant en 219 tablas + 2 tenants |
| e2e | NO EJECUTADO: `VERIFY_SKIP_E2E=1` (sin Supabase efímero, credenciales ni Chromium local) |
| build | PASÓ: Next.js 16.2.11 (Turbopack), compilación 24,9 s, prerender y postbuild Norte; `tsconfig.json` restaurado y `.next-verify` ausente al terminar |

Al terminar verify: `git status --short` vacío, sin `deno.lock` ni `.next`,
contenedores `dtd_sqltest_*`/`dtd_rebuild_*` ausentes; los siete contenedores
ajenos siguen igual.

| Artefacto (DTD-backups/pr28-clean-stack-20260907-verify) | SHA-256 |
|---|---|
| verify.log | `47017c11647dde05018610188d31b02ab9b10a8dd4dea4cdffe4919377af0858` |
| verify-runner.sh | `e563d6eaea645212bcdf7745714e4f33fa182c33e5e2d89679b33be5dfa0bb3d` |
| focal-vitest.log | `9947f3b74b793945c54e594756fcc6f40f2c81c08f4200d5ab12d0f15c53b422` |
| harness-verify-e2e-vitest.log | `f139520c09881c0ffa326a1a9a170550d878d8feac9246731de237366c138497` |
| install.log | `2f4b9ce5b0dae6ed556e2fcb0e1df8de4c5237b850eb10dc9d354a9c38c868ac` |
| collection-local.json | `76ce72ef990af321e95a8af6725e53228715793f6c90a2ef79360190194f9d2f` |
| collection-ci.json | `cb5d29fbb6c4a207a99f0051eeadfe8d956684cb9e33318fb8f689b2d159fa9d` |
| collection-override.json | `484bf9108f1e666c978e06bacfe049a4bf9506551f84d796bb93cac29f3c51b5` |

`closure-manifest.json` (generado al cierre por `closure-manifest.mjs`) registra
SHA final, ancestría, los nueve paths, igualdad de los ocho paths con `02b5674f`,
estado Git, ausencia de claim y los hashes anteriores.

## Límites de esta validación

- **E2E general (168) y Auth18 alojado (18/18): NO EJECUTADOS.** No hay Supabase
  efímero autorizado, credenciales ni Chromium local; `VERIFY_SKIP_E2E=1` deja el
  gate explícitamente omitido en vez de medir contra nada. La colección de 168
  casos es inventario. Ninguna corrida hospedada se declara verde.
- **`migrations-applied`: NO DISPONIBLE.** Sin URL/llave de servicio; el ledger
  remoto no se consulta y no se aportan credenciales para hacerlo pasar.
- No se creó ningún cliente Supabase real ni se envió tráfico a producción: las
  regresiones del guard usan datos sintéticos y un espía sin red.
- No push, no PR nueva, no edición de PR #28, no merge a main, no despliegue,
  no Supabase producción, no limpieza de worktrees/ramas.

## Handoff al Director

- Verificar desde este worktree: `git rev-parse HEAD`, ambos
  `merge-base --is-ancestor` y `git diff --name-only origin/codex/0448-replay-0223-history`
  (nueve paths). Reconsultar heads de #28/#29 antes de publicar.
- Comando sugerido para el push normal (fast-forward al head de PR #28):
  `git push origin HEAD:codex/e2e-harness-general-20260905`
- Comando sugerido para apilar la revisión, solo después del push:
  `gh pr edit 28 --repo hailuwaycom-sketch/DTDCARGO --base codex/0448-replay-0223-history`
- Ninguno de los dos se ejecutó. El workflow `Calidad continua` solo se dispara
  en PR contra `main`: con base en la rama de #29 no habrá corrida alojada para
  #28 hasta que #29 se integre y la base vuelva a `main`.
- Claim `claude-worker-b-clean-stack-20260907` liberado al cierre; worktree y
  rama se conservan; no existe respaldo remoto de estos commits hasta el push.

## Validación previa (2026-09-06, evidencia fechada sobre `02b5674f`)

Resumen del cierre anterior, conservado como historial; describe el árbol
`pr28-e2e-harness-validation-20260906` (rama `codex/pr28-e2e-harness-validation-20260906`,
Worker `01a073a6-f21d-7483-9b74-4d9f3464c295`, Director
`01a073cc-1278-7422-81da-9f85c2fff047`), no la candidata actual.

- Combinación: main `74bb52ab` → #29 corregida `17d58fe4` (merge `3f9ea13d`) →
  #28 `80eea11e` (merge `fe90f9a0`, índice regenerado con 311 specs) →
  correcciones autorizadas `b08116f8` (normalización `trim` de
  `E2E_ENVIRONMENT_KIND` y guard restringido al origen canónico
  `https://<ref>.supabase.co`) → cierre documental `02b5674f`.
- Focal original 23/23; regresiones nuevas 14 fallos de 44 sobre el original
  (incluido el seed creando cliente hacia host ajeno, con espía sin red) y
  44/44 tras corregir. Colección CLI 168 casos/14 archivos, workers 8/1/4.
- `pnpm verify` sobre `b08116f8` (2026-09-06T04:35:41Z → 04:59:03Z, exit 0):
  14/16 pasos ejecutados sin fallos. harness 12/12; lint 0 errores y 8
  warnings ajenos; rsc-boundary 1.586 módulos; typecheck; edge-functions con
  Deno 2.9.6 local; test 6.216/6.216 en 501 archivos (4 workers);
  docs:check; numbering 311 specs/399 migraciones; feature-constants 5;
  components:check; governance:check 28 políticas; sql-tests 140/140 en
  PostgreSQL desechable incluido 0448; schema-rebuild 381 aplicadas + 18
  solo-ledger; build Next.js 16.2.11. NO EJECUTADOS: `migrations-applied`
  (sin credenciales) y `e2e` (omisión autorizada sin Supabase efímero).
- Revisiones independientes favorables: #29 sobre `17d58fe4`/`1e31b9a3` (diez
  escenarios PostgreSQL 17.11, cinco abortos atómicos; condiciones de release:
  ejecutor transaccional único y preflight de metadatos) y #28 sobre `b08116f8`
  (48 combinaciones de workers, 25 casos de guard, 23 entradas inválidas sin
  cliente, tres aliases negativos, diez columnas, 12 abortos de postcondición).
  Observación opcional sobre coerciones `Number(null/""/false)` sin ruta real;
  no se amplió el alcance.
- Evidencia externa:
  `C:/Users/AKX generator/Desktop/Developer/DTD-backups/pr28-e2e-harness-validation-20260906/`
  (`verify.log` SHA-256 `7eaabc65dbc68431be264348613b0e5ea4f444324be83fe9632b1dc9c3dc83ef`,
  `verify-result.json` `6bb761be36d236e89b7a0778465a5bee95b0b573f09a4b801cae9407ef0300df`,
  `ephemeral-execution-plan.md` `380f0add0a327bac6b032f25181625c5da459abc12c0707f90120f75daa32bc5`)
  y `C:/Users/AKX generator/Desktop/Developer/DTD-backups/director-goal-20260905/`
  (revisión #28 `0bcb28bba407711b3118e7aa9c3f29f00ae741448d89ebfb378c02310d7a6fd1`,
  revisión #29 `a557dd75bd4a981fb0b35c74e33357f5af55fa971ffce96ed29706cb89aa8ce0`).
- Plan efímero preparado y pendiente de autorización: un solo branch
  `e2e-sdd0440-pr28-<sha>`, sin datos/Storage de producción, ventana de hasta
  dos horas, owner explícito, permiso para recurso/costo, seed y destrucción;
  app y seed en el mismo branch; teardown verifier solo comprueba.

## Cierre Worker (2026-09-07)

- **OBJETIVO ORIGINAL:** candidata limpia y revisable de PR #28 sobre la cabeza
  publicada de PR #29, en worktree nuevo, sin el working tree sucio ni reescritura
  remota; diff exacto de nueve paths; validar, commitear y entregar handoff.
- **COMPLETADO:** merge no destructivo de `03a7d0c0` sobre `80eea11e` con el
  único conflicto (índice generado) resuelto con evidencia; ocho paths
  materializados byte a byte desde `02b5674f`; handoff focal reescrito; diff
  final de nueve paths; HEAD descendiente de ambos heads remotos; validación
  local completa dentro de los límites declarados.
- **VALIDACIÓN:** sobre `386254fd` (código idéntico al SHA candidato salvo este
  documento): focal 44/44; harness preflight 12/12; sdd:check, docs:check,
  rsc-boundary, secretos, `diff --check` PASÓ; colección 168/14/56 con workers
  8/1/4; `pnpm verify` exit 0 con 14/16 gates medidos (6.216 tests, 140
  contratos SQL, 381+18 migraciones, build). NO DISPONIBLE: `migrations-applied`.
  NO EJECUTADO: `e2e`, Auth18 alojado y 168 E2E hospedados.
- **COMMITS:** `2849fe3484ea58c6d72dd82b43d91922f7448a1b` merge de PR #29;
  `386254fd2b1576e43532da601152e28642662dad` ocho paths desde `02b5674f`;
  commit que contiene este documento: handoff. Todos con `git add -- <allowlist>`
  y trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- **PR / BRANCH:** PR #28 sigue OPEN con head publicado `80eea11e`
  (https://github.com/hailuwaycom-sketch/DTDCARGO/pull/28); PR #29 OPEN con head
  `03a7d0c0`. Rama local `codex/pr28-clean-stack-20260907` en el worktree del
  encabezado, sin upstream. No push, no PR nueva, no edición de PR.
- **PENDIENTES DE ESTA TAREA:** revisión del Director; push fast-forward y cambio
  de base con los comandos sugeridos (no ejecutados). La corrida hospedada de
  168 E2E/Auth18 sigue siendo criterio abierto de SDD-0440, fuera del alcance de
  esta candidata y pendiente de autorización de entorno/costo.
- **FUERA DE ALCANCE DETECTADO:** ocho warnings de lint preexistentes en CRM y
  portal; aviso pnpm sobre `pnpm.onlyBuiltDependencies` y avisos npm sobre
  `auto-install-peers`/`strict-dep-builds` de `.npmrc` al invocar `npx deno@2`;
  siete contenedores Supabase ajenos (`dtd-pr28-auth-02b5674f-20260906`) llevan
  más de tres horas en ejecución ocupando memoria; el shell no tiene identidad
  Git configurada en ninguna capa; PR #28 figura `CONFLICTING` contra main por el
  índice generado, lo que esta candidata resuelve al apilarse sobre #29. Nada de
  esto se corrigió aquí.
- **HANDOFF AL DIRECTOR:** SHA candidato = commit que contiene este documento;
  `merge-base --is-ancestor` verdadero para `80eea11e` y `03a7d0c0`; diff de
  nueve paths exactos frente a `origin/codex/0448-replay-0223-history`; claim
  liberado tras este commit y comprobado en `closure-manifest.json`. Siguiente
  acción: revisar, hacer el push normal al head de #28 y luego cambiar la base
  de #28 a la rama de #29. Worktree, rama y evidencias externas se conservan.
