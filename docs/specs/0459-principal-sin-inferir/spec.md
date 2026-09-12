---
sdd: "0459"
title: "No hay respuesta para «no sé»: el harness elegía un checkout principal aunque no hubiera ninguno"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0370", "0444", "0457", "0458"]
confidencialidad: interno
---

# SDD-0459 — No hay respuesta para «no sé»

> `harness-worktree.mjs` tomaba `entries[0]` de `git worktree list` como el checkout
> principal. La posición no estaba mal: **la pregunta que faltaba era si existía
> un principal**. Cuando el repo común es bare no existe ninguno, `entries[0]` es
> el propio `repo.git`, y el harness razonaba sobre una ruta que no es un árbol de
> trabajo — con la misma cara de confianza que cuando acierta.

## El patrón, que es lo que importa más allá de este archivo

Es la tercera aparición del mismo defecto en este harness:

| dónde | qué devolvía | qué pasaba de verdad |
| --- | --- | --- |
| `check-unpublished` (SDD-0457) | `[OK] sin trabajo fuera de origin/main` | el listado de ramas había fallado |
| `normalizeGitResult` (SDD-0457) | `{ code: 0, out: "" }` | ENOBUFS había matado al hijo |
| `worktrees()` / `entries[0]` (acá) | una ruta como «checkout principal» | no había checkout principal |

**El nombre: «no hay respuesta para "no sé"».** La regla operativa, que se puede
aplicar leyendo código ajeno sin conocer el dominio: *si una función siempre
devuelve algo, preguntate qué devuelve cuando no hay nada correcto que devolver.*

**Dos causas distintas, emparentadas pero no iguales.** Confundirlas hace que se
busque el arreglo equivocado:

1. **No se pudo medir** y se reportó como si se hubiera medido. Es la mitad que
   SDD-0457 ya nombró **SIN MEDIR**: el dato falta.
2. **La medición salió bien y no existe respuesta válida para esos datos.** Es
   esta: `git worktree list` contestó perfecto; lo que no hay es un principal.

**Las salidas aceptables son dos, y ninguna es devolver algo que parezca válido:**

- el tipo de retorno **representa** el «no sé» de forma que no se confunda con una
  respuesta — `null` explícito, un error, una negativa nombrada; o
- la función **no devuelve** y falla con motivo.

El tercer camino —elegir igual y contestar con la misma cara de confianza— es el
que tenían los tres casos.

## Contexto

Medido el 2026-09-12 con git 2.55.0 sobre un repo `--bare` real con dos worktrees
linked (`codex/uno`, `codex/dos`). El porcelain lista el bare primero, con campo
`bare` y sin `HEAD` ni `branch`.

**La posición no es el defecto.** Con worktrees creados en orden no alfabético,
incluido uno llamado `aaa` que ordenaría antes que el principal:

| consultado desde | orden que devuelve el porcelain |
| --- | --- |
| el principal | `principal, aaa, zzz` |
| el worktree `aaa` | `principal, aaa, zzz` |
| el worktree `zzz` | `principal, aaa, zzz` |

En un repo no bare el principal va primero siempre. `entries[0]` es correcto
**exactamente cuando existe un principal**, y esa pregunta nunca se hacía.

**La vía obvia de detección falla en silencio.** Es el dato más caro de esta
medición, porque es lo primero que uno prueba:

| desde un worktree linked | repo bare | repo normal |
| --- | --- | --- |
| `git rev-parse --is-bare-repository` | **`false`** | `false` |
| `git config --get core.bare` | `true` | `false` |
| `--git-common-dir` | `…/repo.git` | `…/DTDCARGO/.git` |

`--is-bare-repository` devuelve `false` en los dos mundos y **confirma la
hipótesis equivocada** de quien lo use para descartar el caso.

**El arreglo de una línea era peor que el defecto.** El encargo proponía
descartar la entrada `bare` como hace `scripts/next-number.mjs:50`. Medido contra
el fixture, desde `dos` —un árbol de Worker legítimo:

| | código actual | con «descartar la entrada bare» |
| --- | --- | --- |
| `guard` | `Guard OK` | **«el checkout principal no es un workspace de implementación»** |
| `finish` sin nombre | informa sobre `dos` | **«estás en el checkout principal (…/dos)»** |

`next-number.mjs` descarta `bare` porque solo inventaría árboles con archivos y
le da igual cuál es el principal; acá **hace falta** saberlo. Copiar la línea
traslada una decisión tomada para otro problema: `entries[0]` pasaría a ser el
worktree de un Worker y el harness lo declararía checkout principal, **bloqueando
su `guard`**. Hoy el daño es menor y cerrado: `guard` acierta, `finish` sin
nombre acierta, y solo `finish <nombre>` deriva contenedores del bare y contesta
«Candidatos: ninguno».

## Decisión

**1. El principal se verifica, y si no hay, se dice.** `mainWorktreeFrom(entries,
commonDir)` es pura, exportada, y devuelve `null` cuando no hay principal
verificable. Una sola condición hace el trabajo: **el principal es el árbol cuyo
`.git` es el directorio común**, o sea `dirname(--git-common-dir) === entries[0]`.
En un repo normal coincide; en uno bare el común es el propio `repo.git`, cuyo
`dirname` es su carpeta contenedora y nunca el `entries[0]` que trae el porcelain
—el bare mismo—, así que no coincide.

**2. Ningún consumidor contesta igual con `null` que sin él.** Es la parte que da
sentido al resto: representar el «no sé» no sirve si después se lo trata como una
respuesta.

| | con principal | sin principal |
| --- | --- | --- |
| `guard` | rechaza trabajar en el principal | no hay ninguno que rechazar; el chequeo de linked worktree sigue siendo el que protege el repo común |
| `start` | crea en `DTD-worktrees/<slug>` | **se niega**: no hay de dónde derivar el contenedor |
| `finish` sin nombre | informa sobre el worktree actual | **igual**: no necesita el principal |
| `finish <nombre>` | resuelve por contenedores | **se niega** y ofrece la salida: correr sin nombre |

**3. La entrada `bare` nunca es candidato.** `worktrees()` captura el flag y
`resolveCandidate`/`guard` la excluyen: el repo común no es un árbol de trabajo.

**4. `finish` sigue siendo solo informe** y ningún campo del JSON cambia de
nombre ni de tipo.

### Lo que enseñó la mutación, y que cambió el código

La primera versión de `mainWorktreeFrom` sumaba a la comparación dos guardas: el
flag `bare` y un chequeo de que el common-dir se llamara `.git`. **Ningún mutante
que los quitara ponía una prueba en rojo**, porque la comparación sola ya cubre
el caso. Se fueron los dos. El flag se sigue leyendo en `worktrees()` —para
excluir la entrada de los candidatos, y eso sí lo fija una prueba—, pero no
decide quién es el principal.

Al quitar el chequeo del nombre apareció algo mejor que la simplificación: un
common-dir que **cuelga del propio árbol** identifica al principal aunque no se
llame `.git`, y uno que cuelga de otro lado no lo identifica aunque sí se llame
así. Lo que decide es la relación, no el nombre. La prueba que esperaba `null`
para `<principal>/otro-dir` estaba fijando el chequeo de nombre, no una verdad
del dominio; ahora espera `principal`.

### Alternativas descartadas

- **Descartar la entrada `bare` y seguir con `entries[0]`.** Medido arriba: peor
  que el defecto. Cambia un fallo cerrado por uno creíble que bloquea a un Worker.
- **Detectar el caso con `--is-bare-repository`.** Devuelve `false` desde un
  worktree linked de un repo bare. Medido.
- **Detectar con `git config --get core.bare`.** Funciona (`true`/`false` bien),
  pero es una llamada más a git para una pregunta que el common-dir ya responde,
  y deja fuera los estados raros que no son bare pero tampoco verificables.
- **Elegir el primer worktree no bare como principal.** Es exactamente el tercer
  camino que esta spec nombra: inventar una respuesta cuando no hay ninguna.

## Alcance

Solo `scripts/harness-worktree.mjs`, sus pruebas y documentación. No toca `app/`,
`lib/`, `supabase/`, el esquema ni `.claude/settings.json`. Sin migraciones.
Integrar a `main` **sí dispara el deploy de producción en Vercel**, porque el
`ignoreCommand` de `vercel.json` no excluye `scripts/**`.

**Desviación declarada de la base.** El runbook manda nacer de `origin/main`.
Esta rama nace de **`ff6f2a9c`**, el head de la PR #97 (SDD-0458), por dependencia
real de código: el rediseño cambia cómo se deriva el principal, y ese valor
alimenta `resolveCandidate` y `worktreeContainers`, que solo existen en #97.
Decidido por el Director tras revisar #97 entera y comprometerse a no pedirle
cambios. Cuando #97 aterrice en `main` se integra **main**, no la rama.

## Criterios de aceptación

1. En un repo bare, ningún comando trata un worktree de trabajo como principal. —
   **CUMPLE**: `guard` da OK en los árboles linked y nadie es declarado principal.
2. Lo que necesita el principal se niega con motivo en vez de inventarlo. —
   **CUMPLE**: `start` y `finish <nombre>` nombran la causa y la salida.
3. Lo que no lo necesita sigue funcionando. — **CUMPLE**: `finish` sin nombre
   informa igual en un repo bare.
4. En un repo normal no cambia nada. — **CUMPLE**: las ocho pruebas del archivo,
   incluidas las seis de SDD-0457/0458, pasan sin tocarlas.
5. La detección no se apoya en `--is-bare-repository`. — **CUMPLE**: no se usa, y
   la spec documenta por qué.
6. `pnpm harness:test` en verde. — **CUMPLE**: 85/85.

## Validación (2026-09-12)

| comprobación | resultado |
| --- | --- |
| `corepack pnpm harness:test` (Windows) | PASÓ — 85/85 |
| `node --test` sobre el archivo tocado | PASÓ — 8/8 |
| `corepack pnpm docs:check` | PASÓ — 433 specs |
| `corepack pnpm sdd:check` | PASÓ |
| `corepack pnpm lint` | PASÓ |
| `git diff --check` | PASÓ |
| comportamiento contra un repo bare real y contra DTDCARGO | PASÓ — tablas del Contexto |

**Seis mutantes** dejan rojo exactamente la prueba que les toca: que
`mainWorktreeFrom` no exija el common-dir; que confíe en la posición en vez de
verificarla; que `resolveCandidate` resuelva por nombre sin principal; que `start`
no rechace su falta; que `worktrees()` deje de capturar el flag `bare`; y que la
entrada bare vuelva a contar como worktree vinculado. Los dos mutantes que
**sobrevivieron** en la primera ronda no se taparon con más pruebas: mostraron
código que no hacía falta, y se borró.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna
ruta de `app/`, `lib/` ni `supabase/` lo importa: `playwright`, `typecheck`,
`rsc-boundary`, `components:check`, `governance:check`, `edge:check`,
`sql-tests`, `schema-rebuild` y `migrations-applied` no aplican, igual que
`/ui-check` (no hay UI) y `revisar-datos-ve` (no se trata dato personal alguno).
`pnpm verify` completo quedó **NO EJECUTADO**: su paso `e2e` exige Supabase, que
esta sesión no tiene.

## Gobernanza

Cambio de harness: no toca comportamiento de Studio ni la allowlist del
[registro de gobernanza](../../governance/README.md), no captura ni mueve datos
personales, y no lee ni escribe producción. No hay migraciones. La numeración se
reservó con `pnpm sdd:next --reserve principal-sin-inferir`, que creó
`refs/dtd/reservations/0459` y la rama de reserva local; el stub se incorporó con
cherry-pick. La ref de reserva no se publica aparte: la PR lleva la spec.

## Riesgos y límites

1. **Un repo con `--separate-git-dir` fuera del árbol se informa como sin
   principal.** `dirname(common-dir)` no da el checkout, así que `start` y
   `finish <nombre>` se niegan. Es fail-closed y coherente con la decisión, pero
   es una negativa nueva para un setup que antes «funcionaba» eligiendo mal. **No
   está medido**: no se probó un repo así.
2. **`guard` deja de comparar contra el principal cuando no hay ninguno.** No es
   una omisión: es que ningún árbol puede serlo. La protección del repo común
   queda enteramente en el chequeo de linked worktree, que no cambió.
3. **El caso bare no se ejerce en este repo.** DTDCARGO no es bare, así que todo
   lo de arriba se sostiene en el fixture y no en uso real.
4. **Los dos hallazgos hermanos siguen abiertos**: `locked` y `prunable` del
   porcelain se leen pero no se exponen, y `finish --dry-run` no hace nada.
