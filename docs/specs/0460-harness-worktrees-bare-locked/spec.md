---
sdd: "0460"
title: "El principal no se infiere de un registro bare, y `finish` dice lo que git sabe de locked y prunable"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0457", "0458"]
confidencialidad: interno
---

# SDD-0460 — `bare` descartado en `worktrees()`, `locked` y `prunable` en el informe

> `worktrees()` leía `git worktree list --porcelain` sin descartar el registro del
> repositorio **bare**, que git emite primero. De ahí salía `entries[0]`, el
> «principal» del que dependen `guard`, `claim`, `release` y `finish`. El supuesto
> se cumplía por casualidad —este checkout no es bare— y **ninguna prueba fallaba**
> si dejaba de cumplirse. De paso, el mismo parseo ya tenía en la mano `locked` y
> `prunable` y los tiraba: la evidencia que más falta en la limpieza manual.

## Contexto

Los dos hallazgos los levantó la sesión de SDD-0458 ([PR #97](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/97))
como **FUERA DE ALCANCE DETECTADO**, puntos 2 y 1 de su handoff, y el Director los
confirmó. Van juntos porque viven en la misma función y en el mismo parseo.

**1. El registro bare.** `scripts/next-number.mjs:50` ya descartaba el registro con
campo `bare` (`if (fields.includes("bare")) continue;`); `worktrees()` no. Asimetría
real entre dos lectores del mismo porcelain. Medido con git 2.55 en Windows sobre un
repo bare con tres worktrees vinculados:

| medición | resultado |
| --- | --- |
| posición del registro `bare` en el porcelain | **primera, siempre** |
| orden de los vinculados | alfabético por ruta |
| repo **normal**: ¿el principal va primero aunque su nombre sea el último alfabéticamente? | **sí** (`zzz-principal` antes de `aaa`, `mmm`) |

Es decir: en un repo normal el principal gana el primer puesto por ser el principal,
no por su nombre, y **lo único que se lo quitaba era el registro bare**. Con un repo
bare de por medio, `entries[0]` apunta a un directorio que no es checkout de nada:

- `safeTarget` deriva el contenedor de worktrees de `path.dirname(entries[0].path)`,
  así que `start` y `finish` razonan sobre el contenedor equivocado.
- `guard` compara `entries[0].path` contra la raíz para rechazar el checkout
  principal: con el bare ahí, ese rechazo deja de medir lo que cree medir.
- En SDD-0458 el mismo `entries[0]` alimenta `worktreeContainers` y
  `resolveCandidate`, así que el defecto llega también al candidato de `finish`.

El costo real no es que hoy falle —hoy no falla—, es que el día que alguien agregue
un repositorio bare el harness empieza a razonar sobre el worktree equivocado **en
silencio**, sin un rojo que lo anuncie.

**2. `locked` y `prunable` se descartaban.** `worktrees()` leía solo `worktree` y
`branch`. El porcelain trae además dos campos que son exactamente la evidencia que
el paso de limpieza no tiene: `locked` dice que alguien marcó el worktree a
propósito, y `prunable` que git ya lo considera desechable. Exponerlos no cuesta una
llamada nueva a git: ya estaban en la salida que se parseaba.

## Decisión

**1. El registro bare se descarta, igual que en `next-number.mjs`.** El parseo se
extrae a `parseWorktrees(porcelain)`, **pura y exportada**, para poder fijar el caso
por prueba sobre una salida literal sin depender de armar un repo bare. La regla es
una línea (`if (fields.includes('bare')) return [];`); lo demás es el mismo parseo
de antes más dos campos.

No se toca la forma en que se elige el principal: sigue siendo `entries[0]`, ahora
sobre una lista que solo tiene worktrees con árbol de trabajo. Convertir eso en una
consulta explícita a git es otro cambio, con otra decisión, y no se hizo acá.

**2. Una lista vacía se nombra.** Al descartar el bare, un repo bare **sin** ningún
worktree vinculado deja la lista vacía y `entries[0].path` moría con
`TypeError: Cannot read properties of undefined`. Se cambia por un error con nombre.
Es una línea más que la del hallazgo y se declara como tal: cambia un crash opaco por
un mensaje, no el alcance.

**3. El informe de `finish` suma cuatro campos.** `locked` y `prunable` booleanos,
`lockedReason` y `prunableReason` con la razón que dio git o `null`. Cuatro campos de
tipo estable en vez de dos uniones: un worktree bloqueado **sin** razón es
`locked: true` con `lockedReason: null`, y no un bloqueo invisible.

Ningún campo existente cambia de nombre ni de tipo. `finish` sigue siendo **solo
informe**: `cleanupAuthorized: false` y el pie sobre limpieza manual del Director
quedan como estaban; no borra, no poda, no publica. `start` no se toca: sigue creando
en `DTD-worktrees/<slug>`.

**4. El límite «manda el disco» se conserva a propósito.** Un candidato ausente en
disco se sigue rechazando por `existsSync`, **no** por lo que opine git. Ahora el
informe puede decir `prunable: true` y el pie explica que es evidencia y no decisión:
si git y el disco discrepan, manda el disco. Cambiar eso sería una decisión explícita
y no se tomó.

**5. El `-z` es obligatorio para leer las razones.** Medido: sin `-z`, git **cita y
escapa en octal** la razón del lock (`locked "el Director lo pidi\303\263"`); con
`-z` la entrega cruda. Lo destapó una aserción de la prueba que releía el formato sin
`-z` y falló. `worktrees()` ya usaba `-z`; ahora hay una prueba que lo sostiene, y el
mutante que le quita el `-z` deja rojas tres pruebas.

### Alternativas descartadas

- **Dejar de inferir el principal y preguntárselo a git** (`rev-parse`, o el registro
  sin `bare` cuyo gitdir sea el común). Es el arreglo de fondo del supuesto y sigue
  disponible; es un refactor de cuatro comandos y el encargo lo excluyó. Ver abajo:
  otra sesión reservó SDD-0459 con ese nombre.
- **Un solo campo por atributo** (`locked: string | null`). No distingue bloqueado
  sin razón de no bloqueado, que es justo la diferencia que importa antes de borrar.
- **Mirar `locked` para rechazar candidatos.** Sería cambiar el contrato de `finish`
  de informe a guardián. La evidencia se publica; la decisión queda del Director.
- **Solo arreglar el `bare` y dejar `locked`/`prunable` para otra tarea.** Son la
  misma función y el mismo parseo; separarlos costaba dos PRs sobre el mismo bloque.

## Alcance

Solo `scripts/harness-worktree.mjs` y su archivo de pruebas. No toca `app/`, `lib/`,
`supabase/`, el artefacto de la app, el esquema ni `.claude/settings.json`. Sin
migraciones. Integrar a `main` **sí dispara el deploy de producción en Vercel**,
porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`.

## Criterios de aceptación

1. Un registro con campo `bare` no queda en la lista, y el primer elemento pasa a ser
   el primer worktree con árbol de trabajo. — **CUMPLE**: prueba pura sobre una salida
   literal de seis registros y, con bytes de git de verdad, sobre el repo bare del
   fixture.
2. Con un repositorio bare de por medio, `finish` informa sobre el worktree correcto.
   — **CUMPLE**: fixture con el bare en `<sandbox>/repo.git`, el principal en
   `<sandbox>/nido/AAA-principal` y el candidato en
   `<sandbox>/nido/DTD-worktrees/worker`; sin el filtro, el candidato se armaba sobre
   `<sandbox>` y salía exit 1.
3. `locked` y `prunable` llegan al JSON con su razón, y un bloqueo sin razón no es
   invisible. — **CUMPLE**: `locked: true` + `lockedReason: 'el Director lo pidió'`
   end-to-end con `git worktree lock` real; el caso `locked` pelado, en la prueba pura.
4. Ningún campo existente del informe cambia de nombre ni de tipo, y `finish` sigue
   sin borrar ni podar. — **CUMPLE**: las pruebas de SDD-0457 sobre el inventario
   ignorado y el ciclo de vida siguen verdes sin tocarlas; el bloqueo sigue puesto
   después del informe.
5. El rechazo por disco se conserva. — **CUMPLE**: un worktree registrado que git ya
   llama `prunable` por estar borrado del disco sigue dando exit 1.
6. Una lista vacía se nombra en vez de reventar. — **CUMPLE**: repo bare sin
   vinculados → exit ≠ 0 con «ningún worktree con árbol de trabajo» y sin
   `Cannot read properties`.
7. `pnpm harness:test` en verde. — **CUMPLE**: 12 archivos, 83/83 en Windows.

## Validación (2026-09-12)

| comprobación | resultado |
| --- | --- |
| `node scripts/tests/run-harness.mjs` (Windows) | PASÓ — 12 archivos, 83/83 |
| `eslint` sobre los 2 archivos tocados | PASÓ — 0 problemas |
| `corepack pnpm lint` | PASÓ |
| `corepack pnpm docs:check` | PASÓ — 434 specs, con `origin/main` `147f9561` integrado |
| `corepack pnpm sdd:check` | PASÓ |
| `git diff --check` | PASÓ |
| `finish` real contra `DTD-worktrees/c-l17-verificar-throttle` (solo lectura) | PASÓ — informe con los 4 campos nuevos y los anteriores intactos |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado | ver el handoff: se informa al Director, no se empuja después de publicar |

**Siete mutantes** dejan rojo exactamente la prueba que les toca, con control verde
antes y después: quitar el filtro de `bare`; quitar los cuatro campos del JSON; que
`hasField` mire solo el campo pelado; que mire solo el campo con valor; quitar la
guarda de lista vacía; que `fieldValue` devuelva `undefined` en vez de `null`; y
quitarle el `-z` a `worktrees()` —este último deja rojas tres pruebas, dos de ellas
preexistentes, que es la medida de cuánto sostiene ese flag.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna ruta de
`app/`, `lib/` ni `supabase/` importa este archivo: `playwright`, `typecheck`,
`rsc-boundary`, `components:check`, `governance:check`, `edge:check`, `sql-tests`,
`schema-rebuild` y `migrations-applied` no aplican. Tampoco `/ui-check` (no hay UI) ni
`revisar-datos-ve`: el informe nombra rutas de archivos y razones de lock escritas por
quien bloqueó, nunca contenido de archivos, y no se trata dato personal alguno.

**Una trampa de entorno, ninguna del cambio.** El primer fixture del repo bare se armó
bajo el directorio de scratch de la sesión (~190 caracteres) y `git worktree add`
devolvió `fatal: '$GIT_DIR' too big`: es el límite de ruta de Windows, no el código. La
prueba usa `mkdtempSync(tmpdir())`, que deja las rutas cortas.

## Gobernanza

Cambio de harness: no toca comportamiento de Studio ni la allowlist del
[registro de gobernanza](../../governance/README.md), no captura ni mueve datos
personales, y no lee ni escribe producción. No hay migraciones.

La numeración se reservó con `pnpm sdd:next --reserve harness-worktrees-bare-locked`,
que creó `refs/dtd/reservations/0460` y `refs/heads/codex/sdd-reserve-0460-harness-worktrees-bare-locked`
sobre `origin/main`, sin tocar HEAD; el stub se incorporó a la rama de trabajo con
`git cherry-pick`. La ref de reserva no se publica aparte: la PR lleva la spec, así que
el número ya es visible.

**El primer intento pidió 0460 y el lock lo rechazó.** El inventario dio 0459 libre y
`update-ref` falló con `cannot lock ref 'refs/dtd/reservations/0459': reference already
exists`: otra sesión había reservado 0459 **34 segundos antes** (commit de las 02:23:11,
rama `codex/sdd-reserve-0459-principal-sin-inferir`). El CAS de `prepareReservation` hizo
exactamente lo que existe para hacer y no hubo número duplicado. Queda anotado porque el
nombre de esa reserva, `principal-sin-inferir`, apunta al **mismo supuesto** que esta
spec y a la alternativa que acá se descartó por alcance: quién integra qué es del
Director. Ver el handoff.

## Riesgos y límites

1. **El principal sigue siendo `entries[0]`.** Con el bare descartado la lista solo
   trae worktrees con árbol de trabajo, así que en un repo normal `entries[0]` es el
   principal (medido). En un repo **bare** no hay principal: `entries[0]` pasa a ser el
   vinculado que git liste primero, que es alfabético. Esta spec quita el registro que
   no es checkout de nada; **no** convierte la inferencia en una consulta explícita.
2. **`prunable` es la opinión de git, no una autorización.** El informe la publica y el
   pie dice que no poda. La decisión de borrar sigue siendo del Director, con el paso de
   limpieza del runbook.
3. **`locked` sin razón no dice quién bloqueó.** Git no lo guarda. Un `lockedReason`
   vacío es evidencia de que el bloqueo es deliberado, no de por qué.
4. **La razón del lock la escribe una persona y se imprime cruda.** Llega del porcelain
   `-z` sin escapar. No se interpreta ni se usa para decidir nada, pero es texto ajeno
   dentro de un JSON que alguien puede leer con otro programa.
5. **Heredados de SDD-0457 y sin cambiar acá:** `finish` sigue pidiendo
   `git status --untracked-files=all` para calcular un booleano, y la expansión de
   directorios ignorados colapsados llega a un nivel.
