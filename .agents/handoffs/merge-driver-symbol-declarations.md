# Handoff — merge-driver-symbol-declarations

- Fecha: 2026-09-11
- Owner / sesión: Worker Claude Code, claim `claude-d18bce87-6770-4e8e-a576-63018623eb68` (se libera al cerrar)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/merge-driver-symbol-declarations`
- Rama: `codex/merge-driver-symbol-declarations`, sin upstream
- Base verificada: `07d000970011ee12364e31124ebe4b301f064b40` (`origin/main` después de `git fetch origin`)
- Estado de tarea: lista-para-revision, sin publicar (falta autorización de Sam)
- SDD: no aplica; enmienda de ADR-0002 (ver «Decisión de SDD»)
- Dependencias: ninguna para integrar. Consumidores: integración serial de #75, #76, #77, #78, #82 y #83.
- Permisos del encargo: commits locales. Publicar la rama y abrir PR draft solo con autorización de Sam. Sin merge, deploy ni producción.
- Último resultado: implementación, pruebas, ensayo y cierre documental completos.
- Siguiente paso: autorización de Sam para publicar la rama y abrir la PR draft; después, revisión del Director.

## Decisión de SDD

No se tomó número SDD ni se editó SDD-0450:

1. Es harness sin comportamiento de producto, igual que E1: ADR-0002 declara
   «SDD: no aplica» para este driver.
2. ADR-0002 fija la política del driver y esta tarea la extiende a un tercer
   archivo, así que se enmienda ahí (sección «Enmienda 2026-09-11»).
3. SDD-0450 (`done`) gobierna el contenido del contrato de declaraciones, que no
   cambia. La política de merge no forma parte del gate: enmendarla allí mezcla
   responsabilidades y reabre una spec cerrada.
4. Sin número no hay ID que coordinar. No encontré una sesión Director activa
   identificable; la decisión queda para su revisión en la PR.

## OBJETIVO ORIGINAL

Extender `dtd-generated-records`, o añadir un driver hermano con la misma
política, para `supabase/pending-migration-symbol-declarations.json`: unión de
`degradations` por `id` en orden estable; conflicto real si `schemaVersion` o
`$doc` difieren entre lados o si un mismo id trae contenido distinto; y respeto
three-way, según la base, de la eliminación hecha por un lado, sin resucitar la
entrada.

## COMPLETADO

- `scripts/merge-generated-records.mjs`: el mismo driver atiende la nueva ruta
  (dispatch por `%P`). Reglas:
  - `degradations` three-way por `id`: adiciones distintas se conservan, una
    adición idéntica en ambos lados queda una vez y la edición de un solo lado
    gana según la base;
  - el retiro unilateral gana si la otra rama conserva la entrada igual a la
    base; nunca se resucita;
  - fallan cerrados: mismo id con contenido distinto en ambos lados (dos
    adiciones o dos ediciones) y borrado contra edición;
  - encabezado estricto: `schemaVersion`, `$doc` o cualquier clave fuera de
    `degradations` que difiera entre lados falla, aunque solo una rama lo haya
    cambiado;
  - rechaza JSON inválido, claves duplicadas, `schemaVersion` distinto de 1,
    `degradations` que no sea array, entradas sin `id` string no vacío e ids
    repetidos;
  - orden estable: la base conserva su orden y lo nuevo se agrega ordenado por
    id, independiente del sentido del merge;
  - conflicto: exit 1, mensaje `✖ merge semántico rechazado: conflicto real en …`
    y `%A` intacto (versión actual, archivo sin resolver), igual que el resto del
    driver;
  - `orderedUnionKeys` se apoya ahora en `orderedUnion`, compartido con las
    declaraciones; su comportamiento no cambia.
- `.gitattributes`: tercera regla `merge=dtd-generated-records` y puntero al ADR.
- `scripts/install-merge-drivers.mjs`: sin cambios; no corresponde. Es el mismo
  driver con el mismo comando, así que los clones configurados no reinstalan. La
  configuración vive en el `.git/config` común y ya aplica a todos los worktrees
  de este clon.
- `scripts/tests/merge-generated-records.node.mjs`: fixture de declaraciones en
  el repo temporal y nueve casos nuevos: siete ejecutan merges Git reales en
  repositorios temporales, uno invoca el driver directamente y otro verifica el
  `.gitattributes` real con `git check-attr`:
  1. contrato del `.gitattributes` real: los tres registros usan el driver;
  2. unión por id, adición idéntica colapsada y mismo resultado byte a byte en
     ambos sentidos;
  3. retiro de un lado respetado, en ambos sentidos, sin resucitar;
  4. edición unilateral tomada según la base;
  5. conflicto por `$doc` cambiado en una sola rama;
  6. conflicto por el mismo id agregado con contenido distinto;
  7. conflicto por borrado contra edición;
  8. conflicto por dos ediciones distintas de la misma declaración;
  9. rechazo, sin tocar `%A`, de ids repetidos, claves JSON duplicadas y
     `schemaVersion` 2.
- `docs/architecture/decisions/0002-merge-semantico-registros-generados.md`:
  enmienda con contexto, reglas, interacción con el baseline, límite, evidencia
  y rollback; el rollback general ahora dice tres reglas. `2fd726fe` precisa la
  interacción con lo que mostró el ensayo D.

### Decisiones visibles para revisión

- **Edición unilateral.** Leí «un mismo id trae contenido distinto» como
  contenido distinto que la base no desambigua. Así es el three-way que ya usa
  `mergeValue` y el mismo criterio que el encargo pide para el retiro. Una
  edición legítima, como mover `callSites` tras un refactor, no bloquea la
  unión. Si el Director prefiere el criterio estricto (toda diferencia entre
  lados falla), se cambian `mergeDeclarationEntry` y la prueba «toma la edición
  unilateral».
- **Encabezado sin base.** Se compara solo entre lados, como pide el encargo;
  esto es más estricto que el `mergeValue` del baseline. Hoy las seis PR tienen
  encabezado idéntico al de main, así que no bloquea el bloque C.
- **Versión.** `schemaVersion` distinto de 1 se rechaza: una versión nueva del
  contrato debe actualizar el driver en la misma PR.
- **Orden.** Base primero y lo nuevo ordenado por id, como `orderedUnionKeys`
  del baseline. Un merge da el mismo resultado en ambos sentidos (prueba 2). En
  una serie con merge-bases distintas, la posición, nunca el contenido, puede
  variar si main ganó entradas después de la base de una rama. En el ensayo todas
  las bases tenían `degradations: []` y el resultado fue idéntico en ambos
  órdenes.

## ENSAYO DE MERGE EN REPO TEMPORAL

Clon `git clone --shared --no-checkout` del repositorio en el scratchpad de la
sesión, fuera del repo; las ramas del ensayo existen solo en ese clon y nada se
publica. El driver se instaló en el clon con `node scripts/install-merge-drivers.mjs`.
Heads verificados contra GitHub en el momento del ensayo:

| PR | Lote | Head | Merge-base con main |
|---|---|---|---|
| #75 | L05 | `b7e53696` | `3c610701` |
| #76 | L02 | `092ca77d` | `3c610701` |
| #77 | L06 | `94958f8e` | `3c610701` |
| #78 | L04 | `9755dfe1` | `3c610701` |
| #82 | L01 | `5d6721f9` | `5894538d` |
| #83 | L03 | `bb1ca346` | `07d00097` |

El head de #83 avanzó durante la sesión, de `def49b97` a `bb1ca346`; el ensayo
usó el vigente, igual al de GitHub.

- **A. Antes** (main `07d00097`, `merge: unspecified` para el archivo). #75
  entra limpio porque solo un lado cambió el archivo. #76, #77, #78, #82 y #83
  fallan con `CONFLICT (content)`; en cada uno el único archivo sin resolver es
  `supabase/pending-migration-symbol-declarations.json`.
- **B. Después** (rama con `40721b4d`, `merge: dtd-generated-records`), orden
  #75 → #83. Los seis merges salen con exit 0 y el driver actúa en las
  declaraciones desde #76. Resultado: `l01 … l06` en orden de id. Cada entrada es
  idéntica a la de su PR, el encabezado coincide y el formato es el canónico de
  `JSON.stringify(…, null, 2)`, sin ruido de reformateo.
- **B'. Orden inverso** #83 → #75. Seis merges con exit 0 y declaraciones
  idénticas byte a byte a B. El árbol completo solo difiere en la posición de una
  clave del baseline (fuera de alcance 3).
- **Gate sobre la unión B.** Exit 2:
  `l03-portal-advisor-pending-rpc: app/portal/(app)/page.tsx:123 no contiene la evidencia declarada`.
  #83 aislada da `0 ROJO · 1 AMARILLO`. #76 (+2 −5) y #83 (+3 −5) editan ese
  archivo y en la unión el fragmento queda en la línea 120. Con solo ese ancla
  corregido en el clon, sin commit, el árbol unido da `0 ROJO · 6 AMARILLO`,
  exit 0. El driver resuelve el choque textual del registro; los anclajes a
  líneas de código siguen siendo tarea del gate (fuera de alcance 2).
- **C. Retiro real.** Base `70a88a19`, con la declaración
  `l16-portal-address-delete-pending-command` y las esperas
  `0425_portal_delivery_addresses_tenant_boundary` y
  `0427_portal_delete_delivery_address_command`. Un lado reproduce el retiro de
  `b49f1c0b` y el otro agrega la declaración y la espera `0405_…` de #75. Merge
  con exit 0 a través del driver: declaraciones `[l05-portal-profile-private-context-pending-rpc]`
  y L16 no resucita. En el baseline, 0425 y 0427 siguen en `pendingBelowCutoff`.
- **D. Interacción preexistente.** El mismo retiro contra una rama que solo edita
  el motivo de `0409_bank_reconciliation_rbac`. Las declaraciones no pasan por el
  driver (solo cambió un lado), el baseline resucita 0425 y 0427, y el gate da
  ROJO `delete_portal_delivery_address` en `app/portal/(app)/perfil/address-actions.ts:131`,
  exit 1 (fuera de alcance 1).

## VALIDACIÓN

Observado sobre la base `07d00097` y los commits `40721b4d`, `2fd726fe` y `8ee7a475`:

| Comprobación | Resultado |
|---|---|
| `node scripts/harness-worktree.mjs guard` / `claim` / `guard --owner` | PASÓ, también antes de cada commit |
| `corepack pnpm harness:test` antes del cambio | PASÓ: 33/33 |
| `node scripts/install-merge-drivers.mjs --check` antes y después | PASÓ |
| `node --check scripts/merge-generated-records.mjs` | PASÓ |
| `node --test scripts/tests/merge-generated-records.node.mjs` | PASÓ: 14/14 (5 previos + 9 nuevos) |
| `corepack pnpm harness:test` después del cambio | PASÓ: 42/42 en 7 archivos, 0 omitidos |
| `corepack pnpm exec eslint` sobre driver y prueba | PASÓ: 0 errores, 0 avisos |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 416 specs |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; solo choques históricos exentos |
| `node scripts/check-pending-migration-symbols.mjs` en la rama | PASÓ: `0 ROJO · 0 AMARILLO`; el contrato del archivo no cambia |
| `git diff --check` y `git diff --cached --check` | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ: lockfile sin cambios; aviso preexistente de `pnpm.onlyBuiltDependencies` |
| Ensayo de merge en repo temporal | PASÓ para el driver: A reproduce el choque en 5 de 6 PR; B y B' unen las seis con exit 0 y declaraciones idénticas; C respeta el retiro. El gate sobre la unión da exit 2 por un ancla de L03 que ajusta la PR (fuera de alcance 2); D confirma la interacción del baseline (fuera de alcance 1). |
| `corepack pnpm verify` | NO EJECUTADO: cambio solo de harness (driver, su prueba, `.gitattributes` y ADR). No toca código de producto, SQL, dependencias ni entradas del build; typecheck, Vitest, E2E, build, rebuild de schema y `migrations-applied` no ejercitan este diff. |
| CI hospedado `Calidad local sin secretos` | NO DISPONIBLE: la rama no está publicada. Cuando se publique, su paso `pnpm harness:test` descubre `merge-generated-records.node.mjs` y corre los nueve casos nuevos. |

## COMMITS

- `40721b4d` — `chore(harness): driver dtd-generated-records une declaraciones de símbolos pendientes`
  (driver, pruebas, `.gitattributes` y enmienda de ADR-0002).
- `2fd726fe` — `docs(harness): ADR-0002 precisa la interacción con el baseline según el ensayo`.
- `8ee7a475` — `chore(harness): prueba el conflicto por dos ediciones distintas de una declaración`.
- Commit que contiene este documento: handoff de la tarea.

## PR / BRANCH

- Rama local `codex/merge-driver-symbol-declarations`, base `main` en `07d00097`,
  worktree indicado arriba.
- Sin publicar: no hay rama remota ni PR. Con autorización de Sam:
  `git push -u origin codex/merge-driver-symbol-declarations:codex/merge-driver-symbol-declarations`
  y `gh pr create --base main --head codex/merge-driver-symbol-declarations --draft`.
- Merge y deploy: no autorizados, no ejecutados.

## PENDIENTES DE ESTA TAREA

- Publicar la rama y abrir la PR draft cuando Sam lo autorice. Hasta entonces no
  hay respaldo remoto ni corrida de CI hospedada.

## FUERA DE ALCANCE DETECTADO

1. **La regla del baseline resucita esperas retiradas.** ADR-0002, regla 1: en
   `pendingBelowCutoff` la eliminación unilateral no gana. Si una rama registra
   la aplicación de una migración (retira su espera y su declaración, como
   `b49f1c0b`) y se fusiona con el driver contra otra rama que también cambió el
   baseline, la espera vuelve. En el ensayo D reaparecen 0425 y 0427 y el gate da
   ROJO `delete_portal_delivery_address`. Sin código alcanzable que use los
   símbolos, ese gate no lo vería. `check-migrations-applied` tampoco: imprime
   cada espera como «sin aplicar A PROPÓSITO» sin cruzarla con el ledger
   (`scripts/check-migrations-applied.mjs:351-355`). Afecta a cualquier registro
   que retire una espera ya presente en main mientras otra rama que toca el
   baseline se integra localmente. Requiere decisión del Director sobre esa
   regla; aquí no se cambió.
2. **Ancla por línea compartida entre #76 y #83.** Ambas editan
   `app/portal/(app)/page.tsx`. Con las dos integradas, la evidencia de L03
   `app/portal/(app)/page.tsx:123` (`getPortalAdvisor(supabase).catch(() => null)`)
   queda en la línea 120 y `check-pending-migration-symbols` sale con exit 2. La
   PR que se integre en segundo lugar debe reanclar esa evidencia en su rama.
   Corregido solo ese ancla, la unión de las seis da `0 ROJO · 6 AMARILLO`.
3. **Orden de claves del baseline según el orden de integración.** Con
   merge-bases distintas, el driver E1 deja las mismas claves y motivos en otro
   orden: en el ensayo, `0431_portal_post_message_principal_tenant` cambia de
   posición entre B y B'. Es cosmético (los gates no dependen del orden), pero
   produce diffs de reordenamiento.

## HANDOFF AL DIRECTOR

1. Revisa las decisiones visibles: edición unilateral three-way, encabezado
   estricto sin base, versión 1 y orden base-primero.
2. Para que la serie del bloque C lo aproveche, esta PR debe entrar a main (o a
   la rama de integración) antes de fusionar la segunda PR que toca el archivo.
   Este clon no necesita reinstalar: `merge.dtd-generated-records` ya está en su
   `.git/config` común. En clones nuevos: `node scripts/install-merge-drivers.mjs`.
   El merge hospedado de GitHub no usa el driver: si marca conflicto, actualiza
   la rama en un clon configurado con `git merge origin/main`.
3. Después de cada merge serial, corre `node scripts/check-pending-migration-symbols.mjs`:
   el driver no valida sitios ni evidencia. Cuando convivan #76 y #83, espera el
   exit 2 de L03 (fuera de alcance 2).
4. Decide sobre la regla del baseline (fuera de alcance 1) antes de los
   registros que retiren esperas ya presentes en main.
5. Cambios compartidos: `scripts/merge-generated-records.mjs`, `.gitattributes`
   y ADR-0002. No se tocaron `supabase/pending-migration-symbol-declarations.json`,
   el gate, SDD-0450, `quality.yml` ni ramas de otros Workers.
6. Sesiones consumidoras: ninguna conocida para este worktree. El claim se
   libera al cerrar; worktree y rama se conservan.
7. Los artefactos del ensayo (clon descartable, `rehearsal.sh`,
   `rehearsal-helper.mjs` y `rehearsal.log`) quedan en el scratchpad de la
   sesión, fuera del repo, y no se versionan.
