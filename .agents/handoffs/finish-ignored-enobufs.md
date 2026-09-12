# Handoff — ENOBUFS en el harness: `finish` y el hook `Stop` de `verify`

Fecha: 2026-09-11. Task ID: `finish-ignored-enobufs`.
Owner / sesión escritora: `finish-ignored-enobufs-claude-20260911` (Worker Claude Code, worktree `admiring-pascal-832793`). No hubo subagentes.

Estado: **integrada**.

- La [PR #94](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/94) se fusionó a `main` el 2026-09-11 en el commit de merge `664bb4b2`, con el head `902620f8` y su CI en verde (run 34669415893: «Calidad local sin secretos» SUCCESS, `harness:test` 12 archivos y 81/81 en ubuntu).
- La integró el Director (`dtdcargo-4d`), que verificó antes que main fuera ancestro del head, los cuatro checks en verde, MERGEABLE/CLEAN, que nada saliera de `scripts/ docs/specs/ .agents/` y que `docs/specs/README.md` solo cambiara lo esperado (428 → 429 specs y la fila de 0457). La autorización de merge, con su deploy de Vercel, la dio Sam al pedir llevar lo pendiente a producción ese día.
- Verificado por el Worker de forma independiente antes de escribir esto: `902620f8` es ancestro de `origin/main` y `664bb4b2` es el merge de la #94.
- Esta línea se corrige **después** del merge, en su propia rama y PR: las secciones de abajo conservan la redacción del momento en que se escribieron, que es evidencia fechada.

## RONDA 2 — LA CI EN LINUX DESTAPÓ UN DEFECTO DEL ARREGLO

El Director (`dtdcargo-4d`) rechazó integrar el head `33e0e573`: la CI estaba en ROJO en Linux con dos pruebas mías caídas, igual en las cinco corridas de la rama (run 34666711465). Medí las dos con Node 24 real dentro de `node:24` antes de tocar nada, y una de ellas **no era un problema de la prueba sino de mi arreglo**.

**1. `runGit` devolvía éxito ante un desbordamiento.** Medido, provocando ENOBUFS 60 veces en Linux:

| | `r.error.code` | `r.status` |
| --- | --- | --- |
| Windows | ENOBUFS siempre | `null` con SIGTERM |
| Linux | ENOBUFS siempre | **0 en 51 de 60 corridas** |

En Linux git alcanza a salir con 0 antes de que el padre lo corte. Mi helper hacía `code: r.status ?? 1`, así que devolvía **`{ code: 0, out: "" }`**: un desbordamiento leído como éxito con salida vacía. Con eso, `finish` habría informado **`hasIgnoredFiles: false`** en un worktree lleno de ignorados, y `check-unpublished` habría vuelto a imprimir `[OK]` sin listar una rama. Es decir, el arreglo reintroducía en Linux la misma clase de mentira que esta tarea eliminó.

- Corregido: en `normalizeGitResult` **el error manda sobre el status** (`code: r.status || 1`).
- La función se extrajo pura y exportada para fijar el caso por prueba sin depender de la carrera. Importa: con el mutante puesto, la prueba pura falla siempre, mientras que la de integración pasó por suerte en una corrida donde el `status` cayó del lado `null`.
- El hook ya estaba bien por mirar `error` primero, pero ahora su prueba fija el caso `status: 0` + ENOBUFS como SIN MEDIR.

**2. La cola del gate perdía la última línea, y era mi fixture.** En Linux las escrituras a un pipe son asíncronas y `process.exit()` descarta lo pendiente: medido, de 3.145.751 bytes llegaban **146.176**. En Windows nunca se notó porque ahí son síncronas. El hook y su `slice(-1800)` estaban bien; el fixture ahora usa `process.exitCode`.

**Verificación en la plataforma que fallaba.** `node scripts/tests/run-harness.mjs` dentro de `node:24`, sobre un repo git real armado en el contenedor: **81/81**. Los primeros intentos daban tres fallos que eran artefacto de mi contenedor —monté el worktree, cuyo `.git` es un archivo que apunta a una ruta de Windows, y git devolvía 128—, no del código.

También se hizo el merge de `origin/main` `6c282b44` que pidió el Director, con el override del driver de main; tras regenerar, `docs/specs/README.md` quedó idéntico a lo que produce el script (429 specs).

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/admiring-pascal-832793`.
  Es un worktree enlazado que la sesión ya recibió aislado, no el checkout principal y no `main`, así que **no** se creó otro con `harness-worktree.mjs start`: crear uno anidado habría duplicado el aislamiento que ya existía. `guard` PASÓ y el claim se tomó antes de editar; se revalidó `guard --owner` antes del commit.
- **Rama:** `claude/stoic-thompson-6ef73b`, nacida en `543bbe0a`, que ya contiene el `origin/main` en caché. No se integró main durante la tarea porque no avanzó.
- **SDD:** `docs/specs/0457-harness-spawn-enobufs/spec.md`, en `done`. La primera versión de este handoff decía «ninguno», porque el encargo no asignó ID y el runbook reserva la asignación al Director; Sam la autorizó después («mueve la reserva SDD»).
  - Reservada con `corepack pnpm sdd:next --reserve harness-spawn-enobufs`, que creó `refs/dtd/reservations/0457` y `refs/heads/codex/sdd-reserve-0457-harness-spawn-enobufs` sobre `origin/main`, sin tocar HEAD.
  - El inventario previo dio 0457 libre sobre 203 refs y worktrees. Las advertencias de colisión que imprime son históricas y de la PR #21, ajenas a esta tarea.
  - El stub se movió a la rama con `git cherry-pick` (`6cc31857`); la rama de reserva y su lock quedan intactos y **sin publicar**: la PR lleva la spec, así que el número ya es visible.
  - Índice regenerado con `docs:index`: 428 specs, con la fila 0457.

## OBJETIVO ORIGINAL

`node scripts/harness-worktree.mjs finish <slug>` fallaba con «git ls-files falló.» en cualquier worktree con `node_modules` instalado. Reproducido el 2026-09-11 en `DTD-worktrees/aliado-tenant-coherence`.

Encargo: listar ignorados de forma compacta conservando `hasIgnoredFiles` y la marca de archivos sensibles `.env*` sin imprimir contenido; dar búfer generoso al helper `git()` sin ocultar errores; pruebas en `scripts/tests/*.node.mjs`; `finish` sigue siendo solo informe; validar `harness:test`, `docs:check`, `sdd:check` y `git diff --check`.

**Ampliación pedida por Sam durante la sesión:** «arregla también el hook de verify», por el hallazgo que esta misma tarea había levantado en `scripts/harness-verify-hook.mjs`. Entró al alcance, a la misma rama y la misma PR.

## CAUSA RAÍZ, CONFIRMADA EN ESTA SESIÓN

Medido sobre `DTD-worktrees/c-l01-portal-marca`, que reproduce el defecto igual que el worktree original:

- `git ls-files --others --ignored --exclude-standard` → **231.105 líneas, 25.157.827 bytes**.
- El mismo listado con `--directory` → **7 líneas**.
- `spawnSync` sin `maxBuffer` corta en 1 MB: devuelve `status: null`, `stdout` vacío y el error solo en `r.error` (`spawnSync git ENOBUFS`). El helper `git()` descartaba `r.error`, así que `mustGit` caía al mensaje genérico «git ls-files falló.» y el Director se quedaba sin informe.
- Antes del arreglo: `node scripts/harness-worktree.mjs finish c-l01-portal-marca` → exit 1, «git ls-files falló.».
- Después: exit 0 en **0,67 s**, con `ignoredEntryCount: 7`.

**El hook `Stop` tenía el mismo defecto, con una consecuencia peor.** `scripts/harness-verify-hook.mjs` capturaba toda la salida de `verify.mjs` con `spawnSync` sin `maxBuffer`. Al pasar de 1 MB, **spawnSync mata al hijo**: el gate se corta a media corrida y, como `r.status` queda `null`, la condición `r.status === 0` fallaba y el hook bloqueaba el cierre anunciando ROJO un gate que nunca terminó — y que podía venir verde.

Reproducido con el hook tal como está en `HEAD`, contra un `verify` falso que escribe 3 MB y sale 0:

- hook original → **exit 2**, «🛑 Harness gate en ROJO», con la cola llena de relleno;
- hook arreglado, mismo fixture → **exit 0**, stderr vacío.

## COMPLETADO

**`scripts/harness-spawn.mjs`** (nuevo, módulo compartido)

Pedido de Sam: «consolida GIT_MAX_BUFFER en un módulo compartido». Se consolidó el helper entero, no solo la constante, porque `runGit` estaba duplicado casi carácter por carácter en `harness-worktree.mjs` y en `check-unpublished.mjs`.

- `MAX_BUFFER` (64 MB) y `runGit(args, cwd = process.cwd(), maxBuffer = MAX_BUFFER)`, que devuelve `{ code, out, err }` y nunca lanza. `err` trae el stderr de git o, si `spawnSync` falló, el motivo real (ENOBUFS, ENOENT…).
- El encabezado explica la causa común de los tres defectos de esta tarea, para que el próximo que toque un `spawnSync` del harness no repita el patrón.
- Sin shebang, por el mismo motivo que `check-unpublished.mjs`: se importa desde pruebas y el `#!` rompe el parser de Vite.
- Consumidores: `harness-worktree.mjs` (importa `runGit` y conserva su alias `const git = runGit`, así sus ~15 llamadas quedan intactas), `harness-verify-hook.mjs` (importa `MAX_BUFFER`; `HOOK_MAX_BUFFER` desaparece) y `check-unpublished.mjs` (importa `runGit`). No quedan copias: `grep GIT_MAX_BUFFER|HOOK_MAX_BUFFER` en `scripts/` no devuelve nada.
- Cada consumidor conserva un comentario corto con **su** motivo y apunta al módulo; el número y el manejo del error viven en un solo lugar.

**`scripts/tests/harness-spawn.node.mjs`** (nuevo, 2 pruebas). Las aserciones del búfer que estaban duplicadas en las pruebas de `harness-worktree` y `check-unpublished` se movieron acá; esas dos quedaron con lo suyo.

- Cota del búfer, corrida normal y desbordamiento forzado (`maxBuffer: 4`) que exige `ENOBUFS` en `err`, el prefijo `git --version:` y `out` vacío.
- Que `runGit` informe el fallo de git **sin lanzar** y que **respete el cwd**: fuera de un repo `rev-parse` falla con el stderr de git, dentro devuelve `true`, y un subcomando inexistente es código ≠ 0 con motivo.
- El cwd se pasa explícito y se deriva de la ubicación del archivo, así la prueba no depende de desde dónde se corra. Lo verifiqué corriéndola desde `%TEMP%`.

**`scripts/harness-worktree.mjs`**

- `ignoredReport(target)` (exportada) sustituye al `ls-files` plano en `finish` y usa `--directory -z`: un directorio ignorado completo se colapsa en una entrada.
- El informe conserva `hasIgnoredFiles` y suma `ignoredEntryCount` (total), `ignoredEntries` (hasta 50 entradas) y `sensitiveIgnoredFiles`.
- Los directorios colapsados se expanden **un nivel** con `readdirSync` para nombrar `.env*` anidados, saltando symlinks y lo que no sea directorio. Se nombran, nunca se abren: el informe no lee ni imprime contenido.
- `isSensitiveIgnoredName` (exportada) marca `.env`, `.env.local`, `.envrc` y demás `.env*`, sin distinguir mayúsculas. No marca `env.local` ni `environment.ts`.
- El helper de git pasó a `harness-spawn.mjs` (ver arriba): búfer de 64 MB y error de spawn nombrado, en vez del mensaje genérico. `const git = runGit` conserva intactas las llamadas del archivo. No se silencia nada: un fallo sigue siendo código ≠ 0.
- La línea final de `finish` explica el inventario compacto, el nivel de expansión y el tope de 50, además de las advertencias que ya tenía.
- **Alcance intacto:** `finish` sigue siendo solo informe. No borra, no poda, no toca el árbol ignorado que acaba de nombrar; la prueba lo verifica contando los ignorados antes y después.

**`scripts/tests/harness-worktree.node.mjs`** (2 pruebas nuevas, 4 en total)

- Los helpers de sandbox (`gitAt`, `cliAt`, `sandboxRepo`) subieron a ámbito de módulo; la prueba existente quedó igual salvo esas tres líneas.
- La tabla de nombres sensibles: marca `.env`, `.env.local`, `.ENV.Production` y `.envrc`; no marca `env.local`, `environment.ts`, `node_modules` ni `readme.md`. (Las aserciones del búfer se mudaron a `harness-spawn.node.mjs`.)
- `finish inventories ignored files compactly…`: worktree con **1.200 archivos ignorados** en 40 paquetes × `dist/chunks` (directorios ignorados anidados), un `.env.local` en la raíz y un `.env.production` dentro de `secrets/`, que `--directory` colapsa. Comprueba: informe vacío antes de ensuciar; `> 1.000` archivos en el listado expandido frente a `≤ 10` entradas informadas; `ignoredEntries` exacto; `sensitiveIgnoredFiles` con **los dos** `.env`, incluido el anidado; que el informe no contiene el contenido secreto, ni rutas del interior del directorio colapsado, ni supera 4.000 caracteres; y que nada se borró.

**`scripts/harness-verify-hook.mjs`**

- El spawn de `verify.mjs` recibe el `MAX_BUFFER` compartido, igual que el `execSync` de `git status` y el spawn de `check-unpublished.mjs`.
- `clasificarGate` (exportada) separa tres casos que antes se aplastaban en uno: **medido y verde** (exit 0) deja cerrar; **medido y rojo** (exit ≠ 0) bloquea con exit 2 y ahora nombra el código; **sin medir** (error de spawn, desbordamiento, señal) **también bloquea con exit 2**, pero con un mensaje que dice «SIN MEDIR» y el motivo, nunca «ROJO». Solo un exit 0 deja cerrar: el rojo bloquea por su veredicto y el sin medir por la ausencia de él.
  - Esta es una **decisión de Sam del 2026-09-11**, tomada sobre la primera versión, que dejaba cerrar el gate sin medir apoyándose en el fail-open del encabezado. Se invirtió a pedido suyo: «que el gate sin medir bloquee igual». El fail-open queda para los errores propios del hook (sin git, stdin raro, el aviso de publicación), que siguen sin trabar nada.
  - La única salida si el gate jamás logra medirse es el anti-loop `stop_hook_active`, que ya existía: el segundo intento de cierre pasa. Está anotado en el encabezado del archivo.
- El cuerpo pasó a `main()` con el guard `import.meta.url === pathToFileURL(process.argv[1]).href`, para poder importar el módulo en pruebas sin ejecutar el hook. El flujo, el orden de los pasos y el anti-loop `stop_hook_active` quedan idénticos.
- Los dos bloqueos comparten el exit 2 y jamás el mensaje: el rojo medido dice `🛑 Harness gate en ROJO (exit N)`; el sin medir, `🛑 Harness gate SIN MEDIR: <motivo>`. Ambos adjuntan la cola de 1800 caracteres — en el caso desbordado, lo que el gate alcanzó a escribir antes de que `spawnSync` lo matara.
- No se tocó `.claude/settings.json`: el hook se registra igual que antes.

**`scripts/tests/harness-verify-hook.node.mjs`** (nuevo, 2 pruebas)

- Unitaria de `clasificarGate`: verde, rojo con código, ENOBUFS (el motivo nombra los 64 MB), spawn no lanzado (ENOENT) y muerte por señal. Los tres casos sin medir bloquean, y se exige que **ningún motivo sin medir contenga la palabra ROJO**.
- Integración con un sandbox propio: repo git de mentira, un cambio en `app/` y un `scripts/verify.mjs` falso. Cubre que sin cambios en código el gate **ni se lanza**, que `stop_hook_active` corta antes, el rojo normal (exit 2 con la cola real), el verde normal, **el verde ruidoso de 3 MB que antes salía exit 2 y ahora sale 0 sin avisos**, el rojo ruidoso que sigue bloqueando con la última línea del gate, **un gate que desborda los 64 MB de verdad** (exit 2 con «SIN MEDIR» y sin «gate en ROJO»), y el `[AVISO]` de rama sin publicar que llega a stderr sin decidir el cierre.
- El desbordamiento real cuesta **354 ms** medidos: `spawnSync` mata al hijo en cuanto cruza el límite, así que la prueba no espera a que escriba los 80 MB.

**`scripts/check-unpublished.mjs`**

Pedido aparte de Sam: «arregla también el helper de check-unpublished». Al abrirlo, el búfer era el problema menor.

- El helper `git()` privado desapareció: ahora importa `runGit` de `harness-spawn.mjs`. Antes descartaba `stderr` y `r.error` por completo, y solo sobrevivían `code` y `out`.
- **El defecto de fondo era un falso verde.** El `code` del listado de ramas **no se miraba**: si `for-each-ref` fallaba, `listado.out` quedaba vacío, `ramas` vacío, `pendientes` vacío y el script imprimía **`[OK] sin trabajo commiteado fuera de origin/main`**. Es decir, justo el check que existe porque SDD-0091 se perdió sin que nadie lo midiera, salía en verde cuando no había medido nada. Ahora un listado fallido sale `[AVISO] … SIN MEDIR` con el motivo.
- **Un conteo que falla ya no cuenta como 0.** `rev-list --count` con error apartaba la rama a `0 commits sin publicar`, indistinguible de una rama al día. Ahora esas ramas van a un bloque `[AVISO] N rama(s) SIN MEDIR contra origin/main` con su motivo.
- El aviso de `origin/main` ausente conserva su texto y ahora agrega el error real de git, en vez de adivinar siempre «¿clone shallow o sin remoto?».
- `main(ejecutar = runGit)` acepta el git inyectado, siguiendo la decisión de diseño que el propio archivo ya documenta para `ramasSinPublicar` («PURA respecto de git… así el test no necesita un repo de verdad»). Es lo que permite probar los caminos en los que git falla.
- **Contrato intacto:** exit 0 siempre, 2 solo por bug del propio check; no pushea, no borra, no falla el gate. Todos los mensajes nuevos usan el prefijo `[AVISO]`, que es lo que el hook `Stop` busca para reenviarlos, así que ahora se ven en el cierre en vez de perderse.

**`scripts/tests/check-unpublished.node.mjs`** (nuevo, 3 pruebas). El script no tenía ninguna, pese a que su encabezado decía «se importa desde su test».

- El contrato de `ramasSinPublicar`: filtra ceros, ordena de más a menos y aguanta la lista vacía. (Las aserciones del búfer se mudaron a `harness-spawn.node.mjs`.)
- Con git inyectado: el único verde posible (todo medido y nada pendiente), el listado fallido, el conteo fallido y la base ausente — los tres **sin `[OK]`** — y el aviso de siempre con su recordatorio de SDD-0091.
- Contra git de verdad, en un sandbox: sin `origin/main` avisa y no sale verde; con todo publicado sale `[OK]`; con una rama de un commit por delante la nombra con su conteo.

## VALIDACIÓN

Sobre `4897bb1d` (parte 1) y el commit del hook (parte 2), con Node 24.20.0, pnpm vía corepack y git 2.55.0.windows.5.

- **PASÓ** — `corepack pnpm harness:test`: **12 archivos descubiertos, 80/80** en 70 s. (9 y 73/73 antes del hook; 10 y 75/75 antes de check-unpublished; 11 y 78/78 antes de consolidar.)
- **PASÓ** — `corepack pnpm docs:check`: índice sincronizado, 427 specs.
- **PASÓ** — `corepack pnpm sdd:check`: sin números repetidos; solo los choques históricos ya exentos.
- **PASÓ** — `git diff --check`: sin hallazgos.
- **PASÓ** — `eslint` sobre los ocho archivos tocados: 0 errores, 0 advertencias.
- **PASÓ** — `node scripts/check-unpublished.mjs` contra el repo real: 18 ramas con trabajo fuera de `origin/main`, mismo formato que antes, exit 0. El exit code se leyó bien esta vez; en la primera corrida quedó tapado por un `tail` en la tubería, y se repitió.
- **PASÓ** — reproducción y arreglo de `finish` sobre un worktree real (`c-l01-portal-marca`, solo lectura): fallaba con exit 1 antes, sale 0 en 0,67 s después, con las 7 entradas esperadas.
- **PASÓ** — reproducción y arreglo del hook, con el archivo tal como está en `HEAD` y un `verify` falso de 3 MB que sale 0: original **exit 2** («ROJO»), arreglado **exit 0** con stderr vacío.
- **PASÓ** — el gate sin medir bloquea y se anuncia bien, con un `verify` falso de 80 MB: **exit 2** y el encabezado literal «🛑 Harness gate SIN MEDIR: el gate se canceló al pasar de 64 MB de salida capturada. No hay veredicto, así que el cierre se bloquea igual…», seguido de la cola de lo capturado.
- **PASÓ (no requerido)** — `corepack pnpm test`: **530 archivos, 6727 tests, exit 0** en 171 s. No hacía falta para un cambio de harness; se corrió para medir salida y de paso confirma que el producto sigue verde.
- **PASÓ** — mutación de las pruebas, sobre copias en scratch, nunca sobre el árbol de trabajo. Cada mutante deja rojo exactamente la prueba que le toca:
  1. quitar `--directory` → cae el informe compacto;
  2. quitar la rama `if (r.error)` → cae el desbordamiento nombrado;
  3. bajar `GIT_MAX_BUFFER` a 1 MB → cae la cota del búfer;
  4. anular la expansión de un nivel → cae el `.env` anidado;
  5. quitar `maxBuffer` del spawn del gate → cae el verde ruidoso del hook;
  6. volver a la clasificación vieja (`r.status === 0` o rojo) → cae la prueba del hook;
  7. devolver `bloquea: false` para el gate sin medir → caen las **dos** pruebas del hook;
  8. devolver el `git()` viejo de check-unpublished (sin búfer ni `err`) → cae su unitaria;
  9. dejar de mirar el `code` del listado → vuelve el falso `[OK]` y cae la prueba;
  10. que un conteo fallido vuelva a contar 0 → cae la misma prueba;
  11. bajar `MAX_BUFFER` del módulo compartido a 1 MB → cae la prueba del búfer;
  12. tapar otra vez el error de spawn en el módulo → cae la misma;
  13. que `runGit` ignore el cwd → cae la prueba del cwd.

  Los mutantes 11 a 13 se corrieron dentro de un repo git de mentira, con una corrida de control en verde: en un scratch sin repo, la prueba del cwd fallaba por el entorno y no por el mutante.

**Cuánta salida produce `verify` de verdad: medición, y corrección de lo que dije antes.** En la primera ronda afirmé que «un `verify` completo con e2e supera 1 MB sin esfuerzo». **No lo tenía medido y la medición lo desmiente en parte:** `corepack pnpm test` capturado a archivo ocupa **361 bytes**, porque fuera de TTY el reporter de vitest imprime solo el resumen. Los pasos de tests unitarios no aportan volumen.

Lo que sí sostiene el arreglo, sin inventar cifras:

- El defecto es estructural y está **probado**: pasado el búfer, `spawnSync` mata el gate y el hook lo informa ROJO aunque venga verde (evidencia arriba).
- El volumen plausible viene del paso `e2e`, no de los tests unitarios: el handoff de SDD-0454 documenta que la salida del webServer «goteaba sin parar» durante toda la ventana del watchdog, y a eso se suman los volcados de fallos de Playwright y el reintento. **No pude medirlo aquí**: el e2e exige Supabase y esta sesión no lo tiene.
- Con qué frecuencia se cruzaba 1 MB en la práctica queda **SIN MEDIR**. El arreglo quita el precipicio y, cuando se cruce, lo dice en vez de mentir.

**Pruebas de producto que no aplican, y por qué.** El cambio vive en `scripts/`, no lo importa ninguna ruta de `app/`, `lib/` ni `supabase/`, y no altera artefacto de app ni esquema:

- NO APLICA: `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied`. No se tocó producto, tipos, componentes, gobernanza, edge functions ni SQL. (`vitest` tampoco aplicaba, pero se corrió igual y salió verde: queda arriba como evidencia.)
- NO APLICA: `/ui-check` y `ui-pro` (no hay UI), y `revisar-datos-ve` (no se captura, mueve ni borra dato personal alguno; el informe nombra rutas ignoradas, nunca su contenido).
- NO EJECUTADO: `corepack pnpm verify` completo. Es el cierre canónico de producto y aquí no hay cambio de producto; además su paso `e2e` exige Supabase, que esta sesión no tiene. El paso `harness` de `verify` corre justo lo que sí se ejecutó arriba.
- NO EJECUTADO: la CI de GitHub Actions sobre este head. Queda para el Director al publicar.
- NO EJECUTADO: `finish` contra un worktree con `.env` real dentro de un directorio ignorado. Ese camino se cubre con el fixture de la prueba; no se creó un `.env` con secretos en un worktree real a propósito.
- NO EJECUTADO: el hook `Stop` contra un `verify` **real** que desborde el búfer. Haría falta un `verify` con e2e de verdad y sin Supabase no corre. Se probó con el gate falso, que ejercita exactamente la misma ruta de `spawnSync`.

**No se tocó producción.** Ni Supabase, ni migraciones, ni datos de negocio.

## COMMITS

- `4897bb1d` — `fix(harness): finish inventaria ignorados de forma compacta y git deja de romperse por ENOBUFS` (script + pruebas).
- `d23436a0` y `a18adc2a` — handoff de la primera ronda y registro de la PR #94.
- `f86f60d6` — `fix(harness): el hook Stop deja de matar el gate y de informar ROJO un verify verde` (hook + pruebas).
- `fa8dd55c` — `fix(harness): el gate sin medir también bloquea el cierre, anunciado como tal`.
- `fdbed151` — `fix(harness): check-unpublished deja de poder salir verde sin haber medido nada`.
- El commit de `harness-spawn.mjs`, su prueba y los tres consumidores.
- El commit que trae esta versión del documento cierra la tarea.

## PR / BRANCH

[PR #94 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/94): base `main`, rama `claude/stoic-thompson-6ef73b`, worktree el indicado arriba.

- Publicada con la autorización del encargo («open a draft PR»). Push de la rama a sí misma, sin force.
- Pasada a **ready** el 2026-09-11 a pedido de Sam, y **fusionada** ese mismo día por el Director en `664bb4b2`. El Worker no mergeó ni desplegó a mano; ready no autorizaba merge.

## PENDIENTES DE ESTA TAREA

Ninguno. La revisión del Director se aplicó en la ronda 2, la CI del head quedó verde y la PR está fusionada.

Se conservan sin borrar, porque la limpieza es del Director y necesita su propia autorización: el worktree `admiring-pascal-832793`, la rama `claude/stoic-thompson-6ef73b` (ya en main) y la reserva local de SDD-0457 (`refs/dtd/reservations/0457` y `refs/heads/codex/sdd-reserve-0457-harness-spawn-enobufs`, nunca publicadas).

## FUERA DE ALCANCE DETECTADO

1. ~~`scripts/harness-verify-hook.mjs:49`~~ **ATENDIDO en esta misma tarea**, a pedido de Sam. Queda arriba, en COMPLETADO y VALIDACIÓN.
2. ~~`scripts/check-unpublished.mjs:41`~~ **ATENDIDO en esta misma tarea**, a pedido de Sam. Queda arriba, en COMPLETADO y VALIDACIÓN.
2b. **El `git fetch --quiet` de `--fetch` sigue sin mirarse.** Es deliberado y viejo: trabajar sin red es normal y la medición sigue con la ref en caché. Pero un fetch fallido no se nombra, así que la base puede estar vieja sin que se diga. Cambiarlo toca la semántica de «offline es normal» y no lo hice.
2c. ~~`GIT_MAX_BUFFER` repetido en tres scripts~~ **ATENDIDO**, a pedido de Sam: vive en `scripts/harness-spawn.mjs` junto con `runGit`. Queda arriba, en COMPLETADO.
3. **El hook captura, no transmite.** Con 64 MB el corte queda lejísimos, pero la salida del gate sigue materializándose entera en memoria y el usuario no ve progreso mientras corre. Transmitir con `spawn` asíncrono y guardar solo una cola acotada sería mejor; es otro diseño y merece su propia decisión.
4. **`finish` sigue pidiendo `git status --untracked-files=all`.** Ya no revienta gracias al búfer, pero solo se usa como booleano `hasChanges`: un worktree con un árbol grande **no ignorado** materializa un listado entero para nada. Cambiarlo altera semántica y merece su propia decisión.
5. **La expansión de directorios colapsados llega a un nivel.** Un `.env` a mayor profundidad dentro de un directorio ignorado (p. ej. `node_modules/<pkg>/.env`) no se nombra. Es deliberado: el barrido recursivo `**/.env*` sobre ese mismo worktree tardó **18 s** y devolvió 0 resultados, es decir, el costo era del recorrido, no de la salida. El directorio colapsado sí aparece en `ignoredEntries`, y la línea final dice que la expansión es de un nivel.
6. **`finish` no alcanza a los worktrees de `.claude/worktrees/`.** Al cerrar, el Director sugirió correr `node scripts/harness-worktree.mjs finish` sobre este worktree y no aplica: el comando solo resuelve candidatos bajo `<padre-del-checkout>/DTD-worktrees/<slug>`, así que sin slug responde «Slug inválido» y con el nombre del worktree «El candidato no es un worktree registrado y disponible», ambos con exit 1. No es una regresión del arreglo —verificado contra `c-l01-portal-marca`, que sí vive donde `finish` mira—, pero los worktrees que crea la app de Claude Code quedan fuera de su alcance y su informe hay que armarlo a mano con `ignoredReport`. Decidir si `finish` debe cubrirlos es del Director.
7. **`aliado-tenant-coherence` ya no figura en `git worktree list`.** El defecto se reprodujo en `c-l01-portal-marca`, que es equivalente. No busqué qué pasó con aquel worktree ni toqué ninguno ajeno.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** ninguna sobre esta tarea: está integrada en `664bb4b2`. Lo único abierto es la limpieza del worktree y la rama, que es decisión del Director y no se hizo desde aquí.
- **Contratos compartidos:** el JSON de `finish` **suma** campos (`ignoredEntryCount`, `ignoredEntries`, `sensitiveIgnoredFiles`) y ninguno cambia de nombre ni de tipo; `hasIgnoredFiles` conserva su significado. `runGit` y `GIT_MAX_BUFFER` quedan exportados por si otro script del harness quiere el mismo helper. No hay consumidores externos hoy.
- **Contrato de `check-unpublished`:** exit y semántica intactos (siempre 0, informativo, no falla el gate). Lo que cambia es que un git roto ya no puede salir `[OK]`: el listado o el conteo fallidos producen `[AVISO] … SIN MEDIR`. Como el hook reenvía todo lo que contenga `[AVISO]`, esos casos ahora se ven en el cierre. `ramasSinPublicar` conserva su firma; `main` acepta un git inyectado con `runGit` por defecto.
- **Contrato del hook `Stop`:** los códigos de salida no cambian de significado (0 deja cerrar, 2 bloquea) y `.claude/settings.json` queda igual. Solo un exit 0 del gate deja cerrar; un gate medido en rojo y un gate sin medir bloquean los dos, y se distinguen por el mensaje, no por el código. Respecto de `main`, el cambio neto es que **un gate verde cuya salida desborde el búfer ya no se lee como rojo**, y que un gate sin medir se anuncia como tal. Decisión de Sam: el sin medir bloquea.
- **Integración y producción:** integrar a main **dispara el deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy.
- **Efecto en los demás Workers:** con esto integrado, `finish` vuelve a funcionar en cualquier worktree con dependencias instaladas y, además, nombra los `.env*` que antes ni se listaban. Y el hook `Stop` deja de trabar cierres por un gate que en realidad nunca terminó.
- **Ownership:** el claim `finish-ignored-enobufs-claude-20260911` se libera al cerrar. La rama y el worktree se conservan; no se borra nada.
