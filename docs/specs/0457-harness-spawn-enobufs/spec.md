---
sdd: "0457"
title: "ENOBUFS y errores tapados en el harness: un subproceso que no se midió no es un veredicto"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0444", "0454"]
confidencialidad: interno
---

# SDD-0457 — ENOBUFS y errores tapados en el harness

> Tres scripts del harness capturaban la salida de un subproceso con el
> `maxBuffer` de 1 MB por defecto. `spawnSync` no solo trunca: **mata al hijo** y
> deja el motivo únicamente en `r.error`, que ninguno de los tres miraba. El
> resultado eran tres mentiras distintas: un informe que abortaba, un gate verde
> anunciado como ROJO y un check que salía `[OK]` sin haber medido nada.

## Contexto

`node scripts/harness-worktree.mjs finish <slug>` fallaba con «git ls-files
falló.» en cualquier worktree con dependencias instaladas. Reproducido el
2026-09-11 en `DTD-worktrees/aliado-tenant-coherence` y verificado en
`DTD-worktrees/c-l01-portal-marca`:

| medición | valor |
| --- | --- |
| `git ls-files --others --ignored --exclude-standard` | 231.105 líneas, 25.157.827 bytes |
| el mismo listado con `--directory` | 7 líneas |
| `finish` antes del arreglo | exit 1, «git ls-files falló.» |
| `finish` después | exit 0 en 0,67 s, `ignoredEntryCount: 7` |

Al tirar del hilo aparecieron dos primos del mismo defecto, cada uno con una
consecuencia peor que la del original:

1. **`scripts/harness-verify-hook.mjs`** (hook `Stop`) capturaba toda la salida
   de `verify.mjs` sin `maxBuffer`. Al cruzar 1 MB, `spawnSync` mataba el gate a
   media corrida; con `r.status` en `null`, la condición `r.status === 0` fallaba
   y el hook **bloqueaba el cierre anunciando ROJO un gate que nunca terminó**.
   Reproducido con el archivo tal como estaba en `main` y un `verify` falso de
   3 MB que sale 0: exit 2 con «🛑 Harness gate en ROJO».
2. **`scripts/check-unpublished.mjs`** tenía un helper que descartaba `stderr` y
   `r.error` por completo, y **el `code` del listado de ramas no se miraba**: si
   `for-each-ref` fallaba, `ramas` quedaba vacío y el script imprimía
   `[OK] sin trabajo commiteado fuera de origin/main`. Es decir, el check que
   existe porque SDD-0091 se perdió sin que nadie lo midiera podía salir en
   verde sin medir una sola rama.

Los tres compartían causa y cura, y el patrón estaba copiado entre archivos.

## Decisión

**1. Inventario compacto en `finish`.** Se lista con
`ls-files --others --ignored --exclude-standard --directory -z`: un directorio
ignorado completo se colapsa en una entrada. El informe conserva
`hasIgnoredFiles` y suma `ignoredEntryCount`, `ignoredEntries` (hasta 50) y
`sensitiveIgnoredFiles`. Ningún campo existente cambia de nombre ni de tipo.

Los directorios colapsados se expanden **un nivel** para nombrar `.env*`
anidados, saltando symlinks. Se nombran, nunca se abren: el informe no lee ni
imprime contenido. `finish` sigue siendo solo informe: no borra ni poda.

**2. Un subproceso sin medir no produce veredicto.** El hook `Stop` clasifica el
resultado del gate en tres casos, no en dos:

| caso | cierre | mensaje |
| --- | --- | --- |
| medido y verde (exit 0) | deja cerrar | — |
| medido y rojo (exit ≠ 0) | bloquea (exit 2) | `🛑 Harness gate en ROJO (exit N)` |
| SIN MEDIR (spawn fallido, desbordamiento, señal) | bloquea (exit 2) | `🛑 Harness gate SIN MEDIR: <motivo>` |

Solo un exit 0 deja cerrar: el rojo bloquea por su veredicto y el sin medir por
la ausencia de él. Comparten el código de salida y jamás el mensaje. El
fail-open queda para los errores propios del hook —sin git, stdin raro, el aviso
de publicación—, que siguen sin trabar nada; si el gate nunca lograra medirse,
la salida es el anti-loop `stop_hook_active`, que ya existía.

La misma regla en `check-unpublished`: un listado o un conteo que falla produce
`[AVISO] … SIN MEDIR` con el motivo, nunca `[OK]`.

**3. El búfer y el helper viven en un módulo.** `scripts/harness-spawn.mjs`
exporta `MAX_BUFFER` (64 MB) y `runGit(args, cwd, maxBuffer)`, que devuelve
`{ code, out, err }`, nunca lanza y **nombra el error de spawn** (ENOBUFS,
ENOENT…) en vez de perderlo. Sus tres consumidores importan de ahí; no quedan
copias del número ni del helper en `scripts/`.

**4. El `error` manda sobre el `status`.** Medido con Node 24 en las dos
plataformas, provocando ENOBUFS 60 veces dentro de `node:24`:

| | `r.error.code` | `r.status` |
| --- | --- | --- |
| Windows | ENOBUFS siempre | `null` con SIGTERM |
| Linux | ENOBUFS siempre | **0 en 51 de 60 corridas** |

En Linux git alcanza a terminar bien antes de que el padre lo corte, así que el
`status` de un desbordamiento no es de fiar y el `error` sí. La primera versión
de `runGit` hacía `code: r.status ?? 1` y en Linux devolvía `{ code: 0, out: "" }`:
un desbordamiento leído como éxito con salida vacía. Habría informado como limpio
un worktree lleno de ignorados y habría devuelto a `check-unpublished` su `[OK]`
sin medición — la misma clase de mentira que esta spec elimina, reintroducida por
el arreglo. Lo destapó la CI en Linux (run 34666711465) y lo confirmó la medición.
`normalizeGitResult` es pura y exportada justo para fijar ese caso por prueba, sin
depender de la carrera.

### Alternativas descartadas

- **Solo subir el `maxBuffer` de `finish`.** Deja el 25 MB de listado
  materializándose para calcular un booleano, y no arregla a los otros dos.
- **Barrido recursivo `**/.env*` para los `.env` anidados.** Medido sobre el
  worktree real: **18 s** y 0 resultados. El costo era el recorrido, no la
  salida. Por eso la expansión llega a un nivel y el límite se documenta.
- **Transmitir en vez de capturar en el hook** (`spawn` asíncrono con cola
  acotada). Es mejor diseño y sigue disponible; exige volver asíncrono un script
  síncrono y no hacía falta para quitar el precipicio.
- **Consolidar solo la constante.** `runGit` estaba duplicado casi carácter por
  carácter en dos scripts: mover el número habría dejado la duplicación cara.

## Alcance

Solo `scripts/`. No toca `app/`, `lib/`, `supabase/`, ni el artefacto de la app,
ni el esquema, ni `.claude/settings.json`. Integrar a `main` **sí dispara el
deploy de producción en Vercel**, porque el `ignoreCommand` de `vercel.json` no
excluye `scripts/**`.

## Criterios de aceptación

1. `finish` corre en un worktree con dependencias instaladas y su informe no
   crece con el tamaño de `node_modules`. — **CUMPLE**: exit 0 en 0,67 s con 7
   entradas sobre `c-l01-portal-marca`; la prueba exige ≤ 10 entradas frente a
   más de 1.000 archivos ignorados.
2. `hasIgnoredFiles` conserva su significado y los `.env*` se marcan por nombre,
   incluidos los que viven dentro de un directorio colapsado, sin imprimir
   contenido. — **CUMPLE**: la prueba verifica `.env.local` y
   `secrets/.env.production`, y que el secreto no aparece en la salida.
3. `finish` sigue sin borrar ni podar. — **CUMPLE**: la prueba cuenta los
   ignorados antes y después.
4. Un gate verde cuya salida desborde el búfer no se informa como rojo. —
   **CUMPLE**: con el hook de `main`, exit 2; con el nuevo, exit 0.
5. Un gate que no se pudo medir bloquea el cierre y se anuncia como tal. —
   **CUMPLE**: desbordamiento real de 64 MB → exit 2, «SIN MEDIR», sin «gate en
   ROJO». La prueba unitaria exige que ningún motivo sin medir contenga «ROJO».
6. `check-unpublished` no puede salir `[OK]` si git falló. — **CUMPLE**: los tres
   caminos (listado, conteo y base) salen `[AVISO]`.
7. Un fallo de spawn se nombra en vez de degradarse a un mensaje genérico. —
   **CUMPLE**: `err` trae `git <args>: spawnSync git ENOBUFS`.
8. Un desbordamiento es un fallo aunque git alcance a salir con 0. — **CUMPLE**:
   `normalizeGitResult({ status: 0, error: ENOBUFS })` da código ≠ 0 y `out` vacío.
9. `pnpm harness:test` en verde en las dos plataformas. — **CUMPLE**: 12 archivos,
   81/81 en Windows y en Linux (`node:24`).

## Validación (2026-09-11/12)

| comprobación | resultado |
| --- | --- |
| `corepack pnpm harness:test` (Windows, fuera de TTY) | PASÓ — 12 archivos, 81/81 |
| la misma suite en Linux (`node:24`, repo real) | PASÓ — 81/81 |
| `corepack pnpm docs:check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `git diff --check` | PASÓ |
| `eslint` sobre los 8 archivos tocados | PASÓ — 0 errores |
| `corepack pnpm test` (no requerido) | PASÓ — 530 archivos, 6727 tests |

Reproducción y arreglo medidos sobre artefactos reales: `finish` contra
`c-l01-portal-marca` (solo lectura), el hook de `main` contra un `verify` falso,
y `check-unpublished` contra el repo (18 ramas, exit 0).

**Trece mutantes** dejan rojo exactamente la prueba que les toca: quitar
`--directory`; quitar la rama `if (r.error)`; achicar cada búfer; anular la
expansión de un nivel; volver a la clasificación vieja del gate; dejar que el
gate sin medir no bloquee; devolver el helper viejo de `check-unpublished`;
dejar de mirar el `code` del listado; que un conteo fallido vuelva a contar 0;
y, en el módulo compartido, bajar `MAX_BUFFER`, tapar el error de spawn e
ignorar el `cwd`. Los tres últimos se corrieron dentro de un repo git de mentira
y con una corrida de control en verde: en un scratch sin repo, la prueba del
`cwd` fallaba por el entorno y no por el mutante.

**Ronda de CI en rojo, y qué enseñó.** La primera publicación dejó la CI en rojo
en Linux con dos pruebas propias caídas, iguales en las cinco corridas de la rama
(run 34666711465). Ninguna era intermitencia y ninguna era ajena:

1. `runGit(['--version'], repo, 4)` devolvía `code: 0`. No era un problema de la
   prueba sino del helper: ver la decisión 4. El arreglo es que el error mande.
2. La cola del gate perdía la última línea. Tampoco era del hook: **el fixture se
   truncaba a sí mismo**. En Linux las escrituras a un pipe son asíncronas y
   `process.exit()` descarta lo pendiente; medido, de 3.145.751 bytes llegaban
   146.176. Con `process.exitCode` llega todo, y en Windows nunca se notó porque
   ahí esas escrituras son síncronas.

La lección operativa quedó en el harness: estas dos pruebas ahora se corren
también en Linux antes de publicar, con la salida canalizada.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna
ruta de `app/`, `lib/` ni `supabase/` lo importa: `playwright`, `typecheck`,
`rsc-boundary`, `components:check`, `governance:check`, `edge:check`,
`sql-tests`, `schema-rebuild` y `migrations-applied` no aplican, igual que
`/ui-check` (no hay UI) y `revisar-datos-ve` (no se trata dato personal alguno;
el informe nombra rutas ignoradas, nunca su contenido). `pnpm verify` completo
quedó **NO EJECUTADO**: su paso `e2e` exige Supabase, que esta sesión no tiene.

**Corrección de una afirmación previa.** Durante la tarea se afirmó que un
`verify` completo «supera 1 MB sin esfuerzo». No estaba medido y la medición lo
desmiente en parte: `pnpm test` capturado a archivo ocupa **361 bytes**, porque
fuera de TTY el reporter de vitest imprime solo el resumen. El defecto es
estructural y está probado igual; **con qué frecuencia se cruzaba 1 MB en la
práctica queda SIN MEDIR** en esta sesión. El volumen plausible viene del paso
`e2e`, cuyo webServer «goteaba sin parar» según el handoff de SDD-0454.

## Gobernanza

Cambio de harness: no toca comportamiento de Studio ni la allowlist del
[registro de gobernanza](../../governance/README.md), no captura ni mueve datos
personales, y no lee ni escribe producción. No hay migraciones. La numeración se
reservó con `pnpm sdd:next --reserve harness-spawn-enobufs`, que creó
`refs/dtd/reservations/0457` y la rama de reserva local; el stub se incorporó a
la rama de trabajo con cherry-pick. La ref de reserva no se publicó aparte: la
PR contiene la spec, así que el número ya es visible.

## Riesgos y límites

1. **La expansión de directorios colapsados llega a un nivel.** Un `.env` más
   profundo dentro de un directorio ignorado (por ejemplo
   `node_modules/<pkg>/.env`) no se nombra. Es deliberado por el costo medido de
   18 s; el directorio colapsado sí aparece en `ignoredEntries` y la línea final
   del informe dice que la expansión es de un nivel.
2. **El hook captura, no transmite.** Con 64 MB el corte queda lejísimos, pero la
   salida del gate se materializa entera en memoria y quien corre no ve progreso.
3. **Un gate que jamás logre medirse bloquea cada intento de cierre** hasta que
   el anti-loop `stop_hook_active` lo deja pasar en el segundo. Es la
   consecuencia buscada de la decisión 2, no un efecto colateral.
4. **`finish` sigue pidiendo `git status --untracked-files=all`** para calcular
   un booleano. Ya no revienta, pero un árbol grande **no ignorado** se
   materializa para nada. Cambiarlo altera semántica.
5. **El `git fetch --quiet` de `check-unpublished --fetch` sigue sin mirarse.** Es
   deliberado y viejo —trabajar sin red es normal—, pero un fetch fallido no se
   nombra y la base puede estar vieja sin que se diga.
