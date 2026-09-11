# Handoff — watchdog del paso e2e de `verify`

Fecha: 2026-09-11. Task ID: `verify-e2e-watchdog`.
Owner / sesión escritora: `verify-e2e-watchdog-claude-20260911` (Worker Claude Code, sesión `awesome-kapitsa-269943-82`). No hubo subagentes. No había un Director identificable para esta tarea, así que seguí el procedimiento SDD del runbook sin convertir la sesión en centro de integración.
Estado: lista-para-revision. La [PR #89](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/89) está publicada en borrador contra main, con autorización de Sam. No está integrada.

- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/verify-e2e-watchdog`, creado con `node scripts/harness-worktree.mjs start verify-e2e-watchdog` después de `git fetch origin`. `guard` y `claim --owner verify-e2e-watchdog-claude-20260911` PASARON sobre el árbol limpio.
  - `guard --owner` se revalidó antes de cada commit y del push.
  - El claim se liberó al cierre local y se volvió a tomar para publicar.
- Rama: `codex/verify-e2e-watchdog`, con upstream `origin/codex/verify-e2e-watchdog`.
  - Nació en `07d00097` (origin/main al crearla) y avanzó con fast-forward al commit de reserva `e36329b8`, cuyo padre es `50100cc4`.
  - Entre `07d00097` y `50100cc4` no cambiaron `package.json` ni el lockfile.
  - Antes de publicar hice merge de `origin/main` `bbc7493f` en la rama (`a96e0a2b`). Main había integrado L20, L15, L08, L11 y el registro de 0409. El único archivo en común era el índice generado `docs/specs/README.md`: lo resolvió el merge driver `dtd-generated-records` y lo regeneré con `docs:index` (423 specs).
- SDD: `docs/specs/0454-verify-e2e-watchdog/spec.md`, en `done`: se cumplieron todos sus criterios. La PR y el merge se registran aparte.
  - La reservé con `node scripts/next-number.mjs --reserve verify-e2e-watchdog`, que creó la ref local `codex/sdd-reserve-0454-verify-e2e-watchdog` y el lock `refs/dtd/reservations/0454`.
  - El inventario previo daba 0453 como libre, pero otra sesión la reservó antes; la reserva atómica me asignó 0454 sin choque.
  - La ref de reserva no se publicó aparte. La PR #89 contiene la spec, y el inventario de `next-number` lee las PRs abiertas, así que el número ya es visible para otras máquinas.

## OBJETIVO ORIGINAL

Que el paso e2e de `scripts/verify.mjs` no pueda colgar el gate indefinidamente:

- watchdog configurable, por inactividad de salida y por duración total;
- al vencer, terminar solo el árbol de procesos propio del paso;
- reportar el paso como FALLÓ con motivo «colgado/timeout» explícito, sin disfrazarlo de SKIP ni de verde;
- mantener coherentes `STEP_POLICY` y el resumen del cierre, sin debilitar tests ni cambiar los retries de Playwright;
- pruebas de harness que simulen un proceso que no termina, `harness:test` y `verify` completo;
- commits selectivos. Publicar solo con autorización de Sam, y sin merge.

Evidencia de partida: los handoffs de L21 y L08, cada uno en su rama, y los de L09 y L13 en main.

## COMPLETADO

- **`scripts/verify-watchdog.mjs`** (nuevo):
  - Corre el paso con la salida canalizada y reenviada tal cual, así se puede medir la inactividad.
  - Vigila `VERIFY_E2E_IDLE_MIN` (10 min por defecto) y `VERIFY_E2E_TIMEOUT_MIN` (60 min, para el paso completo con su reintento). Ambos admiten decimales. Un valor inválido rompe el gate antes de correr pasos, y el watchdog no se puede apagar.
  - Al vencer, arma el árbol por PPID desde el hijo del paso: CIM con hora de creación en Windows, `ps` en POSIX. Descarta hijos anteriores a su padre (PID reusado) y corta por PID.
  - Hace dos rondas más para lo que nazca durante el corte. Confirma que un PID sigue siendo el mismo proceso antes de re-matarlo o de acusarlo como sobreviviente.
  - Nunca elige procesos por nombre, puerto ni ruta. `taskkill /T` queda solo como respaldo sin inventario.
  - Imprime la raíz, los procesos terminados por ejecutable y los sobrevivientes, es decir, lo que sigue corriendo. Aparte informa lo que ya no corre pero el sistema aún lista mientras cierra su E/S («aún en cierre del sistema»; Chrome tardó hasta ~3 min en la validación v2).
- **`scripts/verify-runner.mjs`** (nuevo): la ejecución de un paso (preflight, intentos, absolvedor, watchdog y clasificación) sale de `verify.mjs` sin cambiar su comportamiento. Un cuelgue:
  - queda FALLÓ con el motivo `COLGADO/TIMEOUT: …`;
  - no se reintenta ni se absuelve;
  - no impide que el gate siga con `build`.

  Si el reintento de un fallo común ya no cabe en el límite total, no se lanza y el motivo lo dice.
- **`scripts/verify-step-policy.mjs`**: `buildVerifyVerdict` acepta un fallo como nombre o como `{ name, reason }` y lleva el motivo a la línea final (`verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: …]`). Un fallo común sale idéntico que antes. `STEP_POLICY` no cambia y `e2e` sigue siendo crítico.
- **`scripts/verify-e2e.mjs`**: `envParaSalidaCanalizada` pasa `PLAYWRIGHT_FORCE_TTY=<cols>x<filas>` solo cuando quien corre el gate está en una terminal real, para que Playwright conserve el aspecto con la salida canalizada.
- **`scripts/verify.mjs`**: lee los límites antes de correr, cablea el watchdog al paso `e2e` (conserva `retry: 1`, el absolvedor y el preflight) y usa `runStep`. El paso `harness` también corre la prueba nueva.
- **Pruebas:**
  - `scripts/tests/verify-watchdog.node.mjs` (nuevo, 14 pruebas):
    - un árbol de tres niveles que calla, con los nietos heredando el pipe y un proceso ajeno que corre el mismo script y sobrevive;
    - una salida que gotea y se corta por el límite total;
    - corridas normales con exit 0, 1 y 3, y un proceso lento pero activo;
    - el recorrido del árbol con PID reusado y ciclos;
    - el corte sin inventario, lo que nace durante el corte, un PID reusado, un sobreviviente real y los procesos en cierre;
    - en el runner: cuelgue sin reintento ni absolución y el gate que sigue; reintento, salto, absolución, preflight y camino sin watchdog intactos; presupuesto agotado antes del reintento;
    - la TTY y el cableado de `verify.mjs`.
  - `scripts/tests/verify-critical-coverage.node.mjs`: veredicto con motivo, mezcla con fallo común y crítico sin medir, y rechazo de un motivo vacío o de un paso desconocido.
- **Documentación:** la spec 0454 con decisión, alternativas, validación, gobernanza y riesgos; el índice regenerado con `docs:index`; y una nota en `docs/runbooks/codex-engineering.md` («Validación y producción»).
- **Criterios de aceptación de la spec:** los siete, con evidencia abajo.

## VALIDACIÓN

Cada entrada indica el contenido sobre el que se midió.

**Pruebas y checks de harness**

- PASÓ: `corepack pnpm install --frozen-lockfile` en 46.8 s, con Node 24.20.0 y pnpm 12.3.4. Lockfile intacto.
- PASÓ, sobre `4d6dac1a`:
  - `node --test scripts/tests/verify-watchdog.node.mjs`: 14/14 en 25.5 s.
  - `verify-critical-coverage`: 7/7.
  - `corepack pnpm harness:test`: 8 archivos descubiertos, 48/48, en 42.5 s.
  - ESLint sobre los siete archivos JS tocados, más `node --check` de los módulos.
  - `docs:index` (418 specs), `docs:check`, `sdd:check` (solo aparecen los choques históricos exentos) y `git diff --check`.
  - Con configuración inválida el gate sale 1 antes de correr pasos: `VERIFY_E2E_IDLE_MIN=abc` y `VERIFY_E2E_TIMEOUT_MIN=0` imprimen `[FAIL] verify-watchdog: … inválido`.
- PASÓ, sobre `9c9aaebb`: watchdog y critical-coverage 21/21 en 36.5 s, ESLint y `git diff --check`.
- PASÓ, después del merge de `origin/main` en la rama (`a96e0a2b`): `docs:check` (423 specs), `sdd:check` y `corepack pnpm harness:test` 48/48 en 21 s. El merge solo trae cambios de producto y DB ajenos, y no toca el harness. La corrida completa de `verify` sigue siendo la de `9c9aaebb`; la revalidación completa de la combinación corresponde al Director antes de integrar.

**Validación con el e2e real y límite total de 4 min.** Usé drivers fuera de Git con el argv real del e2e.

- PASÓ, v1 sobre `4d6dac1a`, con `runStep`:
  - Playwright arrancó `next dev` en el puerto 3325 («Running 186 tests using 8 workers») y dio 27 resultados `ok` y 10 fallos por falta de Supabase en `proxy.ts:67`. La salida del webServer goteaba sin parar, justo el caso que solo ataja el límite total.
  - A los 4 min salieron estas líneas:
    - `[AVISO] e2e: COLGADO/TIMEOUT: superó el límite total del paso, 4 min (VERIFY_E2E_TIMEOUT_MIN) → el watchdog termina sólo el árbol de procesos de este paso`
    - `[AVISO] watchdog: raíz PID 24660; 44 proceso(s) del árbol propio terminados (chrome-headless-shell.exe×32, node.exe×11, cmd.exe×1); sobrevivientes: 0.`
    - `[FAIL] e2e — COLGADO/TIMEOUT: …`, con `attempts: 1`, en 249 s.
  - Después, `:3325` quedó sin listener. El conteo independiente «procesos con la ruta del worktree: 0» de ese driver NO vale como evidencia: usaba `` `t `` dentro de comillas simples de PowerShell, que no se interpreta, así que el filtro nunca encontraba nada. De la v1 valen el informe del watchdog (su foto usa `|` y está probada) y el `netstat`.
- PASÓ con un hallazgo, v2 sobre `4d6dac1a`. El driver fotografía por parentesco en el instante del timeout, que se avisa antes del corte.
  - El primer intento del driver falló por ese mismo bug de comillas. El `try/catch` de `onTimeout` en `runWatched` contuvo la excepción y el corte siguió igual: 44 procesos, 0 sobrevivientes.
  - Con el driver corregido, al timeout colgaban del paso 51 procesos. El watchdog cortó 57 (chrome×45, node×11, cmd×1) con «sobrevivientes: 0», y `:3325` quedó libre.
  - La foto independiente encontró 13 `chrome-headless-shell` todavía listados unos 40 s después, con el mismo PID y la misma hora de creación. A las 12:18:54Z solo quedaba uno, con `handles=0` y un hilo, y desapareció en la consulta siguiente. Eran procesos ya terminados que Windows seguía cerrando, lo mismo que L08 vio con su `taskkill`.
  - «Sobrevivientes: 0» era correcto, pero engañaba a quien mirara la lista de procesos. Por eso `9c9aaebb` los informa aparte, como «aún en cierre del sistema, ya no corren».
- PASÓ, v3 con el `verify-watchdog.mjs` de `9c9aaebb`, usando `runWatched` + `killProcessTree` (lo mismo que llama `runStep`) y registrando el informe exacto del corte.
  - Había 35 testigos ajenos activos: procesos `node` de otros worktrees con verify, `next dev`, Playwright y Vitest.
  - Al timeout colgaban 44 descendientes, y el watchdog cortó esos 44 (chrome×32, node×11, cmd×1).
  - **Ningún testigo ajeno quedó dentro del corte**, cruzando PID y hora de creación contra la lista exacta. **Ninguno de los 44 descendientes quedó fuera del corte.**
  - Después del corte no quedó nada listado (desapareció todo en ~1 s) y `:3325` quedó sin listener. 33 de los 35 testigos terminaron solos durante esos ~5 min; ninguno estuvo en el corte.

**FALLÓ (exit 1): `corepack pnpm verify` completo con los límites por defecto**

Corrió sobre `9c9aaebb`, de 2026-09-11T12:28:10Z a 13:18:12Z (50 min). En el árbol solo había, sin rastrear, este handoff. No es un cierre verde, pero es la evidencia principal de la tarea: reprodujo el cuelgue real y el watchdog lo resolvió.

- PASÓ:
  - harness: 33/33 en sus cinco archivos, incluidas las 14 pruebas nuevas;
  - lint: 0 errores y 8 advertencias preexistentes en archivos que no toqué;
  - rsc-boundary (1597 módulos), typecheck y edge-functions (4);
  - test: 526 archivos y 6684 tests;
  - docs:check (418 specs) y numbering (418 specs · 422 migraciones);
  - feature-constants (5), components:check y governance:check;
  - pending-migration-symbols (0 ROJO · 0 AMARILLO) y sql-tests;
  - schema-rebuild: 404 migraciones aplicadas desde cero.
- NO DISPONIBLE: `migrations-applied`, SKIP por falta de `NEXT_PUBLIC_SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY`. No se consultó producción ni se copiaron secretos.
- **FALLÓ: e2e, COLGADO/TIMEOUT**, con un dev server propio en `:3325`. Es el mismo patrón de L21:
  - Intento 1: 150 passed, 15 failed, 3 flaky y 18 skipped en 13.5 min, con `Error: worker-49 process did not exit within 300000ms after stop, force-killed it`. Los 15 fallos son los de auth y global-search por falta de Supabase, un límite conocido. El proceso terminó solo y el watchdog **no intervino**: esa es la corrida normal bajo watchdog. Siguió el camino de siempre: el absolvedor no absolvió (hubo fallos) y vino el reintento 1/1.
  - Intento 2: 51 resultados `ok`, y luego silencio. Lo último que escribió fue una traza del webServer por Supabase. Al cumplirse 10 min sin salida:
    - `[AVISO] e2e: COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN) → el watchdog termina sólo el árbol de procesos de este paso`
    - `[AVISO] watchdog: raíz PID 43060; 25 proceso(s) del árbol propio terminados (chrome-headless-shell.exe×15, node.exe×9, cmd.exe×1); sobrevivientes: 0; 6 aún en cierre del sistema, ya no corren.`
    - `[FAIL] e2e — COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)`
- **PASÓ: build**, que ahora sí se alcanzó: compiló en 35.5 s y corrió el postbuild Norte. En L08 y L21 había quedado NO EJECUTADO.
- Resumen del gate:
  - `16 de 17 pasos corrieron de verdad`
  - `omitido: migrations-applied`
  - `[FAIL] verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.`
- Comprobación posterior, a las 13:20:10Z: ningún proceso con la ruta del worktree (solo la propia consulta de PowerShell), ningún listener de este worktree en 3100–3799 y nada en `:3325`.

**Lo que no se ejecutó**

- NO EJECUTADO: una segunda corrida completa de `verify` con `VERIFY_E2E_TIMEOUT_MIN` corto. La había planeado para ver el veredicto del gate con un cuelgue. Dejó de hacer falta: la corrida normal reprodujo un cuelgue real y recorrió ese mismo camino, del FAIL con motivo hasta build y el veredicto con exit 1. El límite total con el e2e real quedó validado con v1–v3 (v1 y v2 a través de `runStep`) y en las pruebas unitarias.
- NO DISPONIBLE en local: correr las pruebas nuevas en Linux. No hay una imagen de Node local en Docker y WSL solo tiene `docker-desktop`. Descargar una imagen requiere autorización. Las corre la CI de la PR.
- CI remota «Calidad continua / Calidad local sin secretos» (ubuntu-24.04, incluye `pnpm harness:test`): se dispara con cada push de la rama. El resultado del SHA final se consulta en la PR #89; este documento no atribuye un verde que no se vio.
- NO EJECUTADO, porque no aplica:
  - `/ui-check`: no hay UI.
  - `revisar-datos-ve`: el inventario de procesos solo lee PID, PPID, hora de creación y nombre de ejecutable, y no persiste nada.
  - E2E autenticado: sin configuración de Supabase, lo mismo que en el resto de los worktrees.

Logs fuera de Git, en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-awesome-kapitsa-269943/ac340725-a53a-4085-a937-d4f3007c4d04/scratchpad/verify-e2e-watchdog/`:

- `install.*`, `harness-test.log` y `harness-test-postmerge.log`;
- `real-e2e-watchdog*.log` y `real-e2e-watchdog*.mjs` (drivers v1, v2 y v3);
- `verify-normal.{log,plain.log,sha,start,end,exit,status}`;
- `sdd-check.log` y `pr-body.md`.

## COMMITS

- `e36329b8` — `chore(sdd): reserva SDD-0454 — verify-e2e-watchdog`, el stub que generó `next-number --reserve`. Entró por fast-forward.
- `ff576bae` — `docs(harness): SDD-0454 — especificar el watchdog del e2e de verify`: spec e índice.
- `4d6dac1a` — `chore(harness): SDD-0454 — watchdog del paso e2e de verify`: los cinco scripts, las dos pruebas y la nota del runbook.
- `9c9aaebb` — `chore(harness): SDD-0454 — distinguir procesos en cierre de sobrevivientes`: `closing` en el informe del corte, sus pruebas y la nota en la spec. Salió del hallazgo de la validación v2.
- `ffcd5220` — `docs(harness): SDD-0454 — cierre del Worker con validación del watchdog`: spec en `done` con su validación, índice y la primera versión de este handoff.
- `a96e0a2b` — merge de `origin/main` `bbc7493f` en la rama. Solo coincidía el índice generado, que quedó regenerado.
- El commit que contiene esta versión del documento: registra la PR #89 y el merge. No se crea un commit recursivo para registrar su propio hash; el SHA final está en la PR.

## PR / BRANCH

[PR #89 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/89): base `main`, rama `codex/verify-e2e-watchdog`, worktree el indicado arriba.

- Se publicó con push explícito de la rama a sí misma (`git push -u origin codex/verify-e2e-watchdog:codex/verify-e2e-watchdog`), con autorización de Sam del 2026-09-11.
- El head al crearla era `a96e0a2b`.
- No se mergeó ni se desplegó a mano. El push puede disparar el preview automático de Vercel de la rama, que no es producción.

## PENDIENTES DE ESTA TAREA

- Comprobar por SHA que la CI «Calidad local sin secretos» de la PR #89 pasa, en particular `pnpm harness:test` en ubuntu. Es la primera ejecución en Linux de las pruebas con procesos reales (`ps`, `/proc`). Si falla, se corrige en esta misma rama.

No queda nada más pendiente para la aceptación de la spec. La revisión y la integración son del Director.

## FUERA DE ALCANCE DETECTADO

1. **SDD-0329 figura `done`, pero su código no está en main.** La spec «Aislar la caché de Next usada por el gate E2E» decide que el e2e use `.next-verify-e2e` con un wrapper que limpia antes y después. En main, `.next-verify-e2e` solo aparece en la spec: no hay wrapper, y `verify.mjs` no pasa `VERIFY_DIST_DIR` al e2e. Quizá vive en la PR #21; no lo verifiqué.
2. **Los demás pasos siguen sin límite.** `sql-tests`, `schema-rebuild` y `build` podrían colgarse igual que el e2e; no se ha observado. El runner ya admite `watchdog` por paso, pero aplicarlo exige decidir sus límites en otra spec.
3. **La causa del cuelgue del e2e sigue sin conocerse.** El `verify` de esta tarea la reprodujo con el patrón de L21: la pasada 1 cierra con `worker-49` forzado a los 300 s, y el reintento enmudece después de 51 resultados, con una traza del webServer por Supabase como última salida. L08 anotó que un worker creado segundos antes del silencio no tenía navegador hijo y que el silencio empieza en mobile-safari. Esta tarea solo acota la espera; no investiga Playwright ni WebKit en Windows.
4. **La cabecera de `verify.mjs` está desactualizada.** «Corre, en orden: lint → … → e2e» omite `harness`, `feature-constants`, `pending-migration-symbols` y `build`. Es un comentario histórico que no toqué para no mezclar cambios.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR #89 por SHA y comprobar su CI.
- **Qué revisar:** el diff frente a main.
  - `verify-runner.mjs` extrae la ejecución de un paso sin cambiar la de los pasos sin watchdog, que siguen con `spawnSync` heredando la terminal. En el `verify` completo, los 15 pasos distintos del e2e dieron lo mismo que en las corridas de otros Workers.
  - El corte va por PID, con la guarda de hora de creación.
  - Un cuelgue no se reintenta.
  - Los defaults son 10 min de inactividad y 60 de total.
- **Contratos compartidos:**
  - `buildVerifyVerdict` acepta ahora `{ name, reason }` además de nombres, y con nombres sale idéntico.
  - `EXIT_SKIPPED` pasó a `verify-runner.mjs`. Antes era una constante local no exportada de `verify.mjs`, así que no hay consumidores externos.
  - No toca `playwright.config.ts`, retries, workers ni timeouts de Playwright.
- **Integración:** la rama ya incluye main hasta `bbc7493f`.
  - Si main vuelve a avanzar, hay que hacer merge de origin/main en esta rama y repetir `harness:test` y `docs:check`. `docs/specs/README.md` usa el merge driver `dtd-generated-records`; conviene regenerarlo con `docs:index`, también si choca con la spec 0453 de otra sesión.
  - Integrar el cambio no despliega producto; es tooling del gate.
- **Efecto en los otros Workers:** con esto integrado, sus próximos `verify` ya no esperan indefinidamente. Si el e2e calla 10 min, falla con COLGADO/TIMEOUT, corta solo su árbol y sigue con `build`. Pueden citar la línea `watchdog:` en vez de hacer el `taskkill` manual.
- **Ownership y procesos:**
  - No quedan procesos propios (comprobado a las 13:20:10Z) y ninguna otra sesión depende de este worktree.
  - El claim se libera después del commit y push de esta versión, con `node scripts/harness-worktree.mjs release --owner verify-e2e-watchdog-claude-20260911`.
  - No se borran la rama ni el worktree. La reserva local 0454 (ref y lock) se conserva, y el número no se reutiliza.
