# Handoff — merge-driver-baseline-removal

- Fecha: 2026-09-11
- Owner / sesión: Worker Claude Code, claim `claude-b55321bd-8f8d-4368-9b89-627e1a45b978` (se libera al cerrar)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/merge-driver-baseline-removal`
- Rama: `codex/merge-driver-baseline-removal`, creada con `harness-worktree start` desde
  `ef7b008e`. Antes del primer commit avanzó por fast-forward a `origin/main` `4eedeb8a`
  (merge de #92), como pidió el Director. Publicada en `origin` con upstream.
- Base verificada: `4eedeb8a` (`origin/main` después de `git fetch origin`)
- Estado de tarea: lista-para-revision; PR draft [#93](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/93)
- SDD: no aplica; enmienda de ADR-0002. Es harness sin comportamiento de producto, como E1
  y #88.
- Dependencias: ninguna para revisar. El Director integra #88 primero; después esta rama se
  actualiza con `git merge origin/main`, sin rebase (ver PENDIENTES).
- Permisos del encargo: commits selectivos, publicar la rama propia y abrir PR draft. Sin
  merge a main, deploy ni producción. No se leyó ni se escribió ninguna base de datos.
- Último resultado: implementación, pruebas, ensayo con commits reales, combinación con #88
  y publicación completos.
- Siguiente paso: revisión del Director. Si #88 se integra, hacer merge de `origin/main`
  aquí y reconciliar ADR-0002.

## OBJETIVO ORIGINAL

Que el merge semántico de `supabase/migrations-baseline.json` aplique los retiros
unilaterales de `pendingBelowCutoff` cuando el otro lado conserva la entrada igual a la
base, porque el retiro es el acto que registra una aplicación. Debe conservar la unión de
adiciones concurrentes, el conflicto borrado contra edición, el rechazo de claves
duplicadas y la validación de motivos no vacíos. Cuando una rama fusiona main, el orden
debe ser el de main más las adiciones de la rama. Además: evaluar si las filas del índice
`docs/specs/README.md` necesitan la misma semántica, enmendar ADR-0002 y agregar pruebas.

## COMPLETADO

- `scripts/merge-generated-records.mjs` (`a6a6f305`):
  - `mergeObjectByKey`: si un lado quita la clave y el otro la conserva igual a la base,
    gana el retiro. Dos retiros coinciden. Borrar contra editar sigue fallando con
    «borrado contra edición». El resto pasa por `mergeValue` como antes: la misma clave
    con motivos distintos da conflicto y la edición unilateral gana.
  - `incomingFirstKeys`: primero las claves del lado entrante (`%B`) en su orden y, al
    final, las que solo trae el lado actual (`%A`), en su orden. Ordena
    `pendingBelowCutoff` y el primer nivel del baseline. `orderedUnionKeys` queda
    intacto: lo usan el índice y, en #88, las declaraciones.
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
  y sección «Enmienda 2026-09-11 · retiro unilateral y orden en `pendingBelowCutoff`»,
  con contexto, ensayo real, decisión, consecuencias, alternativas descartadas y
  rollback.

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
| ADR-0002 | `a019a453` |

### Decisión sobre el orden y el «lado actual»

El encargo pide preservar el orden del lado actual para las claves existentes y, además,
que al fusionar main desde una rama quede el orden de main más las adiciones de la rama.
En `git merge origin/main` Git pasa la rama como `%A` (lo que el driver llama «actual») y
main como `%B` («entrante»). Tomar literalmente el orden de `%A` deja el orden de la rama y
lo nuevo de main al final, que es el desorden de L22. Implementé el criterio verificable:
el lado entrante fija el orden de sus claves y lo que agrega el lado actual va al final,
en el orden en que la rama lo escribió. Si la intención era otra, basta cambiar
`incomingFirstKeys` y la prueba nueva 1.

Consecuencia documentada en el ADR: el orden depende del sentido del merge, pero las
claves y los motivos no. En una rama de integración que encadena cabezas de PR, lo que
agrega la cabeza entrante queda antes de lo acumulado. Ningún gate depende del orden.

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

Observado sobre la base `4eedeb8a` con los commits `a6a6f305` y `a019a453`:

| Comprobación | Resultado |
|---|---|
| `harness-worktree guard` / `claim` / `guard --owner` | PASÓ, también antes de cada commit y del push |
| `node scripts/install-merge-drivers.mjs --check` | PASÓ |
| `node --check scripts/merge-generated-records.mjs` | PASÓ |
| `node --test scripts/tests/merge-generated-records.node.mjs` | PASÓ: 9/9 (4 previas y 5 nuevas; 1 previa reemplazada) |
| `corepack pnpm harness:test` | PASÓ: 37/37, 0 omitidas |
| `corepack pnpm exec eslint` sobre el driver y la prueba | PASÓ: 0 errores, 0 avisos |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 423 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; solo choques históricos exentos |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO` |
| `git diff --check` y `git diff --cached --check` en cada commit | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ; solo se necesitó para ESLint |
| Ensayo con commits reales | PASÓ: tabla anterior |
| Combinación con #88 (`5a33c320`) | Driver y prueba: `git merge-tree` limpio; en un worktree descartable sobre el commit combinado `a7520182` (sin publicar), 18/18. El worktree ya se eliminó. ADR: dos conflictos esperados (ver HANDOFF AL DIRECTOR). |
| Evaluación del driver de #88 sobre declaraciones | PASÓ para retiros: no resucita en ningún sentido. Orden: ver FUERA DE ALCANCE 1. |
| `corepack pnpm verify` | NO EJECUTADO: cambio solo de harness (driver, prueba, ADR y handoff). No toca código de producto, SQL, dependencias ni entradas del build, así que typecheck, Vitest, E2E, build, rebuild de schema y `migrations-applied` (ledger de producción) no ejercitan este diff. |
| CI hospedado de la PR | NO DISPONIBLE al cerrar este documento; el resultado vive en la PR. El paso `pnpm harness:test` del workflow corre las nueve pruebas del driver. |

## COMMITS

- `a6a6f305` — `chore(harness): driver dtd-generated-records aplica retiros unilaterales del baseline`
  (driver y pruebas).
- `a019a453` — `docs(harness): ADR-0002 enmienda el retiro unilateral y el orden del baseline`.
- Commit que contiene este documento: `docs(handoff): cerrar merge-driver-baseline-removal`.

## PR / BRANCH

- PR draft [#93](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/93), base `main`.
- Rama `codex/merge-driver-baseline-removal`, publicada sin force:
  `git push -u origin codex/merge-driver-baseline-removal:codex/merge-driver-baseline-removal`.
- Worktree indicado arriba. Merge y deploy: no autorizados, no ejecutados.

## PENDIENTES DE ESTA TAREA

1. Revisión del Director y CI hospedado.
2. Cuando #88 entre a main: `git merge origin/main` en esta rama, sin rebase. Resolver los
   dos conflictos de ADR-0002: una sola fila `Enmiendas` con ambas enmiendas, y conservar
   las dos secciones de enmienda. Actualizar el párrafo «Interacción conocida con el
   baseline» de #88 y el comentario de `mergeDeclarationEntry` («A diferencia de
   `pendingBelowCutoff`, una eliminación unilateral sí gana…»), que dirían lo contrario
   de la regla nueva. Repetir las pruebas del driver (18 esperadas) y `harness:test`.

## FUERA DE ALCANCE DETECTADO

1. **Orden de las declaraciones de #88.** Su driver usa base primero y adiciones ordenadas
   por id, así que no reproduce el orden de main cuando main integró declaraciones fuera
   de orden. Evaluado con `eval-88-declarations.mjs` (scratchpad) contra el driver de
   `5a33c320`: con `O=[l03]`, `A=[l03,l05]` y `B=[l03,l06,l02]` da `[l03,l02,l05,l06]`, y
   main más la rama sería `[l03,l06,l02,l05]`. Con `O=[l03,l01]`, `A=[l03,l01,l04]` y
   `B=[l01,l06]` da `[l01,l04,l06]` en vez de `[l01,l06,l04]`. Es cosmético (el gate no
   depende del orden), pero produce diffs de reordenamiento, como el «fuera de alcance 3»
   del handoff de #88. Reportado al Director; no se tocó.
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

1. Revisa la PR: regla three-way con retiro, orden del lado entrante (ver la decisión sobre
   el «lado actual»), índice sin cambios y enmienda de ADR-0002.
2. Orden acordado: #88 primero. Después actualizo esta rama con `git merge origin/main` y
   hago la reconciliación del PENDIENTE 2. Si esta entra primero, esa misma reconciliación
   pasa a #88.
3. Efecto al integrar: en un clon con el driver instalado, las ramas abiertas que tocan el
   baseline dejan de resucitar esperas y quedan en el orden de main en su próximo
   `git merge origin/main`. Clones nuevos: `node scripts/install-merge-drivers.mjs`. Los
   clones configurados no necesitan reinstalar porque el comando del driver no cambia.
   GitHub sigue sin driver, así que tu control semántico (baseline = main + entradas
   nuevas) sigue siendo la red para ramas actualizadas sin él.
4. Cambios compartidos: `scripts/merge-generated-records.mjs`, su prueba y ADR-0002. No
   se tocaron `supabase/migrations-baseline.json`, `.gitattributes`, el instalador,
   `quality.yml`, SQL ni ramas de otros Workers.
5. Sesiones consumidoras: ninguna conocida para este worktree. El claim se libera al
   cerrar; worktree y rama se conservan.
6. Artefactos del ensayo (`replay-merge.mjs`, `driver-before.mjs`, `driver-pr88.mjs`,
   `eval-88-declarations.mjs` y `pr-body.md`) quedan en el scratchpad de la sesión, fuera
   del repositorio, sin versionar.
