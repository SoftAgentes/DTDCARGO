---
sdd: "0458"
title: "finish miraba medio universo: los worktrees de .claude/worktrees quedaban fuera de su alcance"
status: done
author: "Claude Code (Worker) para Sam"
created: 2026-09-12
updated: 2026-09-12
supersedes: null
superseded_by: null
related: ["0370", "0444", "0457"]
confidencialidad: interno
---

# SDD-0458 — `finish` resuelve contra la lista real de worktrees

> `node scripts/harness-worktree.mjs finish` armaba la ruta del candidato con
> `worktreePathFor`, así que solo existía para él lo que viviera en
> `<padre-del-checkout>/DTD-worktrees/<slug>`. Los worktrees que crea la app de
> Claude Code viven en `<checkout>/.claude/worktrees/<nombre>` y no eran
> alcanzables por ningún argumento. Los dos mensajes de error —«Slug inválido» y
> «El candidato no es un worktree registrado y disponible»— culpaban a quien
> escribía de algo que el comando directamente no miraba.

## Contexto

Medido por la sesión `admiring-pascal-832793-85` el 2026-09-11 y reproducido en
este worktree el 2026-09-12, antes de tocar nada:

| invocación desde `.claude/worktrees/cranky-yonath-83f00c` | antes | después |
| --- | --- | --- |
| `finish` (sin argumento) | exit 1, «Slug inválido; usa kebab-case seguro.» | exit 0, informe del worktree actual |
| `finish cranky-yonath-83f00c` | exit 1, «El candidato no es un worktree registrado y disponible.» | exit 0, informe |
| `finish c-l17-verificar-throttle` (control en `DTD-worktrees/`) | exit 0, informe | exit 0, informe |
| `finish no-existe` | exit 1, mensaje genérico | exit 1, nombra el pedido y lista los candidatos |
| `finish` desde el checkout principal | exit 1, «Slug inválido» | exit 1, dice que el principal nunca es candidato |

**No es una regresión de SDD-0457.** El control sobre `DTD-worktrees/` pasa
igual antes y después; el defecto es tan viejo como la resolución por ruta
armada, y solo se volvió visible cuando las sesiones empezaron a trabajar en el
contenedor de la app.

**Por qué importa.** De los nueve worktrees vinculados del repo al momento de la
medición, tres viven en `.claude/worktrees/`. Un comando de cierre que ve dos
tercios del universo y llama «inválido» al tercio restante es la misma clase de
verde por omisión que SDD-0457 acaba de quitar de `check-unpublished` y del hook
`Stop`: el resultado no distingue «no hay nada» de «no miré».

## Decisión

**1. El candidato sale de `git worktree list`, no de una ruta armada.**
`resolveCandidate(entries, main, name, cwdRoot)` es pura, exportada y sustituye
al `safeTarget(slug)` que `finish` compartía con `start`. `start` conserva
intacta su resolución por slug —sigue creando siempre en `DTD-worktrees/<slug>`,
que es su contrato— y `finish` pasa a resolver contra la lista real.

**2. Dos contenedores, no uno.** `worktreeContainers(main)` devuelve
`<padre>/DTD-worktrees` y `<checkout>/.claude/worktrees`. Es un **filtro de
pertenencia** aplicado a entradas ya registradas, nunca una fuente de rutas.

**3. Sin nombre, el worktree actual.** Es lo que hacen `guard`, `claim` y
`release`, y es lo que una sesión de la app puede invocar sin averiguar primero
cómo se llama su propio directorio. Ahí no hay ambigüedad que resolver, así que
ese camino no exige contenedor conocido: basta con ser un worktree vinculado de
este repo. El checkout principal nunca es candidato, por ninguna de las dos vías.

**4. El nombre se compara; jamás se concatena.** `path.basename` de cada entrada
registrada contra el nombre recibido (sin distinguir mayúsculas en Windows). Un
`..`, un separador o una ruta absoluta como argumento no pueden señalar nada de
fuera: como mucho no coinciden. Esto no es teórico —ver el mutante M4 en la
validación—: con `path.join(contenedor, nombre)`, un
`../../../DTD-worktrees/codex-wt` pasado desde el contenedor de la app aterriza
exactamente en el otro contenedor.

**5. Un nombre en los dos contenedores es ambiguo y se rechaza** nombrando las
dos rutas, en vez de elegir por orden de la lista.

**6. Los errores dicen qué pasó y enumeran lo que sí existe.** Tres mensajes
distintos —no hay tal worktree / estás en el principal / no se pudo determinar
desde dónde corrés—, cada uno seguido de `Candidatos: …`, o `ninguno`. Un
candidato registrado pero ausente en disco tiene su propio mensaje y sigue
siendo exit 1: el informe no lo inventa.

**7. `finish` sigue siendo solo informe.** No borra worktrees ni ramas, no poda,
no publica. `cleanupAuthorized: false` y el pie sobre limpieza manual del
Director quedan como estaban, y ningún campo del JSON cambia de nombre ni de
tipo. Lo único que cambia en la salida es que `candidate` ahora puede apuntar a
`.claude/worktrees/`; se normaliza con `path.resolve` para conservar los
separadores de la plataforma, porque git devuelve `/` también en Windows.

### Alternativas descartadas

- **Agregar un segundo `worktreePathFor` para el contenedor de la app.** Deja la
  resolución por ruta armada —el defecto real— y duplica el problema en vez de
  quitarlo: el tercer contenedor que aparezca vuelve a fallar igual.
- **Aceptar cualquier worktree registrado, sin filtro de contenedor.** Más
  simple, pero un nombre suelto pasaría a alcanzar árboles arbitrarios del repo.
  Se conserva el filtro para la vía por nombre y se omite solo donde no hay
  ambigüedad: cuando ya estás parado adentro.
- **Aceptar rutas además de nombres.** Reintroduce la concatenación y el
  traversal que la decisión 4 elimina, a cambio de una comodidad que `finish`
  sin argumento ya cubre.
- **Resolver por rama en vez de por directorio.** Las ramas de la app
  (`claude/<slug>`) no coinciden con el nombre del directorio, y el objeto del
  informe es el árbol, no la rama.

## Alcance

Solo `scripts/harness-worktree.mjs`, sus pruebas y documentación. No toca
`app/`, `lib/`, `supabase/`, el esquema, ni `.claude/settings.json`. No hay
migraciones. Integrar a `main` **sí dispara el deploy de producción en Vercel**,
porque el `ignoreCommand` de `vercel.json` no excluye `scripts/**`.

## Criterios de aceptación

1. `finish <nombre>` informa sobre un worktree de `.claude/worktrees/`. —
   **CUMPLE**: medido en el repo real y fijado por prueba en sandbox.
2. `finish <slug>` sobre `DTD-worktrees/` no cambia. — **CUMPLE**: control real
   sobre `c-l17-verificar-throttle` y las pruebas previas siguen en verde sin
   tocarlas.
3. `finish` sin argumento informa sobre el worktree actual, en cualquiera de los
   dos contenedores. — **CUMPLE**: medido y probado desde ambos.
4. Desde el checkout principal falla diciendo el motivo real. — **CUMPLE**.
5. Un candidato inexistente se distingue de «el comando no mira ahí»: el error
   nombra lo pedido y enumera lo disponible. — **CUMPLE**.
6. Un nombre con traversal, separadores o ruta absoluta no resuelve nada. —
   **CUMPLE**: incluidos los dos cruces que sí darían en el blanco si la ruta se
   armara.
7. `finish` sigue sin borrar ni podar. — **CUMPLE**: la prueba verifica que el
   registro y los archivos siguen ahí después del informe.
8. `pnpm harness:test` en verde. — **CUMPLE**: 12 archivos, 83/83.

## Validación (2026-09-12)

| comprobación | resultado |
| --- | --- |
| `corepack pnpm harness:test` (Windows) | PASÓ — 12 archivos, 83/83 |
| `harness-worktree` + `harness-spawn` en Linux (`node:24`) | PASÓ — 9/9 |
| `corepack pnpm docs:check` | PASÓ |
| `corepack pnpm sdd:check` | PASÓ — sin números repetidos |
| `corepack pnpm lint` (eslint) | PASÓ |
| `git diff --check` | PASÓ |
| reproducción y arreglo contra worktrees reales | PASÓ — tabla del Contexto |

**Siete mutantes** dejan rojo exactamente la prueba que les toca: quitar el
contenedor `.claude/worktrees`; que sin nombre deje de mirar el worktree actual;
devolver al checkout principal a la lista de candidatos; armar la ruta con
`path.join(contenedor, nombre)` en vez de comparar el nombre; elegir el primero
ante un nombre ambiguo; volver al mensaje genérico; y dejar de distinguir un
candidato registrado pero ausente en disco. El séptimo sobrevivió en la primera
ronda y la prueba que lo mata se escribió por eso.

**Pruebas de producto que no aplican.** El cambio vive en `scripts/` y ninguna
ruta de `app/`, `lib/` ni `supabase/` lo importa: `playwright`, `typecheck`,
`rsc-boundary`, `components:check`, `governance:check`, `edge:check`,
`sql-tests`, `schema-rebuild` y `migrations-applied` no aplican, igual que
`/ui-check` (no hay UI) y `revisar-datos-ve` (no se trata dato personal alguno:
el informe nombra rutas, nunca su contenido). `pnpm verify` completo quedó
**NO EJECUTADO**: su paso `e2e` exige Supabase, que esta sesión no tiene.

**La corrida en Linux, y el falso rojo que dio primero.** El repo del contenedor
se armó con `git init` y tres archivos, y ahí `harness-spawn` falló su aserción
de que el listado supera 1 KB: el fixture, no el cambio. Con 805 archivos
rastreados (45.637 bytes de listado) pasan las dos suites. Es la misma trampa que
SDD-0457 anotó para el mutante del `cwd`: en un scratch de juguete, lo que falla
es el entorno.

**Un detalle de plataforma que costó una corrida.** La primera versión de la
prueba comparaba rutas como cadenas y fallaba en Windows: `tmpdir()` devuelve la
forma 8.3 (`AKXGEN~1`) y git siempre devuelve la larga. `fs.realpathSync` **no**
expande el 8.3; `fs.realpathSync.native` sí. Es del fixture, no del comando: en
el repo real las dos puntas de cada comparación salen de git.

## Gobernanza

Cambio de harness: no toca comportamiento de Studio ni la allowlist del
[registro de gobernanza](../../governance/README.md), no captura ni mueve datos
personales, y no lee ni escribe producción. No hay migraciones. La numeración se
reservó con `pnpm sdd:next --reserve harness-finish-claude-worktrees`, que creó
`refs/dtd/reservations/0458` y la rama de reserva local; el stub se incorporó a
la rama de trabajo con cherry-pick. La ref de reserva no se publicó aparte: la PR
contiene la spec, así que el número ya es visible.

## Riesgos y límites

1. **La lista de contenedores sigue siendo una lista.** Un tercer contenedor
   —otra herramienta que cree worktrees en otro lado— vuelve a quedar fuera de la
   vía por nombre. Se mitiga sola por el camino sin argumento, que solo exige ser
   un worktree vinculado; ampliarla es agregar una entrada a
   `worktreeContainers`.
2. **`finish` no distingue un worktree bloqueado (`locked`) ni marcado
   `prunable` por git.** Informa igual, y un candidato ausente en disco se
   rechaza por `existsSync`, no por lo que git diga de él. El campo `prunable`
   del porcelain está disponible y **sin usar**.
3. **La ambigüedad se rechaza, no se resuelve.** Si el mismo nombre existe en los
   dos contenedores, la única salida es correr `finish` sin argumento desde el
   árbol que toca.
4. **Nada de esto prueba que un worktree esté libre.** El claim y el informe
   siguen siendo evidencia parcial, y la limpieza sigue siendo manual y del
   Director: [runbook](../../runbooks/codex-engineering.md#cleanup).
5. **`finish` sigue pidiendo `git status --untracked-files=all`** para calcular
   un booleano, tal como quedó en SDD-0457. No cambió acá.
