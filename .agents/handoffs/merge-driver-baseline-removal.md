# Handoff — merge-driver-baseline-removal

- Fecha: 2026-09-11
- Owner / sesión: Worker Claude Code, claim `claude-b55321bd-8f8d-4368-9b89-627e1a45b978` (se libera al cerrar cada ronda)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/merge-driver-baseline-removal`
- Rama: `codex/merge-driver-baseline-removal`, creada con `harness-worktree start` desde
  `ef7b008e`. Antes del primer commit avanzó por fast-forward a `origin/main` `4eedeb8a`
  (#92). En la ronda 2 integró `origin/main` `520db7fb` (#88, #87 y #91) con merge, sin
  rebase (`ef7ef663`). Publicada en `origin` con upstream.
- Base verificada: `520db7fb` (`origin/main` después de `git fetch origin`, con #88 integrada)
- Estado de tarea: lista-para-revision (ronda 2); PR draft [#93](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/93)
- SDD: no aplica; enmienda de ADR-0002. Es harness sin comportamiento de producto, como E1
  y #88.
- Dependencias: ninguna. #88 ya está en main.
- Permisos del encargo: commits selectivos, publicar la rama propia y abrir PR draft. Sam
  indicó hacer la pasada única de la ronda 2 al recibir el aviso del Director. Sin merge
  a main, deploy ni producción. No se leyó ni se escribió ninguna base de datos.
- Último resultado: ronda 2 completa (correcciones documentales, prueba de transición,
  merge de main con #88, reconciliación y validación de la combinación) y push único.
- Siguiente paso: re-revisión del Director y CI hospedado.

## OBJETIVO ORIGINAL

Que el merge semántico de `supabase/migrations-baseline.json` aplique los retiros
unilaterales de `pendingBelowCutoff` cuando el otro lado conserva la entrada igual a la
base, porque el retiro es el acto que registra una aplicación. Debe conservar la unión de
adiciones concurrentes, el conflicto borrado contra edición, el rechazo de claves
duplicadas y la validación de motivos no vacíos. Cuando una rama fusiona main, el orden
debe ser el de main más las adiciones de la rama. Además: evaluar si las filas del índice
`docs/specs/README.md` necesitan la misma semántica, enmendar ADR-0002 y agregar pruebas.

## COMPLETADO

### Ronda 1

- `scripts/merge-generated-records.mjs` (`a6a6f305`):
  - `mergeObjectByKey`: si un lado quita la clave y el otro la conserva igual a la base,
    gana el retiro. Dos retiros coinciden. Borrar contra editar sigue fallando con
    «borrado contra edición». El resto pasa por `mergeValue` como antes: la misma clave
    con motivos distintos da conflicto y la edición unilateral gana.
  - `incomingFirstKeys`: primero las claves del lado entrante (`%B`) en su orden y, al
    final, las que solo trae el lado actual (`%A`), en su orden. Ordena
    `pendingBelowCutoff` y el primer nivel del baseline. `orderedUnionKeys` queda
    intacto: lo usan el índice y las declaraciones.
  - Sin cambios en el parser, las validaciones, el índice, `.gitattributes` ni el
    instalador.
- `scripts/tests/merge-generated-records.node.mjs` (`a6a6f305`): la prueba «una eliminación
  unilateral no puede borrar una entrada del baseline» se reemplaza por cinco nuevas:
  1. el retiro de main gana si la rama conserva la espera, y queda el texto de main más la
     rama byte a byte; en sentido inverso quedan las mismas claves y motivos;
  2. una rama de registro retira su espera aunque main haya cambiado otras (con dos
     retiros coincidentes y la edición de otra espera en main);
  3. borrar contra editar falla cerrado en ambos sentidos, sin tocar `%A`;
  4. el driver rechaza claves duplicadas en la base o en la versión entrante sin tocar
     `%A`; la prueba previa sigue cubriendo la versión actual;
  5. el índice retira la fila de una spec que main renumeró y conserva la de la rama, y
     `build-docs-index --check` pasa sobre el resultado.
- ADR-0002 (`a019a453`): regla 1 y párrafo de evidencia actualizados, fila `Enmiendas`
  y sección «Enmienda 2026-09-11 · retiro unilateral y orden en `pendingBelowCutoff`».

### Ronda 2: revisión del Director (cambios requeridos, solo documentales)

El Director aprobó el algoritmo y el criterio de orden. Cambios hechos:

- **Transición** (`c9efc519`, `d614568e`). Git ejecuta el driver del árbol de la rama que
  se actualiza: el instalador registra una ruta relativa
  (`scripts/install-merge-drivers.mjs:12`) y el merge corre antes de que el árbol reciba
  el driver de main. La primera actualización de una rama creada antes de la enmienda,
  si también cambió el baseline, corre el driver anterior y resucita 0409 y 0418. Una vez
  confirmado ese merge, el driver nuevo trata la espera resucitada como adición de la
  rama. El punto 4 de la enmienda documenta el procedimiento con el driver de main
  (`git -c merge.dtd-generated-records.driver="node \"$drv\" %O %A %B %P" merge origin/main`)
  y su verificación con `git diff origin/main -- supabase/migrations-baseline.json`. La
  prueba nueva lo demuestra: con el driver anterior en el árbol de la rama, 0409 resucita
  y sobrevive a la actualización siguiente; con el driver de main forzado queda el
  texto de main más la rama, byte a byte.
- **Riesgo nuevo** (`d614568e`). Una espera perdida por accidente ahora se retira sin
  aviso y ningún gate del CI lo detecta. Regla de revisión en Consecuencias: todo `-`
  en el diff del baseline contra main fuera de una PR de registro autorizada es una no
  conformidad. No cuenta la coma que gana la última espera cuando se agrega otra.
- **Rebase y cherry-pick** (`d614568e`): se anota que invierten `%A` y `%B`, así que un
  rebase deja el orden de la rama con lo nuevo de main al final.
- **Integración de #88** (`ef7ef663`): merge de `origin/main` sin rebase. ADR-0002 queda
  con una sola fila `Enmiendas` y las dos secciones: primero la de declaraciones, que ya
  estaba en main, y después la de retiro unilateral. El driver y la prueba se fusionaron
  sin conflicto.
- **Reconciliación** (`8dc110f7`): la regla 2 de la enmienda de declaraciones, la sección
  «Interacción conocida con el baseline» y el comentario de `mergeDeclarationEntry` ya no
  dicen que en `pendingBelowCutoff` el retiro unilateral no gana. «Límite y evidencia»
  remite al punto 4 para la primera actualización de una rama antigua.
- **Handoff** (commit que contiene este documento): transición, CI de la ronda 1 como
  NO DISPONIBLE por facturación y validación de la combinación.

Ramas afectadas por la transición, verificadas contra `origin` el 2026-09-11: #75, #76,
#77, #78, #80, #82 y #83 tienen 0409 y 0418 en su baseline y el driver anterior en su
árbol. #87 ya está integrada.

Criterios del encargo:

| Criterio | Evidencia |
|---|---|
| Retiro unilateral cuando el otro lado conserva la entrada igual a la base | pruebas nuevas 1 y 2; ensayo real |
| Unión de adiciones concurrentes | prueba original de ramas independientes y prueba nueva 1 |
| Conflicto borrado contra edición | prueba nueva 3, en ambos sentidos |
| Rechazo de claves duplicadas | prueba original (versión actual) y prueba nueva 4 (base y entrante) |
| Motivos no vacíos | `validateBaseline` sin cambios, sobre las tres versiones y el resultado |
| Orden de main más las adiciones de la rama | prueba nueva 1 (texto exacto) y ensayo real byte a byte |
| Evaluación del índice | decisión abajo y prueba nueva 5 |
| Transición entre driver de la rama y de main | prueba de transición y punto 4 del ADR |
| ADR-0002 | `a019a453`, `d614568e` y `8dc110f7` |

### Decisión sobre el orden y el «lado actual»

El encargo pide preservar el orden del lado actual para las claves existentes y, además,
que al fusionar main desde una rama quede el orden de main más las adiciones de la rama.
En `git merge origin/main` Git pasa la rama como `%A` (lo que el driver llama «actual») y
main como `%B` («entrante»). Tomar literalmente el orden de `%A` deja el orden de la rama y
lo nuevo de main al final, que es el desorden de L22. Implementé el criterio verificable:
el lado entrante fija el orden de sus claves y lo que agrega el lado actual va al final,
en el orden en que la rama lo escribió. El Director lo confirmó en la revisión.

Consecuencia documentada en el ADR: el orden depende del sentido del merge, pero las
claves y los motivos no. En una rama de integración que encadena cabezas de PR, lo que
agrega la cabeza entrante queda antes de lo acumulado; en rebase y cherry-pick se
invierten los papeles. Ningún gate depende del orden.

### Decisión sobre el índice

No cambia. `mergeIndex` ya fusiona cada fila three-way con `mergeValue`, retiro unilateral
incluido, y regenera orden, conteo y huecos. Debe seguir así porque el índice deriva del
árbol de specs, que Git fusiona three-way: si main borra o renumera una spec que la rama no
tocó, la carpeta desaparece y la fila también. Una unión dejaría la fila huérfana y
`docs:check` en rojo. La prueba nueva 5 fija ese comportamiento.

### Ensayo con commits reales

`replay-merge.mjs` (en el scratchpad, sin versionar) extrae con `git show` los tres
lados de cada merge (`%O` = merge-base) y los pasa por el driver anterior y por el nuevo.
No toca ningún worktree.

| Merge (`%A` rama, `%B` main) | Driver anterior | Driver nuevo |
|---|---|---|
| L22 `841f2b48` con `50100cc4` | coincide con main + 0434 | coincide con main + 0434 |
| L22 `968258c5` con `c6c67312` | 0431/0433 antes que 0408/0424/0432 | texto de main + 0434, byte a byte |
| L22 `c8058bcf` con `bbc7493f` (main con #85) | 0409 reaparece primera; 0417 y 0429 al final | texto de main + 0434, byte a byte |
| #87 `00f257e1` con #92 `82e3e8ce` | 0418 reaparece primera | texto de #92 + 0450, byte a byte |
| #87 `00f257e1` con main `4eedeb8a` | 0418 reaparece primera | texto de main + 0450, byte a byte |

El Worker de L22 lo había corregido a mano: `fe7c2c5d` es `c6c67312` más 0434, y el merge
`79298160` quedó en `bbc7493f` más 0434.

## VALIDACIÓN

### Ronda 2, sobre la combinación con #88 (base `520db7fb`, cabeza `8dc110f7` antes de este documento)

| Comprobación | Resultado |
|---|---|
| `harness-worktree guard --owner` | PASÓ antes de cada commit, del merge y del push |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ |
| `node --check scripts/merge-generated-records.mjs` | PASÓ |
| `node --test scripts/tests/merge-generated-records.node.mjs` | PASÓ: 20/20 (10 de esta rama y 10 de #88), también antes de confirmar el merge |
| `corepack pnpm harness:test` | PASÓ: 48/48, 0 omitidas |
| `corepack pnpm exec eslint` sobre el driver y la prueba | PASÓ: 0 errores, 0 avisos |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 425 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; solo choques históricos exentos |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO` |
| `git diff --check origin/main` y `git diff --cached --check` en cada commit | PASÓ |
| Precomprobación con la cabeza previa de #88 (`3cbbb9f3`) en un worktree descartable, ya eliminado | PASÓ: 20/20 y 48/48 |
| `corepack pnpm verify` | NO EJECUTADO: cambio solo de harness (driver, prueba, ADR y handoff). No toca código de producto, SQL, dependencias ni entradas del build, así que typecheck, Vitest, E2E, build, rebuild de schema y `migrations-applied` (ledger de producción) no ejercitan este diff. |
| CI hospedado de la ronda 2 | NO DISPONIBLE al cerrar este documento: corre después del push; el resultado vive en la PR |

### Ronda 1, sobre la base `4eedeb8a` con `a6a6f305` y `a019a453`

| Comprobación | Resultado |
|---|---|
| `node --test scripts/tests/merge-generated-records.node.mjs` | PASÓ: 9/9 (4 previas y 5 nuevas; 1 previa reemplazada) |
| `corepack pnpm harness:test` | PASÓ: 37/37, 0 omitidas |
| ESLint, `docs:check` (423 specs), `sdd:check`, gate, `install --check`, `diff --check` | PASÓ |
| Ensayo con commits reales | PASÓ: tabla anterior |
| Combinación con #88 (`5a33c320`) | Driver y prueba sin conflicto; 18/18 en un worktree descartable, ya eliminado |
| Evaluación del driver de #88 sobre declaraciones | PASÓ para retiros: no resucita en ningún sentido. Orden: ver FUERA DE ALCANCE 1. |
| CI hospedado de la ronda 1 (`a019a453` y `c0038414`) | NO DISPONIBLE por facturación: GitHub no inició el job («recent account payments have failed or your spending limit needs to be increased»), con 0 pasos ejecutados. La corrida de la cabeza de #87 de ese momento tuvo la misma anotación. |

## COMMITS

- `a6a6f305` — `chore(harness): driver dtd-generated-records aplica retiros unilaterales del baseline`
  (driver y pruebas).
- `a019a453` — `docs(harness): ADR-0002 enmienda el retiro unilateral y el orden del baseline`.
- `c0038414` — `docs(handoff): cerrar merge-driver-baseline-removal` (ronda 1).
- `c9efc519` — `chore(harness): prueba la transición del driver entre la rama y main`.
- `d614568e` — `docs(harness): ADR-0002 documenta la transición del driver y el riesgo de retiros`.
- `ef7ef663` — merge de `origin/main` (`520db7fb`, con #88, #87 y #91).
- `8dc110f7` — `docs(harness): reconcilia ADR-0002 y el comentario de declaraciones con el retiro unilateral`.
- Commit que contiene este documento: `docs(handoff): cerrar la ronda 2 de merge-driver-baseline-removal`.

## PR / BRANCH

- PR draft [#93](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/93), base `main`. Sigue
  en draft por indicación del Director.
- Rama `codex/merge-driver-baseline-removal`, publicada sin force; la ronda 2 se publicó
  con un único push después del merge de main.
- Worktree indicado arriba. Merge y deploy: no autorizados, no ejecutados.

## PENDIENTES DE ESTA TAREA

1. Re-revisión del Director y CI hospedado de la ronda 2.

## FUERA DE ALCANCE DETECTADO

1. **Orden de las declaraciones.** La regla 6 de la enmienda de declaraciones usa base
   primero y adiciones ordenadas por id, así que no reproduce el orden de main cuando main
   integró declaraciones fuera de orden. Evaluado con `eval-88-declarations.mjs`
   (scratchpad) contra el driver de `5a33c320`: con `O=[l03]`, `A=[l03,l05]` y
   `B=[l03,l06,l02]` da `[l03,l02,l05,l06]`, y main más la rama sería
   `[l03,l06,l02,l05]`. Con `O=[l03,l01]`, `A=[l03,l01,l04]` y `B=[l01,l06]` da
   `[l01,l04,l06]` en vez de `[l01,l06,l04]`. Es cosmético (el gate no depende del orden).
   El Director decide si lo alinea con el criterio del baseline.
2. **El gate no cruza esperas con el ledger.** `check-migrations-applied` exime toda espera
   (`findMissing`, `scripts/check-migrations-applied.mjs:202`) y la imprime como «sin
   aplicar A PROPÓSITO» (`:351-355`) sin preguntar si ya figura en el ledger. Por eso una
   espera resucitada es invisible. Un aviso «espera ya aplicada» cerraría el hueco también
   para clones sin driver. Toca un script que lee el ledger de producción: tarea aparte.
3. **Worktree de arranque sin uso.** Esta sesión abrió en
   `.claude/worktrees/nervous-tharp-418741` (rama `claude/nervous-tharp-418741`, `ef7b008e`,
   limpio). No se usó para escribir. No se eliminó: queda para decisión de limpieza del
   Director.

## HANDOFF AL DIRECTOR

1. Re-revisa #93 sobre la cabeza publicada: los números esperados sobre la combinación son
   20/20 en la prueba focal y 48/48 en `harness:test`.
2. Transición: al integrar #93, la primera actualización de #75, #76, #77, #78, #80, #82 y
   #83 debe forzar el driver de main según el punto 4 de la enmienda y verificar después
   `git diff origin/main -- supabase/migrations-baseline.json`. Sin eso, la espera
   resucitada queda como adición de la rama; tu control semántico (baseline = main +
   entradas propias) sigue siendo la red, porque GitHub no ejecuta el driver.
3. Desde #93 rige la regla de revisión del baseline: todo `-` fuera de una PR de registro
   autorizada es no conformidad, salvo la coma de la última espera al agregar otra.
4. Clones configurados: no reinstalan, porque el comando del driver no cambia. Clones
   nuevos: `node scripts/install-merge-drivers.mjs`.
5. Cambios compartidos: `scripts/merge-generated-records.mjs`, su prueba y ADR-0002, con
   las secciones de #88 reconciliadas como pediste. No se tocaron
   `supabase/migrations-baseline.json`, `.gitattributes`, el instalador, `quality.yml`,
   SQL ni ramas de otros Workers.
6. Sesiones consumidoras: ninguna conocida para este worktree. El claim se libera al
   cerrar la ronda 2; worktree y rama se conservan.
7. Artefactos del ensayo (`replay-merge.mjs`, `driver-before.mjs`, `driver-pr88.mjs`,
   `eval-88-declarations.mjs`, `pr-body.md` y `pr-body-r2.md`) quedan en el scratchpad de
   la sesión, fuera del repositorio, sin versionar.
