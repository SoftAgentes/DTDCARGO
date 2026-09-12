# Handoff — `finish` con inventario ignorado compacto (ENOBUFS)

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

## CAUSA RAÍZ, CONFIRMADA EN ESTA SESIÓN

Medido sobre `DTD-worktrees/c-l01-portal-marca`, que reproduce el defecto igual que el worktree original:

- `git ls-files --others --ignored --exclude-standard` → **231.105 líneas, 25.157.827 bytes**.
- El mismo listado con `--directory` → **7 líneas**.
- `spawnSync` sin `maxBuffer` corta en 1 MB: devuelve `status: null`, `stdout` vacío y el error solo en `r.error` (`spawnSync git ENOBUFS`). El helper `git()` descartaba `r.error`, así que `mustGit` caía al mensaje genérico «git ls-files falló.» y el Director se quedaba sin informe.
- Antes del arreglo: `node scripts/harness-worktree.mjs finish c-l01-portal-marca` → exit 1, «git ls-files falló.».
- Después: exit 0 en **0,67 s**, con `ignoredEntryCount: 7`.

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

## VALIDACIÓN

Sobre `4897bb1d`, con Node 24.20.0, pnpm vía corepack y git 2.55.0.windows.5.

- **PASÓ** — `corepack pnpm harness:test`: 9 archivos descubiertos, **73/73** en 56,5 s.
- **PASÓ** — `corepack pnpm docs:check`: índice sincronizado, 427 specs.
- **PASÓ** — `corepack pnpm sdd:check`: sin números repetidos; solo los choques históricos ya exentos.
- **PASÓ** — `git diff --check`: sin hallazgos.
- **PASÓ** — `eslint scripts/harness-worktree.mjs scripts/tests/harness-worktree.node.mjs`: 0 errores, 0 advertencias.
- **PASÓ** — reproducción y arreglo sobre un worktree real (`c-l01-portal-marca`, solo lectura): fallaba con exit 1 antes, sale 0 en 0,67 s después, con las 7 entradas esperadas.
- **PASÓ** — mutación de las pruebas, sobre copias en scratch, nunca sobre el árbol de trabajo. Cada mutante deja rojo exactamente la prueba que le toca:
  1. quitar `--directory` → cae el informe compacto;
  2. quitar la rama `if (r.error)` → cae el desbordamiento nombrado;
  3. bajar `GIT_MAX_BUFFER` a 1 MB → cae la cota del búfer;
  4. anular la expansión de un nivel → cae el `.env` anidado.

**Pruebas de producto que no aplican, y por qué.** El cambio vive en `scripts/`, no lo importa ninguna ruta de `app/`, `lib/` ni `supabase/`, y no altera artefacto de app ni esquema:

- NO APLICA: `vitest`, `playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied`. No se tocó producto, tipos, componentes, gobernanza, edge functions ni SQL.
- NO APLICA: `/ui-check` y `ui-pro` (no hay UI), y `revisar-datos-ve` (no se captura, mueve ni borra dato personal alguno; el informe nombra rutas ignoradas, nunca su contenido).
- NO EJECUTADO: `corepack pnpm verify` completo. Es el cierre canónico de producto y aquí no hay cambio de producto; además su paso `e2e` exige Supabase, que esta sesión no tiene. El paso `harness` de `verify` corre justo lo que sí se ejecutó arriba.
- NO EJECUTADO: la CI de GitHub Actions sobre este head. Queda para el Director al publicar.
- NO EJECUTADO: `finish` contra un worktree con `.env` real dentro de un directorio ignorado. Ese camino se cubre con el fixture de la prueba; no se creó un `.env` con secretos en un worktree real a propósito.

**No se tocó producción.** Ni Supabase, ni migraciones, ni datos de negocio.

## COMMITS

- `4897bb1d` — `fix(harness): finish inventaria ignorados de forma compacta y git deja de romperse por ENOBUFS` (script + pruebas).
- El commit que trae este documento cierra la tarea.

## PR / BRANCH

[PR #94 en borrador](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/94): base `main`, rama `claude/stoic-thompson-6ef73b`, worktree el indicado arriba.

- Publicada con la autorización del encargo («open a draft PR»). Push de la rama a sí misma, sin force.
- No se pasó a ready, no se mergeó ni se desplegó a mano.

## PENDIENTES DE ESTA TAREA

Ninguno de implementación. Falta la revisión del Director y la CI del head publicado.

## FUERA DE ALCANCE DETECTADO

1. **`scripts/harness-verify-hook.mjs:49` tiene el mismo defecto, y es peor.** Captura toda la salida de `verify.mjs` con `spawnSync` sin `maxBuffer`. Un `verify` completo con e2e supera 1 MB sin esfuerzo; entonces `r.status` queda `null`, la condición `r.status === 0` falla y **el hook bloquea el cierre informando rojo aunque `verify` haya salido verde**, mostrando una salida vacía o truncada. No lo toqué: es otro script y otro contrato. Merece tarea propia.
2. **`scripts/check-unpublished.mjs:41` también captura sin `maxBuffer`**, pero sus cuatro comandos (`rev-parse`, `for-each-ref`, `rev-list --count`, `fetch --quiet`) producen salidas pequeñas. Riesgo bajo; conviene igualar el helper cuando se atienda el punto 1.
3. **`finish` sigue pidiendo `git status --untracked-files=all`.** Ya no revienta gracias al búfer, pero solo se usa como booleano `hasChanges`: un worktree con un árbol grande **no ignorado** materializa un listado entero para nada. Cambiarlo altera semántica y merece su propia decisión.
4. **La expansión de directorios colapsados llega a un nivel.** Un `.env` a mayor profundidad dentro de un directorio ignorado (p. ej. `node_modules/<pkg>/.env`) no se nombra. Es deliberado: el barrido recursivo `**/.env*` sobre ese mismo worktree tardó **18 s** y devolvió 0 resultados, es decir, el costo era del recorrido, no de la salida. El directorio colapsado sí aparece en `ignoredEntries`, y la línea final dice que la expansión es de un nivel.
5. **`aliado-tenant-coherence` ya no figura en `git worktree list`.** El defecto se reprodujo en `c-l01-portal-marca`, que es equivalente. No busqué qué pasó con aquel worktree ni toqué ninguno ajeno.

## HANDOFF AL DIRECTOR

- **Siguiente acción:** revisar la PR en borrador y correr su CI. La PR no se pasa a ready ni se mergea desde aquí.
- **Contratos compartidos:** el JSON de `finish` **suma** campos (`ignoredEntryCount`, `ignoredEntries`, `sensitiveIgnoredFiles`) y ninguno cambia de nombre ni de tipo; `hasIgnoredFiles` conserva su significado. `runGit` y `GIT_MAX_BUFFER` quedan exportados por si otro script del harness quiere el mismo helper. No hay consumidores externos hoy.
- **Integración y producción:** integrar a main **dispara el deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`. El artefacto de la app no cambia, pero la autorización de merge tiene que cubrir ese deploy.
- **Efecto en los demás Workers:** con esto integrado, `finish` vuelve a funcionar en cualquier worktree con dependencias instaladas y, además, nombra los `.env*` que antes ni se listaban.
- **Ownership:** el claim `finish-ignored-enobufs-claude-20260911` se libera al cerrar. La rama y el worktree se conservan; no se borra nada.
