# Handoff — ENOBUFS en el harness: `finish` y el hook `Stop` de `verify`

Fecha: 2026-09-11. Task ID: `finish-ignored-enobufs`.
Owner / sesión escritora: `finish-ignored-enobufs-claude-20260911` (Worker Claude Code, worktree `admiring-pascal-832793`). No hubo subagentes.

Estado: lista-para-revision. No está integrada.

- **Worktree:** `C:/Users/AKX generator/Desktop/Developer/DTDCARGO/.claude/worktrees/admiring-pascal-832793`.
  Es un worktree enlazado que la sesión ya recibió aislado, no el checkout principal y no `main`, así que **no** se creó otro con `harness-worktree.mjs start`: crear uno anidado habría duplicado el aislamiento que ya existía. `guard` PASÓ y el claim se tomó antes de editar; se revalidó `guard --owner` antes del commit.
- **Rama:** `claude/stoic-thompson-6ef73b`, nacida en `543bbe0a`, que ya contiene el `origin/main` en caché. No se integró main durante la tarea porque no avanzó.
- **SDD:** ninguno. El encargo no asignó ID y el runbook reserva la asignación al Director (`docs/runbooks/codex-engineering.md`, sección SDD). El cambio es de harness, no de comportamiento de producto ni de Studio, así que no toca la allowlist de gobernanza. Si el Director quiere spec, la reserva es suya; nada del diff depende de un número.

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

**`scripts/harness-worktree.mjs`**

- `ignoredReport(target)` (exportada) sustituye al `ls-files` plano en `finish` y usa `--directory -z`: un directorio ignorado completo se colapsa en una entrada.
- El informe conserva `hasIgnoredFiles` y suma `ignoredEntryCount` (total), `ignoredEntries` (hasta 50 entradas) y `sensitiveIgnoredFiles`.
- Los directorios colapsados se expanden **un nivel** con `readdirSync` para nombrar `.env*` anidados, saltando symlinks y lo que no sea directorio. Se nombran, nunca se abren: el informe no lee ni imprime contenido.
- `isSensitiveIgnoredName` (exportada) marca `.env`, `.env.local`, `.envrc` y demás `.env*`, sin distinguir mayúsculas. No marca `env.local` ni `environment.ts`.
- `runGit` (exportada, antes `git()` privada; `const git = runGit` conserva los llamantes) recibe `GIT_MAX_BUFFER = 64 MB` y, cuando `spawnSync` falla, **devuelve el error real** (`git <args>: spawnSync git ENOBUFS`) en vez de dejar `err` vacío. No se silencia nada: un fallo sigue siendo código ≠ 0.
- La línea final de `finish` explica el inventario compacto, el nivel de expansión y el tope de 50, además de las advertencias que ya tenía.
- **Alcance intacto:** `finish` sigue siendo solo informe. No borra, no poda, no toca el árbol ignorado que acaba de nombrar; la prueba lo verifica contando los ignorados antes y después.

**`scripts/tests/harness-worktree.node.mjs`** (2 pruebas nuevas, 4 en total)

- Los helpers de sandbox (`gitAt`, `cliAt`, `sandboxRepo`) subieron a ámbito de módulo; la prueba existente quedó igual salvo esas tres líneas.
- `runGit names a buffer overflow…`: `GIT_MAX_BUFFER ≥ 32 MB`, una corrida normal, un desbordamiento forzado con `maxBuffer: 4` que exige `ENOBUFS` en `err`, y la tabla de nombres sensibles.
- `finish inventories ignored files compactly…`: worktree con **1.200 archivos ignorados** en 40 paquetes × `dist/chunks` (directorios ignorados anidados), un `.env.local` en la raíz y un `.env.production` dentro de `secrets/`, que `--directory` colapsa. Comprueba: informe vacío antes de ensuciar; `> 1.000` archivos en el listado expandido frente a `≤ 10` entradas informadas; `ignoredEntries` exacto; `sensitiveIgnoredFiles` con **los dos** `.env`, incluido el anidado; que el informe no contiene el contenido secreto, ni rutas del interior del directorio colapsado, ni supera 4.000 caracteres; y que nada se borró.

**`scripts/harness-verify-hook.mjs`**

- El spawn de `verify.mjs` recibe `HOOK_MAX_BUFFER = 64 MB`, igual que el `execSync` de `git status` y el spawn de `check-unpublished.mjs`.
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

- `runGit` (exportada, antes `git()` privada) recibe `GIT_MAX_BUFFER = 64 MB` y **devuelve `err`**. Antes el helper descartaba `stderr` y `r.error` por completo: solo sobrevivían `code` y `out`.
- **El defecto de fondo era un falso verde.** El `code` del listado de ramas **no se miraba**: si `for-each-ref` fallaba, `listado.out` quedaba vacío, `ramas` vacío, `pendientes` vacío y el script imprimía **`[OK] sin trabajo commiteado fuera de origin/main`**. Es decir, justo el check que existe porque SDD-0091 se perdió sin que nadie lo midiera, salía en verde cuando no había medido nada. Ahora un listado fallido sale `[AVISO] … SIN MEDIR` con el motivo.
- **Un conteo que falla ya no cuenta como 0.** `rev-list --count` con error apartaba la rama a `0 commits sin publicar`, indistinguible de una rama al día. Ahora esas ramas van a un bloque `[AVISO] N rama(s) SIN MEDIR contra origin/main` con su motivo.
- El aviso de `origin/main` ausente conserva su texto y ahora agrega el error real de git, en vez de adivinar siempre «¿clone shallow o sin remoto?».
- `main(ejecutar = runGit)` acepta el git inyectado, siguiendo la decisión de diseño que el propio archivo ya documenta para `ramasSinPublicar` («PURA respecto de git… así el test no necesita un repo de verdad»). Es lo que permite probar los caminos en los que git falla.
- **Contrato intacto:** exit 0 siempre, 2 solo por bug del propio check; no pushea, no borra, no falla el gate. Todos los mensajes nuevos usan el prefijo `[AVISO]`, que es lo que el hook `Stop` busca para reenviarlos, así que ahora se ven en el cierre en vez de perderse.

**`scripts/tests/check-unpublished.node.mjs`** (nuevo, 3 pruebas). El script no tenía ninguna, pese a que su encabezado decía «se importa desde su test».

- `runGit` con desbordamiento forzado (`ENOBUFS` en `err`), la cota del búfer y el contrato de `ramasSinPublicar` (filtra ceros, ordena de más a menos, lista vacía).
- Con git inyectado: el único verde posible (todo medido y nada pendiente), el listado fallido, el conteo fallido y la base ausente — los tres **sin `[OK]`** — y el aviso de siempre con su recordatorio de SDD-0091.
- Contra git de verdad, en un sandbox: sin `origin/main` avisa y no sale verde; con todo publicado sale `[OK]`; con una rama de un commit por delante la nombra con su conteo.

## VALIDACIÓN

Sobre `4897bb1d` (parte 1) y el commit del hook (parte 2), con Node 24.20.0, pnpm vía corepack y git 2.55.0.windows.5.

- **PASÓ** — `corepack pnpm harness:test`: **11 archivos descubiertos, 78/78**. (9 archivos y 73/73 antes del hook; 10 y 75/75 antes de check-unpublished.)
- **PASÓ** — `corepack pnpm docs:check`: índice sincronizado, 427 specs.
- **PASÓ** — `corepack pnpm sdd:check`: sin números repetidos; solo los choques históricos ya exentos.
- **PASÓ** — `git diff --check`: sin hallazgos.
- **PASÓ** — `eslint` sobre los seis archivos tocados: 0 errores, 0 advertencias.
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
  10. que un conteo fallido vuelva a contar 0 → cae la misma prueba.

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
- El commit de `check-unpublished.mjs` y su prueba nueva.
- El commit que trae esta versión del documento cierra la tarea.

## PR / BRANCH

[PR #94 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/94): base `main`, rama `claude/stoic-thompson-6ef73b`, worktree el indicado arriba.

- Publicada con la autorización del encargo («open a draft PR»). Push de la rama a sí misma, sin force.
- No se pasó a ready, no se mergeó ni se desplegó a mano.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación. Falta la revisión del Director y la CI del head publicado.

## FUERA DE ALCANCE DETECTADO

1. ~~`scripts/harness-verify-hook.mjs:49`~~ **ATENDIDO en esta misma tarea**, a pedido de Sam. Queda arriba, en COMPLETADO y VALIDACIÓN.
2. ~~`scripts/check-unpublished.mjs:41`~~ **ATENDIDO en esta misma tarea**, a pedido de Sam. Queda arriba, en COMPLETADO y VALIDACIÓN.
2b. **El `git fetch --quiet` de `--fetch` sigue sin mirarse.** Es deliberado y viejo: trabajar sin red es normal y la medición sigue con la ref en caché. Pero un fetch fallido no se nombra, así que la base puede estar vieja sin que se diga. Cambiarlo toca la semántica de «offline es normal» y no lo hice.
2c. **`GIT_MAX_BUFFER` está repetido en tres scripts** (`harness-worktree.mjs`, `harness-verify-hook.mjs` con su propio nombre, y ahora `check-unpublished.mjs`). Cada uno queda autónomo y documenta su motivo, que es el estilo de `scripts/`; consolidarlo en un módulo compartido es razonable y es decisión del Director.
3. **El hook captura, no transmite.** Con 64 MB el corte queda lejísimos, pero la salida del gate sigue materializándose entera en memoria y el usuario no ve progreso mientras corre. Transmitir con `spawn` asíncrono y guardar solo una cola acotada sería mejor; es otro diseño y merece su propia decisión.
4. **`finish` sigue pidiendo `git status --untracked-files=all`.** Ya no revienta gracias al búfer, pero solo se usa como booleano `hasChanges`: un worktree con un árbol grande **no ignorado** materializa un listado entero para nada. Cambiarlo altera semántica y merece su propia decisión.
5. **La expansión de directorios colapsados llega a un nivel.** Un `.env` a mayor profundidad dentro de un directorio ignorado (p. ej. `node_modules/<pkg>/.env`) no se nombra. Es deliberado: el barrido recursivo `**/.env*` sobre ese mismo worktree tardó **18 s** y devolvió 0 resultados, es decir, el costo era del recorrido, no de la salida. El directorio colapsado sí aparece en `ignoredEntries`, y la línea final dice que la expansión es de un nivel.
6. **`aliado-tenant-coherence` ya no figura en `git worktree list`.** El defecto se reprodujo en `c-l01-portal-marca`, que es equivalente. No busqué qué pasó con aquel worktree ni toqué ninguno ajeno.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador y correr su CI. La PR no se pasa a ready ni se mergea desde aquí.
- **Contratos compartidos:** el JSON de `finish` **suma** campos (`ignoredEntryCount`, `ignoredEntries`, `sensitiveIgnoredFiles`) y ninguno cambia de nombre ni de tipo; `hasIgnoredFiles` conserva su significado. `runGit` y `GIT_MAX_BUFFER` quedan exportados por si otro script del harness quiere el mismo helper. No hay consumidores externos hoy.
- **Contrato de `check-unpublished`:** exit y semántica intactos (siempre 0, informativo, no falla el gate). Lo que cambia es que un git roto ya no puede salir `[OK]`: el listado o el conteo fallidos producen `[AVISO] … SIN MEDIR`. Como el hook reenvía todo lo que contenga `[AVISO]`, esos casos ahora se ven en el cierre. `ramasSinPublicar` conserva su firma; `main` acepta un git inyectado con `runGit` por defecto.
- **Contrato del hook `Stop`:** los códigos de salida no cambian de significado (0 deja cerrar, 2 bloquea) y `.claude/settings.json` queda igual. Solo un exit 0 del gate deja cerrar; un gate medido en rojo y un gate sin medir bloquean los dos, y se distinguen por el mensaje, no por el código. Respecto de `main`, el cambio neto es que **un gate verde cuya salida desborde el búfer ya no se lee como rojo**, y que un gate sin medir se anuncia como tal. Decisión de Sam: el sin medir bloquea.
- **Integración y producción:** integrar a main **dispara el deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy.
- **Efecto en los demás Workers:** con esto integrado, `finish` vuelve a funcionar en cualquier worktree con dependencias instaladas y, además, nombra los `.env*` que antes ni se listaban. Y el hook `Stop` deja de trabar cierres por un gate que en realidad nunca terminó.
- **Ownership:** el claim `finish-ignored-enobufs-claude-20260911` se libera al cerrar. La rama y el worktree se conservan; no se borra nada.
