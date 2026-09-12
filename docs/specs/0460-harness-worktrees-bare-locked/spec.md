---
sdd: "0460"
title: "`finish` informa lo que git sabe del candidato: locked y prunable, con el disco como árbitro"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0457", "0458", "0459"]
confidencialidad: interno
---

# SDD-0460 — `locked` y `prunable` en el informe de `finish`

> `git worktree list --porcelain` emite `locked` y `prunable` como campos propios de cada
> registro, y el harness los descartaba al parsear. Son exactamente la evidencia que le
> falta al paso de limpieza manual: `locked` dice que alguien marcó el worktree a
> propósito y `prunable` que git ya lo considera desechable. Exponerlos no cuesta una
> llamada nueva a git. El informe los publica **como evidencia, nunca como decisión**: un
> candidato ausente en disco se sigue rechazando por `existsSync`, no por lo que opine git.

## Esta spec se reescribió: su alcance original se retiró

**Ronda 1** (head `03535d16`, [PR #99](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/99))
traía además un segundo cambio: descartar en el parseo el registro del repositorio **bare**,
por simetría con `scripts/next-number.mjs:50`. **Ese cambio introducía una regresión y no se
integró.** El Director lo detectó leyendo el código y pidió medirlo antes de aceptar su
lectura; medido con un repo `--bare` de dos vinculados y el script de `main` como control:

| comando | desde | control (`main` de entonces) | ronda 1 |
| --- | --- | --- | --- |
| `guard` | `aaa-worker` | exit 0 · `Guard OK` | **exit 1 · «el checkout principal no es un workspace de implementación»** |
| `guard` | `zzz-worker` | exit 0 · `Guard OK` | exit 0 · `Guard OK` |
| `claim --dry-run` | `aaa-worker` | exit 0 | **exit 1 · mismo rechazo** |
| `finish <nombre>` | ambos | exit 1 | exit 1 — idéntico |

En un repo bare **todos** los worktrees son vinculados: no hay árbol principal que listar.
Al descartar el `bare`, `entries[0]` pasaba a ser el árbol de un Worker y el harness lo
declaraba checkout principal, rechazándolo en su propio árbol. Y rompía **a uno solo** —el
que ordena primero por ruta—, que es peor que romper a todos: el mismo comando anda desde un
árbol y falla desde su hermano, culpando al workspace de quien lo corre.

**Por qué no lo vieron las pruebas de la ronda 1, que es la lección del episodio.** El
fixture de integración reproducía la disposición **feliz**: el suplente del principal se
llamaba `AAA-principal` justamente para ordenar primero, o sea el acomodo en el que el
defecto no se nota, porque ahí el primer vinculado sí es el que hace de principal. Siete
mutantes morían y **ninguna prueba miraba `guard` en un repo bare**. Peor: la spec de esa
ronda **ya nombraba el mecanismo** en su riesgo 1 —«en un repo bare no hay principal:
`entries[0]` pasa a ser el vinculado que git liste primero, que es alfabético»— y se leyó
como límite residual en vez de regresión activa. Tener el hecho anotado y sacar la conclusión
contraria se parece más a estar cubierto que no haberlo visto: un ítem en Riesgos le dice a
quien lo lea, y al propio autor al revisar, que ese frente ya fue considerado.

[SDD-0459](../0459-principal-sin-inferir/spec.md) resolvió el fondo por la vía correcta:
`mainWorktreeFrom` verifica que el principal sea el árbol cuyo `.git` es el directorio común
y devuelve `null` cuando no hay, y cada consumidor contesta distinto ante el «no sé». Con eso
en `main`, el alcance de esta spec se reduce a lo que sobrevive.

## Decisión

**1. `parseWorktrees(porcelain)`, pura y exportada, conserva todos los registros.** No
descarta ninguno y no reordena: `entries[0]` sigue siendo el primer registro del porcelain,
que es la invariante sobre la que `mainWorktreeFrom` verifica el principal. Quién no es
candidato lo decide cada consumidor con el flag `bare`, que ya existía. Se extrae para poder
fijar el parseo por prueba sobre una salida literal —el registro bare y las dos formas de
`locked` incluidas— sin depender de armar el repo que los produce.

**2. El informe de `finish` suma cuatro campos.** `locked` y `prunable` booleanos,
`lockedReason` y `prunableReason` con la razón que dio git o `null`. Cuatro campos de tipo
estable en vez de dos uniones: un worktree bloqueado **sin** razón es `locked: true` con
`lockedReason: null` —un bloqueo deliberado del que git no guardó motivo—, y eso no puede
leerse igual que «no está bloqueado». Ningún campo existente cambia de nombre ni de tipo.

**3. El disco es el árbitro, y se conserva a propósito.** Un candidato ausente en disco se
sigue rechazando por `existsSync`, **no** por lo que opine git. Ahora el informe puede decir
`prunable: true` y el pie explica que es evidencia y no autorización: si git y el disco
discrepan, manda el disco. `finish` sigue siendo solo informe: no borra, no poda, no publica
y no desbloquea nada; `cleanupAuthorized: false` y el pie sobre limpieza manual del Director
quedan como estaban.

**4. El `-z` es obligatorio para leer las razones.** Medido: sin `-z`, git **cita y escapa en
octal** la razón de un lock con caracteres no ASCII (`locked "el Director lo pidi\303\263"`);
con `-z` la entrega cruda. Lo destapó una aserción de la ronda 1 que releía el formato sin
`-z` y falló. `worktrees()` ya usaba `-z`; ahora hay prueba que lo sostiene.

### Alternativas descartadas

- **Descartar el registro `bare` en el parseo.** Retirado: ver arriba. Bajo la derivación de
  SDD-0459 ya no reproduce la regresión —`guard` rechaza por el principal verificado y no por
  `entries[0]`—, pero tampoco aporta: la entrada bare ya queda fuera de los candidatos por el
  flag, en `guard` y en `resolveCandidate`. El único argumento que quedaba era cerrar la
  asimetría con `next-number.mjs`, que es débil solo, y en contra está que le saca la
  invariante de abajo a `mainWorktreeFrom`.
- **El error con nombre para la lista vacía.** También retirado, y verificado contra `main`:
  en un repo bare sin vinculados el código actual responde «Este repo no tiene checkout
  principal verificable…» con instrucción de qué hacer, y **cero** `Cannot read properties`.
  El mensaje de `main` es mejor que el que traía la ronda 1.
- **Un solo campo por atributo** (`locked: string | null`). No distingue bloqueado sin razón
  de no bloqueado, que es justo la diferencia que importa antes de borrar.
- **Mirar `locked` para rechazar candidatos.** Sería convertir `finish` de informe en
  guardián. La evidencia se publica; la decisión queda del Director.

## Alcance

Solo `scripts/harness-worktree.mjs` y su archivo de pruebas. No toca `app/`, `lib/`,
`supabase/`, el artefacto de la app, el esquema ni `.claude/settings.json`. Sin migraciones.
Integrar a `main` **sí dispara el deploy de producción en Vercel**, porque el `ignoreCommand`
de `vercel.json` no excluye `scripts/**`.

## Criterios de aceptación

1. `parseWorktrees` conserva todos los registros, incluido el `bare`, y en el orden de git. —
   **CUMPLE**: prueba pura sobre seis registros literales; `entries[0]` es el bare con
   `bare: true` y el resto de sus campos en forma negativa.
2. `locked` y `prunable` llegan al informe con su razón, y un bloqueo sin razón no es
   invisible. — **CUMPLE**: end-to-end con `git worktree lock` real, con razón y sin razón; el
   caso `prunable` con razón, en la prueba pura.
3. Los cuatro campos aparecen también en su forma negativa, que es la que se ve casi siempre.
   — **CUMPLE**: un worktree sano informa `[false, null, false, null]`.
4. Ningún campo existente del informe cambia de nombre ni de tipo, y `finish` sigue sin
   borrar ni podar ni desbloquear. — **CUMPLE**: las ocho pruebas preexistentes de SDD-0457,
   0458 y 0459 siguen verdes sin tocarlas, y el bloqueo sigue puesto después del informe.
5. El disco manda sobre la opinión de git. — **CUMPLE**: un worktree que git ya llama
   `prunable` por estar borrado sigue dando exit 1 por `existsSync`, y sigue registrado.
6. `pnpm harness:test` en verde. — **CUMPLE**: 12 archivos, 87/87 en Windows.

## Validación (2026-09-12)

| comprobación | resultado |
| --- | --- |
| `node scripts/tests/run-harness.mjs` (Windows) | PASÓ — 12 archivos, 87/87 |
| `eslint` sobre los 2 archivos tocados | PASÓ — 0 problemas |
| `corepack pnpm lint` | PASÓ — 0 errores (8 warnings preexistentes en `app/`, ajenos) |
| `corepack pnpm docs:check` | PASÓ — 438 specs |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `git diff --check` | PASÓ |
| `corepack pnpm verify` | **NO EJECUTADO** — su paso `e2e` exige Supabase, que esta sesión no tiene |
| CI alojado | ver el handoff: se informa al Director con el `headSha` del check |

**Siete mutantes** dejan rojo exactamente la prueba que les toca, con control verde antes y
después: quitar los cuatro campos del JSON; que `hasField` mire solo el campo pelado; que
mire solo el campo con valor; que `fieldValue` devuelva `undefined`; quitarle el `-z` a
`worktrees()` (deja rojas cinco pruebas, cuatro preexistentes); **descartar el registro bare**
(la regresión de la ronda 1); y que `finish` le crea a git en vez de al disco.

Dato honesto sobre el mutante del `bare`: deja roja **solo la prueba nueva de
`parseWorktrees`**, no las pruebas de repo bare de SDD-0459. Es esperable y vale anotarlo —
bajo la derivación nueva, descartar el bare ya no cambia el resultado de `mainWorktreeFrom`,
así que esas pruebas siguen pasando. O sea: **las pruebas de `main` no atajan por sí solas el
error de la ronda 1**, y la prueba de esta spec es lo que lo fija.

El corredor de mutantes usa `--test-reporter=tap` a propósito: Node 24 usa `spec` por defecto
**también fuera de TTY**, y con `spec` el lector no encuentra nada e informa que los siete
mutantes sobrevivieron. En la ronda 1 eso pasó, y lo delató la corrida de control en ROJO.

**Pruebas de producto que no aplican.** El cambio vive entero en `scripts/harness-worktree.mjs`
y su archivo de pruebas, y ninguna ruta de `app/`, `lib/` ni `supabase/` lo importa:
`playwright`, `typecheck`, `rsc-boundary`, `components:check`, `governance:check`,
`edge:check`, `sql-tests`, `schema-rebuild` y `migrations-applied` no tienen nada que medir
acá. Tampoco `/ui-check` (no hay UI) ni `revisar-datos-ve`: el informe nombra rutas de
archivos y razones de lock, nunca contenido, y no se trata dato personal alguno.

## Gobernanza

Cambio de harness: no toca comportamiento de Studio ni la allowlist del
[registro de gobernanza](../../governance/README.md), no captura ni mueve datos personales, y
no lee ni escribe producción. No hay migraciones.

**Se reescribe el 0460 en vez de reservar un número nuevo.** El número ya estaba gastado —
reservado con `pnpm sdd:next --reserve harness-worktrees-bare-locked`, que creó
`refs/dtd/reservations/0460` y su rama de reserva local sin publicar— y la tarea es
reconocible como la misma: el mismo encargo, la misma función, la misma PR. Lo que cambió es
que una de sus dos mitades se retiró, y esta spec lo declara en vez de esconderlo. Coincide
con la inclinación del Director.

**Choque de reserva, para el registro.** El primer intento pidió 0459 y el CAS lo rechazó
(`cannot lock ref 'refs/dtd/reservations/0459': reference already exists`): otra sesión lo
había reservado 34 segundos antes, y esa sesión produjo justamente SDD-0459, del que esta
spec ahora depende. El lock hizo lo que existe para hacer y no hubo número duplicado.

## Riesgos y límites

1. **`prunable` es la opinión de git, no una autorización.** El informe la publica y el pie
   dice que no poda. La decisión de borrar sigue siendo del Director, con el paso de limpieza
   del runbook.
2. **`locked` sin razón no dice quién bloqueó.** Git no lo guarda. Un `lockedReason` vacío es
   evidencia de que el bloqueo es deliberado, no de por qué.
3. **La razón del lock la escribe una persona y se imprime cruda**, sin escapar, dentro de un
   JSON que alguien puede leer con otro programa. No se interpreta ni decide nada con ella.
4. **El informe no dice nada de los worktrees que no son el candidato.** `locked` y `prunable`
   se publican solo del candidato, así que un barrido de limpieza sigue necesitando correr
   `finish` por cada uno, o leer el porcelain a mano.
5. **Heredados de SDD-0457, sin cambiar acá:** `finish` sigue pidiendo
   `git status --untracked-files=all` para calcular un booleano, y la expansión de directorios
   ignorados colapsados llega a un nivel.
