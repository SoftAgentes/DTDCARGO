# Gate de símbolos pendientes por relación y deudas de arnés del bloque C (SDD-0464)

- Fecha: 2026-09-13. Task ID: `harness-gate-simbolos-por-relacion`.
- Owner / sesión escritora: `harness-gate-simbolos-20260913` (Worker Claude Code lanzado por el Director; sin subagentes propios ni otras sesiones escritoras en este árbol).
- Repositorio: `C:/Users/AKX generator/Desktop/Developer/DTDCARGO` (checkout principal en `main`, sin tocar).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/harness-gate-simbolos-por-relacion`.
- Rama: `codex/harness-gate-simbolos-por-relacion`. Base asignada: `origin/main` `76797beb`. Reserva SDD-0464 `0c523c21f0e5091ea653dd7258f64741f3aa9042` incorporada por cherry-pick (`af661b18`). Durante la tarea `origin/main` avanzó a `a9a12eed` (PR #110) y luego a `70ee6f458a328452a86c5728584ea612d75de3b1` (PR #106, L07); ambos se fusionaron en la rama (`e6c6912b` y `2ac1b7f2`), el segundo con el driver semántico de main forzado por `-c merge.dtd-generated-records.driver` según ADR-0002 (idéntico al de la rama) y con el índice regenerado por el script (449 specs, sin cambios que commitear). Sin rebase ni force.
- SDD: `docs/specs/0464-harness-gate-simbolos-por-relacion/spec.md`.
- Estado de tarea: lista-para-revision.
- Aceptación: cuatro deudas, cada una en su commit con prueba y control rojo; `pnpm verify` completo sobre el head de código.
- Alcance: solo arnés (scripts, pruebas, ADR, spec, este handoff). Sin producto, migraciones, datos ni cambios en `skills-lock.json`, `supabase/pending-migration-symbol-declarations.json` u otras specs.
- Dependencias: ninguna para revisar. La PR #104 (L14) deberá recortar su declaración al fusionar esta (ver HANDOFF AL DIRECTOR).
- Permisos: commits selectivos; push de la rama a sí misma y PR en borrador contra `main` autorizados. Prohibido merge, sacar de borrador, deploy, producción, ruleset, borrar ramas o worktrees.

## OBJETIVO ORIGINAL

Cerrar cuatro deudas de arnés detectadas en el bloque C: (1) que el gate `check-pending-migration-symbols` asocie cada columna pendiente a su relación en vez de exigir sitios homónimos de otras tablas; (2) que el paso `harness` de `verify` use el mismo descubrimiento que `harness:test`; (3) alinear `skills-lock.json` con el árbol real con validación que falle ante desalineación; (4) contrastar la aceptación de SDD-0440 con `main` y decidir su estado. Con SDD-0464, allowlist exacta, pruebas y control rojo por deuda, `verify` completo y PR en borrador.

## COMPLETADO

### Deuda 1 — columnas pendientes por relación (`7716d7c5`, ADR-0003)

Qué cambió en `scripts/check-pending-migration-symbols.mjs`:

- `applyRelationColumns` / `relationColumnsAfter`: modelo de columnas por relación leído del DDL ejecutado de todas las migraciones, en orden de nombre y sobre las mismas vistas que el extractor (texto sin comentarios ni literales, cuerpos `DO`, plantillas de `EXECUTE`): cuerpos de `create table (…)` (primer token de cada elemento que no sea `constraint|primary|unique|foreign|check|exclude|like`), `add column`, `drop column`, `rename column`, `drop table`; las vistas se registran sin columnas. Sobre `main` lee 258 relaciones con 3546 columnas. El primer intento no leía `drop column x;` ni `rename … to y;` al final del `alter table` porque `NAME_END` prohíbe el fin de fragmento; `NAME_END_IN_BODY` lo corrige (comprobado con `fiscal_settings.is_iva_withholding_agent` y `calculator_settings.peso_max_kg`, que dejaron de constar).
- `extractFunctionRelations`: `create function … returns [setof] relación` asocia la función a la relación (12 en `main`, por ejemplo `confirm_payment_report → payment_reports`); `returns table(…)` no nombra ninguna.
- `findReachableGraph`: el cierre transitivo devuelve además `imports` e `importers` entre módulos alcanzables; `findReachableModules` conserva su contrato.
- `createColumnAssociation` y la clasificación en `analyzeRepositoryData`: una mención alcanzable del nombre de una columna pendiente `R.c` cuenta si el ámbito (tokens del módulo y de sus vecinos directos) nombra `R` o una función que devuelve `R`; se descarta como homónima solo si, sin nombrar `R`, el ámbito nombra otra relación con columna `c` según el modelo; en cualquier otro caso cuenta. Funciones, tablas y vistas siguen por nombre. Cada análisis trae `homonymReferences` con la relación dueña; la salida los imprime en gris (`[HOMÓNIMOS] … → dispatch_orders.cancelled_at`) y la línea final suma `N homónimo(s) descartado(s)`.
- Contrato de `supabase/pending-migration-symbol-declarations.json` intacto (`schemaVersion: 1`, `$doc` sin tocar: el driver de merge lo exige idéntico entre ramas). Cambia lo exigido en `callSites`.

Caso real, sin tocar el worktree de la PR #104: extracción `git archive` del head `93f1cbed50797dc6c12353cce6530caf702a88d1` de `origin/codex/c-l14-portal-comandos-recibos`.

| Checker | Declaración de L14 tal cual (25 sitios, 13 evidencias) | Declaración recortada (10 sitios, 6 evidencias) |
|---|---|---|
| Anterior (`main`) | `0 ROJO · 2 AMARILLO`, exit 0 | no aplica |
| Nuevo | exit 2: para las tres columnas «pero hoy llama desde» los 10 sitios de `lib/portal/payment-report-queries.ts` | `0 ROJO · 2 AMARILLO · 15 homónimo(s) descartado(s)`, exit 0; 6 sitios → `dispatch_orders`/`qr_print_orders` (`cancelled_at`), 5 (`cancelled_by`), 4 → `expense_alerts` (`resolution_reason`) |

Control rojo: con el script de `main` en el árbol (stash) y una copia de la prueba sin los tres imports nuevos, el filtro `caso L14|propia relación|por nombre` da 6 fallos / 5 pasos: los tres casos L14, «columna borrada por otra aplicada» y «RPC pendiente por nombre» fallan por comportamiento (los sitios homónimos se cuentan); «aplica las migraciones por nombre» falla por export ausente. Log `control-rojo-gate-anterior.log`.

### Deuda 2 — un solo descubrimiento del harness (`9d1c21e4`)

- `scripts/tests/run-harness.mjs` exporta `HARNESS_TESTS_DIRECTORY`, `HARNESS_TEST_SUFFIX`, `discoverHarnessTests()` y `runHarness()`; corre solo como CLI (`import.meta.url` contra `process.argv[1]`, idioma ya usado por `check-pending-migration-symbols.mjs`). Mismo listado, mismo `node --test`, mismo error si no hay archivos.
- `scripts/verify.mjs`: el paso `harness` es `["--test", ...discoverHarnessTests()]` (14 archivos hoy; la lista manual nombraba 5), con nota de preflight con el conteo; un directorio sin pruebas rompe el gate al cargar. La ejecución vive en `export async function main()` detrás de la misma frontera CLI/import; `STEPS` se exporta. Las guardas de carga (`resolveWatchdogLimits`, `assertCompleteStepPolicy`) no cambian.
- `scripts/tests/verify-harness-discovery.node.mjs`: `STEPS.harness.argv` es exactamente `["--test", ...discoverHarnessTests()]`; el descubrimiento contiene los cinco de la lista anterior, los que faltaban y esta misma prueba; `package.json` `harness:test` apunta a `run-harness.mjs`; importar `verify.mjs` en un proceso aparte expone `STEPS`/`main` sin que aparezca `── harness ──`.
- `verify-critical-coverage.node.mjs` contrasta ahora su lista esperada con los `STEPS` reales (cierra la limitación «fixture duplicado» de deudas-cola deuda 3) y exige `discoverHarnessTests()` en el fuente. `verify-watchdog.node.mjs` sustituye su aserción literal a la lista manual por la del descubrimiento.

Controles rojos (logs `control-rojo-verify-lista-manual.log` y `control-rojo-verify-frontera.log`): con la lista manual restaurada en `verify.mjs`, la prueba de igualdad falla con el diff exacto (5 rutas contra 14); con la frontera retirada (`await main()` incondicional), importar `verify.mjs` arrancó el gate (apareció `── harness ──`) y el árbol se terminó con `taskkill /T` de inmediato. `verify.mjs` se restauró y se comparó byte a byte con la copia.

### Deuda 3 — manifiesto de skills con regla verificable (`050a25f2`)

Evidencia que cambió la lectura del encargo: `.gitignore` líneas 184–189 («Skills de terceros instalados con `npx skills add` … NO se versionan. El registro sí: skills-lock.json queda en git para poder reinstalarlos con `npx skills install`») y los commits `5d74c626` (2026-07-20, instala siete Higgsfield «lock en git, contenido ignorado») y `b4cb0866` (2026-08-23, `find-skills` «se instaló versionado sin querer» y se ignora igual). Las ocho entradas son el registro de reinstalación por diseño; ni el checkout principal ni este worktree tienen esas skills en disco (`git ls-files --others --ignored` vacío) y no hay instalación global (`~/.codex/skills` vacío; `~/.agents`, `~/.claude/skills` ausentes). Las dos de `.claude/skills/` y las dos de `.agents/skills/` son propias, versionadas con su `SKILL.md`, y el CLI no las gestiona: listarlas en el lock haría que una reinstalación las sobrescribiera. No existía ningún script de validación de skills (`bitacora-metrics`, `buscar-voseo` y `seed-agents` mencionan «skills» de producto, no de agentes).

Decisión: no editar `skills-lock.json`; volver la alineación una regla explícita y verificable en `scripts/check-skills-manifest.mjs` (`pnpm skills:check`, exit 0/1/2): (1) lock válido; (2) cada entrada apunta a un directorio que git ignora, nunca a una skill versionada ni a una que quedaría versionada por accidente; (3) cada skill versionada tiene frontmatter `name` igual al directorio y `description` no vacía, y no aparece en el lock; (4) cada directorio ignorado presente en `.agents/skills/` tiene entrada. Sobre el repo: `8 de terceros registradas (contenido ignorado; 0 presentes en disco) · 4 propias versionadas: director, worker (.agents/skills) · revisar-datos-ve, ui-pro (.claude/skills)`. `scripts/tests/skills-manifest.node.mjs` (9 casos) reproduce la alineación y cada desalineación en repos git temporales y corre el checker sobre este repositorio; entra en `harness:test`, en el paso `harness` de verify y en CI. Si el Director decide retirar las ocho entradas, el checker lo acepta sin cambios.

Control rojo: con la regla 2 desactivada en el checker (`if (false)`), falla exactamente «una entrada del lock que git no ignora quedaría versionada por accidente» (8/9); restaurado y comparado byte a byte. Un regex propio (`/\[FAIL\] skills-manifest/`) no contemplaba el código ANSI de reset y se corrigió antes del commit.

### Deuda 4 — SDD-0440 se queda `in-progress`

Contraste de la sección de aceptación con `main` `76797beb` (código y pruebas; focal Vitest `playwright-config`, `sdd-0168-fixture` e `hidratacion`: 65/65 en este worktree):

| Criterio | Evidencia en `main` | Estado |
|---|---|---|
| Mapper con las diez reglas vigentes; preflight exige las columnas; postcondición del seed | `scripts/seed-e2e.ts:218` (`buildE2ECalculatorSettings(DEFAULT_PARAMS)`), `:366` (postcondición); pruebas «traduce todos los defaults vigentes…», «cubre exactamente las columnas que el seed sobrescribe» | cumple |
| CI y efímero con un worker; kind con espacios; fórmula local `min(8, max(1, floor(núcleos/2)))`; `E2E_WORKERS` 1..32 | `playwright.config.ts:32-58` (`resolvePlaywrightWorkers`, `trim`, tope 8); pruebas «serializa por defecto CI y los branches efímeros», «…con espacios…», «acepta un override explícito y rechaza…» | cumple |
| `mobile-safari` un worker en Windows, sin límite en otras plataformas | `playwright.config.ts:73-76,146`; pruebas «serializa WebKit móvil en Windows…», «aplica el límite sólo al proyecto mobile-safari» | cumple |
| El seed emite el estado previo de las diez columnas y aborta si no puede leerlo | `scripts/seed-e2e.ts:231-253`; prueba «emite los valores previos de las diez columnas antes de sobrescribir» | cumple |
| Guard con URL canónica completa | `scripts/e2e/sdd-0168-fixture.ts:217-223`; pruebas de ref/URL/producción | cumple |
| `esperarHidratado()` conserva `cause` y el conteo diagnóstico nunca lo suplanta | `e2e/_helpers/hidratacion.ts:134-152`; pruebas «conserva la condición original…», «mantiene el conteo diagnóstico…» | cumple |
| Unitarias, documentación, gobernanza y TypeScript pasan | focal 65/65; `docs:check`, `governance:check`, typecheck en el verify de esta tarea | cumple |
| Corrida hospedada de los 168 E2E confirma el contrato completo | Ningún workflow ejecuta Playwright (`.github/workflows/quality.yml` no lo tiene); ningún handoff registra una corrida hospedada verde (`pr28-e2e-harness-validation-20260906.md:351,394`, `pr29-blockers-20260909.md:229`, `rescate-sdd-0440-arnes.md:97` la declaran pendiente) | falta |

Decisión: la spec no se edita y permanece `in-progress`. Falta exactamente una cosa: la corrida hospedada de los 168 E2E sobre un Supabase efímero autorizado (entorno y costo), con su registro. El rescate del 2026-09-10 demostró que el arnés está en `main`, no que ese criterio se cumplió.

### SDD-0464 y allowlist (`9ee4227c`)

Spec completada desde la reserva, índice regenerado (444 specs). La allowlist coincide uno a uno con el diff de la PR; `scripts/tests/verify-watchdog.node.mjs` entró por la aserción literal que descubrió el `harness:test` completo.

## VALIDACIÓN

Entorno: Windows 11, Node v24.20.0, pnpm 12.3.4 vía corepack, dependencias con `corepack pnpm install --frozen-lockfile` (exit 0, 36,8 s). Logs y recibos en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO/a4705ad7-612e-488b-9826-2cd036e3da72/scratchpad/harness-gate-simbolos/`.

Foco por deuda (sobre el árbol antes de fusionar main, `9ee4227c`; las comprobaciones rápidas se repitieron sobre `e6c6912b` y sobre el head final `2ac1b7f2`):

| Comprobación | Resultado |
|---|---|
| `node scripts/check-pending-migration-symbols.mjs` (línea base y tras el cambio, y tras el merge) | PASÓ: `0 ROJO · 0 AMARILLO`, exit 0, 1,2 s |
| Caso real L14 (`93f1cbed`, extracción `git archive`) anterior/nuevo/recortado | PASÓ: ver tabla de la deuda 1; logs `l14-old-gate.log`, `l14-new-gate.log`, `l14-new-gate-trimmed.log` |
| `vitest run scripts/check-pending-migration-symbols.test.mjs` | PASÓ: 20/20 (7 previas + 13 nuevas); línea base 7/7 |
| Control rojo deuda 1 (script de `main` por stash) | PASÓ como control: 6 fallos / 5 pasos en el filtro; restaurado (`git diff --stat HEAD` = 305+/12−), stash preexistente del Director intacto |
| `node --test verify-harness-discovery, verify-critical-coverage, harness-discovery, verify-watchdog` | PASÓ: 12/12 y 16/16 |
| Controles rojos deuda 2 (lista manual; sin frontera) | PASÓ como control: igualdad falla 5 contra 14; import lanza el gate y se corta |
| `pnpm skills:check` sobre el repo | PASÓ: 8 terceros registradas, 0 en disco, 4 propias |
| `node --test scripts/tests/skills-manifest.node.mjs` | PASÓ: 9/9 |
| Control rojo deuda 3 (regla 2 desactivada) | PASÓ como control: 8/9, falla la prueba de entrada no ignorada |
| Focal SDD-0440: `vitest run` de los tres archivos | PASÓ: 65/65 |
| `corepack pnpm harness:test` | PASÓ: 14 archivos descubiertos, 98/98 (línea base 87/87); una corrida intermedia FALLÓ por la aserción literal de `verify-watchdog.node.mjs:504`, corregida |
| ESLint focal sobre los archivos tocados | PASÓ: 0 errores |
| `node scripts/build-docs-index.mjs --check` | PASÓ: índice sincronizado con 444 specs (antes y después del merge) |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; choques históricos 0342/0394 exentos |
| `corepack pnpm governance:check` | PASÓ: 28 políticas, cápsula vigente |
| `git diff --check` | PASÓ |
| `corepack pnpm verify` completo sobre el head de código `2ac1b7f2` | FALLÓ en el resultado global (exit 1) por el e2e ambiental conocido; 16 de 17 pasos medidos. Detalle por paso abajo. |

### `pnpm verify` sobre `2ac1b7f2b0ab64d24a9ea8542d44c38b08b962a2`

Lanzado a las 20:09 (hora local) tras esperar con un vigilante en segundo plano (`wait-for-quiet-machine.mjs`: procesos `verify.mjs`/Playwright/`next dev`/`next build` y puertos 3100–3799) a que terminaran dos verify ajenos consecutivos (PIDs 49528 y 30368, e2e en 3191 y 3312); comprobación de calma repetida en el mismo comando de lanzamiento (0 procesos, 0 puertos). Terminó a las 20:30.

Recibos, con ruta exacta:

- Log completo: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\a4705ad7-612e-488b-9826-2cd036e3da72\scratchpad\harness-gate-simbolos\verify-final.log` (segunda línea: `HEAD=2ac1b7f2b0ab64d24a9ea8542d44c38b08b962a2 2026-09-13T20:09:07-04:00`; última: `verify exit=1 2026-09-13T20:30:13-04:00`).
- Meta: `C:\Users\AKXGEN~1\AppData\Local\Temp\claude\C--Users-AKX-generator-Desktop-Developer-DTDCARGO\a4705ad7-612e-488b-9826-2cd036e3da72\scratchpad\harness-gate-simbolos\verify-final.meta`, con `head_verificado`, inicio, fin, exit, comando, calma previa, veredicto por paso y escenarios e2e fallidos. Se escribió en la ronda 2 a partir del log, con `write-verify-meta.mjs` de la misma carpeta; la corrida no se repitió.

| Paso | Resultado |
|---|---|
| harness | PASÓ: 14 archivos descubiertos, 98 pruebas |
| lint | PASÓ: 0 errores |
| rsc-boundary | PASÓ: sin cruces |
| typecheck | PASÓ |
| edge-functions | PASÓ: 4 funciones compilan |
| test | PASÓ: 548 archivos, 6855 pruebas |
| docs:check | PASÓ: 449 specs |
| numbering | PASÓ |
| feature-constants | PASÓ: 5 banderas |
| components:check | PASÓ |
| governance:check | PASÓ: 28 políticas |
| migrations-applied | NO DISPONIBLE: SKIP sin `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` (worktree sin `.env.local`; no se copian credenciales) |
| pending-migration-symbols | PASÓ: `0 ROJO · 0 AMARILLO` (pendientes 0414 y 0415 sin sitios alcanzables) |
| sql-tests | PASÓ |
| schema-rebuild | PASÓ |
| e2e | FALLÓ (exit 1), ambiental conocido: dev server propio en el puerto 3718, 186 pruebas con 8 workers, dos intentos (`retry: 1`), sin corte del watchdog. Segundo intento: 153 pasadas, 15 fallidas, 18 omitidas (4,6 min). Los 15 fallos son los mismos cinco escenarios que dependen de Supabase, en chromium, mobile-chrome y mobile-safari: `auth.spec.ts:21` (Studio: form email+password), `:91` (Back: form), `:98` (Portal: magic link), `:105` (Portal: /entrar) y `global-search.spec.ts:22` (sin sesión, /studio rebota al login), con `toBeVisible`/`toHaveURL`. En el primer intento falló además el flaky conocido `auth.spec.ts:74` (chromium). Mismas cinco rutas que documentan SDD-0450 y el handoff de L14; no se repitió la corrida. |
| build | PASÓ |
| Resumen | `16 de 17 pasos corrieron de verdad`; línea final `verify: 1 fallo(s) → e2e CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.` |

Huérfanos revisados al terminar: ningún Playwright ni `next dev` míos, ningún puerto 3100–3799 en escucha, sin `.next/dev/lock` en el worktree; el único `verify.mjs` vivo (PID 39876) es una corrida nueva de otro Worker. `tsconfig.json` y el árbol quedaron limpios (`git status` solo muestra este handoff antes de su commit).

E2E autenticado y ledger productivo: NO DISPONIBLES en este worktree; no autorizan copiar credenciales ni tocar producción.

## COMMITS

- `af661b18` — cherry-pick de la reserva SDD-0464 (`0c523c21`).
- `7716d7c5` — deuda 1: gate por relación, pruebas Vitest, ADR-0003.
- `9d1c21e4` — deuda 2: descubrimiento único, frontera CLI/import, pruebas.
- `050a25f2` — deuda 3: `check-skills-manifest.mjs`, prueba, `skills:check`.
- `9ee4227c` — spec SDD-0464 e índice.
- `e6c6912b` — merge de `origin/main` `a9a12eed` en la rama (sin conflictos; índice sin cambios).
- `2ac1b7f2` — merge de `origin/main` `70ee6f45` (PR #106) con el driver de main; índice regenerado sin cambios. Head de código verificado.
- `fed65d4e` — cierre documental de la ronda 1: spec a `done`, índice y este handoff.
- Commit que contiene esta ronda 2: solo spec y handoff; hash final en la PR.

## RONDA 2 — revisión del Director (2026-09-14)

Aceptadas las cuatro deudas, incluida la desviación con evidencia en `skills-lock.json` y dejar SDD-0440 en `in-progress`. Correcciones de texto pedidas y hechas, allowlist de esta ronda limitada a la spec y este handoff:

- **Allowlist exacta de la spec.** Se contrastó con `git diff --name-only origin/main...HEAD` (`origin/main` = `main` local = `70ee6f45`): 14 rutas en el diff y 14 entradas en la lista, coincidencia uno a uno; `package.json` ya figuraba y ahora lleva el alcance «solo el script `skills:check`». La comparación automática solo difería por el token `skills:check` dentro de esa misma línea.
- **Meta del verify.** No existía un archivo `verify-*.meta`: el HEAD y las marcas de tiempo estaban en la segunda y la última línea de `verify-final.log`. Se generó `verify-final.meta` desde el log (rutas exactas arriba), sin repetir la corrida.
- **Validación proporcional:** `node scripts/build-docs-index.mjs --check`, `corepack pnpm sdd:check` y `git diff --check` PASARON; `pnpm verify` NO EJECUTADO en esta ronda: desde `2ac1b7f2` solo cambió documentación, demostrado con `git diff --stat 2ac1b7f2..HEAD` (spec, índice y handoff), citado en la respuesta al Director.
- Claim reclamado para la ronda, un único push normal de la rama a sí misma, PR #111 sigue en borrador, claim liberado al terminar.

## PR / BRANCH

- Rama: `codex/harness-gate-simbolos-por-relacion`, base `main`, worktree indicado arriba. Push explícito de la rama a sí misma tras el commit de este documento.
- PR en borrador contra `main`, creada después del push; URL y SHA final en la respuesta al Director y en la descripción de la PR.

## PENDIENTES DE ESTA TAREA

- Ninguno. Las cuatro deudas tienen commit, prueba y control rojo; verify completo ejecutado sobre el head de código con el e2e ambiental y el ledger clasificados arriba.

## FUERA DE ALCANCE DETECTADO

- **PR #104 (L14):** al fusionar esta PR, su declaración `l14-payment-report-columns-pending` fallará con exit 2 hasta recortar `callSites` a los 10 sitios de `lib/portal/payment-report-queries.ts` y retirar las 7 evidencias «Sin degradado». El mensaje del gate trae la lista exacta. No se tocó su rama.
- **SDD-0440:** la corrida hospedada de los 168 E2E sigue sin autorización de entorno/costo; no pertenece a esta tarea.
- **`skills-lock.json`:** retirar las ocho entradas de terceros (si Sam ya no usa Higgsfield/find-skills) es una decisión aparte; el checker la acepta. Los `computedHash` del CLI no se recalculan localmente.
- **Límite documentado del gate (ADR-0003):** un consumidor compartido a un salto de una dueña homónima y a más de uno de la relación pendiente se descuenta; el módulo que consulta la relación pendiente sigue exigiéndose por sí mismo.
- **`docs/architecture/README.md`** dice que `decisions/` «se crea cuando haya la 1ª decisión»; ya hay tres ADR. No se editó.
- Stash preexistente en el repo: `stash@{0}: On main: Director adoption: preserve local AGENTS before main 74bb52ab`. No es de esta tarea; se conserva.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador, en particular la semántica de ADR-0003 (regla de descuento con evidencia positiva y vecindario de un salto) y la decisión de conservar `skills-lock.json` como registro de reinstalación.
- **Cambios compartidos:** `scripts/verify.mjs` (frontera CLI/import, `STEPS` exportado) y `scripts/tests/run-harness.mjs` (exports). Ninguna rama abierta debería depender de la lista manual; la búsqueda de referencias literales no encontró otras.
- **Integración:** tras fusionar, pedir a L14 el recorte de su declaración (una ronda). Sin migraciones, producción ni ruleset.
- **Sesiones consumidoras:** ninguna; sin subagentes. Worktree y rama se conservan.
- **Ownership:** se libera con `node scripts/harness-worktree.mjs release --owner harness-gate-simbolos-20260913` después del push y de verificar el SHA remoto.
