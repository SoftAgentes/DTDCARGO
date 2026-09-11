# Handoff — watchdog del paso e2e de `verify`

Fecha: 2026-09-11. Task ID: `verify-e2e-watchdog`.
Owner / sesión escritora: `verify-e2e-watchdog-claude-20260911` (Worker Claude Code, sesión `awesome-kapitsa-269943-82`). No hubo subagentes. Al principio no había un Director identificable para esta tarea, así que seguí el procedimiento SDD del runbook. Después, el Director (sesión `dtdcargo-5f`) revisó la PR y pidió los cambios que se registran abajo.

Estado: lista-para-revision.
- La [PR #89](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/89) sigue en borrador contra main, publicada con autorización de Sam.
- La ronda de revisión del Director está aplicada en `f598f8c7`, y main `4eedeb8a` está integrado en `730e41d1`.
- La CI de GitHub Actions está bloqueada por la facturación: los pushes de esta ronda no corren CI hasta que Sam lo resuelva, y el Director relanza los runs.
- No está integrada.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/verify-e2e-watchdog`, creado con `node scripts/harness-worktree.mjs start verify-e2e-watchdog` después de `git fetch origin`.
  - `guard` y `claim --owner verify-e2e-watchdog-claude-20260911` PASARON sobre el árbol limpio.
  - `guard --owner` se revalidó antes de cada commit y de cada push.
  - El claim se tomó de nuevo para publicar y para esta ronda, y se liberó al cerrar cada una.
- **Rama:** `codex/verify-e2e-watchdog`, con upstream `origin/codex/verify-e2e-watchdog`.
  - Nació en `07d00097` y avanzó con fast-forward al commit de reserva `e36329b8`, cuyo padre es `50100cc4`. Entre `07d00097` y `50100cc4` no cambiaron `package.json` ni el lockfile.
  - Integré main en la rama dos veces, siempre con merge y sin rebase:
    - `bbc7493f` (L20, L15, L08, L11 y registro de 0409) en `a96e0a2b`;
    - `4eedeb8a` (L22 / SDD-0402 y 0418 aplicada) en `730e41d1`.
  - En ambos casos el único archivo en común era el índice generado `docs/specs/README.md`. Lo resolvió el merge driver `dtd-generated-records` y lo regeneré con `docs:index`. Ahora dice «424 specs», tiene las filas 0402 y 0454, y 0402 ya no figura entre los huecos, que terminan en 0453. Un merge textual de GitHub habría dejado «423» sin avisar.
- **SDD:** `docs/specs/0454-verify-e2e-watchdog/spec.md`, en `done`. La PR y el merge se registran aparte.
  - La reservé con `node scripts/next-number.mjs --reserve verify-e2e-watchdog`, que creó la ref local `codex/sdd-reserve-0454-verify-e2e-watchdog` y el lock `refs/dtd/reservations/0454`.
  - El inventario previo daba 0453 como libre, pero otra sesión la reservó antes; la reserva atómica me asignó 0454 sin choque.
  - La ref de reserva no se publicó aparte. La PR #89 contiene la spec, así que el número ya es visible para otras máquinas.

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
  - Las esperas usan el reloj monotónico.
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

    La limpieza nunca manda señales a PIDs que el watchdog ya cortó, porque podrían estar reciclados. El proceso ajeno se termina por su handle, y los fixtures que no terminan solos tienen un tope de vida de 2 min.
  - `scripts/tests/verify-critical-coverage.node.mjs`: veredicto con motivo, mezcla con fallo común y crítico sin medir, y rechazo de un motivo vacío o de un paso desconocido.
- **Documentación:** la spec 0454 con decisión, alternativas, validación, gobernanza y riesgos; el índice regenerado con `docs:index`; y una nota en `docs/runbooks/codex-engineering.md` («Validación y producción»).
- **Criterios de aceptación de la spec:** los ocho, con evidencia abajo. El criterio 7 se separó en dos para no citar como PASÓ un `verify` que salió FALLÓ.

## REVISIÓN DEL DIRECTOR

Comentario del 2026-09-11 18:53Z sobre el head `3028e2dc`: CAMBIOS REQUERIDOS (menores).

**Requeridos**

1. La limpieza de la prueba mandaba `SIGKILL` a PIDs ya muertos, que en Windows se reciclan.
   - Corregido en `f598f8c7`: la limpieza solo toca lo que el watchdog no cortó o dejó vivo (`r.kill.targets` / `r.kill.survivors`).
   - El proceso ajeno se termina por su handle.
   - Los fixtures que no terminan solos tienen un tope de vida de 2 min, así que un fallo del watchdog no deja nada colgado.
2. La frase «no despliega producto» era falsa. Integrar a main **sí dispara el deploy de producción en Vercel**: el `ignoreCommand` de `vercel.json` excluye solo `docs/**` y el Markdown de la raíz, no `scripts/**` ni `.agents/**`. Lo corregí en la spec (Alcance), en este handoff y en el cuerpo de la PR.
3. Actualizar con main: merge sin rebase en `730e41d1`, con `docs:index` en 424 specs, filas 0402 y 0454, y huecos sin 0402 que terminan en 0453.
4. Registrar la evidencia:
   - La CI de `3028e2dc` PASÓ, con `harness:test` 48/48 en ubuntu.
   - El criterio 7 quedó separado: `harness:test` PASÓ; el `verify` completo salió FALLÓ y así se dice.

**No bloqueaban, y quedaron atendidos**

- La identidad de proceso solo se confirma en Windows (`created` es null en POSIX): anotado en Riesgos.
- La ventana residual de reciclaje de PID: anotada en Riesgos.
- `Date.now()` convivía con el reloj monotónico: la espera del corte ya usa `monotonicNow()`.
- El choque futuro con la PR #21 en `scripts/verify.mjs`: anotado en FUERA DE ALCANCE.

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
- PASÓ, después del primer merge de main (`a96e0a2b`): `docs:check` (423 specs), `sdd:check` y `harness:test` 48/48.
- PASÓ: la CI «Calidad continua / Calidad local sin secretos» sobre `3028e2dc` ([run 34631252080](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34631252080)). Pasaron todos los pasos, con `pnpm harness:test` en «Harness discovery: 8 test files · tests 48 · pass 48 · fail 0» en ubuntu-24.04. Fue la primera ejecución en Linux de las pruebas con procesos reales. En la PR, los 3 checks quedaron en verde; los dos de Vercel son el preview de la rama.
- PASÓ, en la ronda de revisión:
  - sobre `f598f8c7`: watchdog y critical-coverage 21/21 en 22 s, ESLint y `git diff --check`;
  - después del merge `730e41d1`: `docs:check` (424 specs), `sdd:check` y `harness:test` 48/48 en 88 s.

**Validación con el e2e real y límite total de 4 min.** Usé drivers fuera de Git con el argv real del e2e.

- PASÓ, v1 sobre `4d6dac1a`, con `runStep`:
  - Playwright arrancó `next dev` en el puerto 3325 («Running 186 tests using 8 workers»). La salida del webServer goteaba sin parar, justo el caso que solo ataja el límite total.
  - A los 4 min, el watchdog cortó la raíz PID 24660 y 44 procesos (chrome×32, node×11, cmd×1), con 0 sobrevivientes. El paso quedó `[FAIL] e2e — COLGADO/TIMEOUT: …`, con `attempts: 1`, en 249 s, y `:3325` quedó sin listener.
  - El conteo independiente por línea de comandos de ese driver NO vale como evidencia: usaba `` `t `` dentro de comillas simples de PowerShell, que no se interpreta.
- PASÓ con un hallazgo, v2 sobre `4d6dac1a`. El driver fotografía por parentesco en el instante del timeout.
  - Un primer intento del driver falló por ese mismo bug de comillas. El `try/catch` de `onTimeout` contuvo la excepción y el corte siguió igual.
  - Con el driver corregido, al timeout colgaban 51 procesos. El watchdog cortó 57 con «sobrevivientes: 0».
  - La foto independiente encontró 13 `chrome-headless-shell` todavía listados unos 40 s después. A las 12:18:54Z quedaba uno, con `handles=0` y un hilo, y desapareció enseguida. Eran procesos ya terminados que Windows seguía cerrando.
  - Por eso `9c9aaebb` los informa aparte, como «aún en cierre del sistema, ya no corren».
- PASÓ, v3 con el `verify-watchdog.mjs` de `9c9aaebb`, usando `runWatched` + `killProcessTree` y registrando el informe exacto del corte.
  - Había 35 testigos ajenos activos, de otros worktrees.
  - Al timeout colgaban 44 descendientes, y el watchdog cortó esos 44.
  - **Ningún testigo ajeno quedó dentro del corte**, cruzando PID y hora de creación. **Ninguno de los 44 descendientes quedó fuera.**
  - Después del corte no quedó nada listado (~1 s) y `:3325` quedó libre.

**FALLÓ (exit 1): `corepack pnpm verify` completo con los límites por defecto**

Corrió sobre `9c9aaebb`, de 2026-09-11T12:28:10Z a 13:18:12Z (50 min). No es un cierre verde, y en este entorno sin Supabase no podía serlo. Reprodujo el cuelgue real y el watchdog lo resolvió.

- PASÓ:
  - harness: 33/33 en sus cinco archivos;
  - lint: 0 errores y 8 advertencias preexistentes;
  - rsc-boundary (1597 módulos), typecheck y edge-functions (4);
  - test: 526 archivos y 6684 tests;
  - docs:check (418) y numbering;
  - feature-constants (5), components:check y governance:check;
  - pending-migration-symbols (0/0) y sql-tests;
  - schema-rebuild: 404 migraciones desde cero.
- NO DISPONIBLE: `migrations-applied`, SKIP por falta de credenciales. No se consultó producción.
- **FALLÓ: e2e, COLGADO/TIMEOUT**, con el patrón de L21:
  - Intento 1: 150 passed, 15 failed (auth y global-search, por falta de Supabase), 3 flaky y 18 skipped en 13.5 min, con `worker-49` forzado a los 300 s. Terminó solo y el watchdog **no intervino**; vino el reintento 1/1, como siempre.
  - Intento 2: 51 resultados `ok` y luego silencio. A los 10 min, el watchdog cortó la raíz PID 43060 y 25 procesos (chrome×15, node×9, cmd×1), con 0 sobrevivientes y 6 aún en cierre. El paso quedó `[FAIL] e2e — COLGADO/TIMEOUT: sin salida durante 10 min; …`.
- **PASÓ: build**, que se alcanzó por fin: en L08 y L21 había quedado NO EJECUTADO.
- Línea final: `[FAIL] verify: 1 fallo(s) → e2e [COLGADO/TIMEOUT: sin salida durante 10 min; límite de inactividad 10 min (VERIFY_E2E_IDLE_MIN)] CIERRE ADEMÁS INCOMPLETO — CRÍTICOS SIN MEDIR: migrations-applied.`
- Comprobación posterior, a las 13:20:10Z: ningún proceso ni listener de este worktree.

**Lo que no se ejecutó**

- NO EJECUTADO: una segunda corrida completa de `verify` con timeout forzado. La corrida normal reprodujo un cuelgue real y recorrió ese mismo camino. El límite total con el e2e real quedó validado con v1–v3 y en las pruebas unitarias.
- NO EJECUTADO: la CI de los commits de esta ronda (`f598f8c7`, `730e41d1` y el que contiene este documento). GitHub Actions está bloqueado por la facturación hasta que Sam lo resuelva, y el Director relanza los runs.
- NO EJECUTADO, porque no aplica: `/ui-check` (no hay UI), `revisar-datos-ve` (no hay datos personales) y el E2E autenticado (sin Supabase).

Los logs están fuera de Git, en `C:/Users/AKXGEN~1/AppData/Local/Temp/claude/C--Users-AKX-generator-Desktop-Developer-DTDCARGO--claude-worktrees-awesome-kapitsa-269943/ac340725-a53a-4085-a937-d4f3007c4d04/scratchpad/verify-e2e-watchdog/`:

- `verify-normal.*`;
- `real-e2e-watchdog*.{log,mjs}`;
- `harness-test*.log`;
- `pr-body.md`.

## COMMITS

- `e36329b8` — `chore(sdd): reserva SDD-0454 — verify-e2e-watchdog`, el stub que generó `next-number --reserve`.
- `ff576bae` — `docs(harness): SDD-0454 — especificar el watchdog del e2e de verify`.
- `4d6dac1a` — `chore(harness): SDD-0454 — watchdog del paso e2e de verify`: los scripts, las pruebas y la nota del runbook.
- `9c9aaebb` — `chore(harness): SDD-0454 — distinguir procesos en cierre de sobrevivientes`.
- `ffcd5220` — `docs(harness): SDD-0454 — cierre del Worker con validación del watchdog`.
- `a96e0a2b` — primer merge de `origin/main` `bbc7493f`.
- `3028e2dc` — `docs(harness): SDD-0454 — registrar PR #89 y merge de main en el handoff`. Su CI PASÓ.
- `f598f8c7` — `chore(harness): SDD-0454 — aplicar revisión del Director a la PR #89`: la limpieza de pruebas, el reloj monotónico y las correcciones de la spec.
- `730e41d1` — segundo merge de `origin/main` `4eedeb8a`, con el índice en 424.
- El commit que contiene esta versión del documento: registra la ronda de revisión. El SHA final está en la PR y en el aviso al Director.

## PR / BRANCH

[PR #89 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/89): base `main`, rama `codex/verify-e2e-watchdog`, worktree el indicado arriba.

- Se publicó con push explícito de la rama a sí misma, con autorización de Sam del 2026-09-11. Los pushes posteriores fueron sin force.
- El cuerpo de la PR se actualizó con `gh pr edit` para corregir lo del deploy y registrar la CI y esta ronda.
- No se pasó a ready, no se mergeó ni se desplegó a mano.

## PENDIENTES DE ESTA TAREA

- Que el Director relance la CI del head nuevo cuando se desbloquee GitHub Actions, y que confirme la revisión.

No queda trabajo de implementación pendiente.

## FUERA DE ALCANCE DETECTADO

1. **SDD-0329 figura `done`, pero su wrapper `.next-verify-e2e` no existe en main.** En main solo aparece en la spec, y `verify.mjs` no pasa `VERIFY_DIST_DIR` al e2e. Quizá vive en la PR #21; no lo verifiqué.
2. **Los demás pasos siguen sin límite.** `sql-tests`, `schema-rebuild` y `build` podrían colgarse; no se ha observado. El runner ya admite `watchdog` por paso, pero sus límites exigen otra spec.
3. **La causa del cuelgue del e2e sigue sin conocerse.** El patrón de L21 se reprodujo: la pasada 1 cierra con `worker-49` forzado a los 300 s, y el reintento enmudece después de 51 resultados. L08 lo asocia a mobile-safari. Esta tarea solo acota la espera.
4. **La cabecera de `verify.mjs`** («Corre, en orden: lint → … → e2e») omite pasos. No la toqué.
5. **La PR #21 chocará con esta en `scripts/verify.mjs`** (nota del Director). Al integrarla hay que combinar el runner extraído con sus cambios, sin elegir una versión completa del archivo.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar el head nuevo de la PR #89 y relanzar su CI cuando Actions se desbloquee. La PR sigue en borrador.
- **Contratos compartidos:**
  - `buildVerifyVerdict` acepta ahora `{ name, reason }` además de nombres, y con nombres sale idéntico.
  - `EXIT_SKIPPED` pasó a `verify-runner.mjs`; no tiene consumidores externos.
  - No toca `playwright.config.ts`.
- **Integración y producción:** integrar a main **sí dispara el deploy de producción en Vercel**, porque el `ignoreCommand` no excluye `scripts/**` ni `.agents/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy, según el runbook.
  - Si main vuelve a avanzar: merge en esta rama sin rebase, `docs:index` y repetir `harness:test` y `docs:check`.
- **Efecto en los otros Workers:** con esto integrado, un e2e que calla 10 min falla con COLGADO/TIMEOUT, corta solo su árbol y el gate sigue con `build`, sin `taskkill` manual.
- **Ownership:** el claim se libera después del push de esta versión, con `node scripts/harness-worktree.mjs release --owner verify-e2e-watchdog-claude-20260911`. No quedan procesos propios. La rama, el worktree y la reserva local 0454 se conservan.
