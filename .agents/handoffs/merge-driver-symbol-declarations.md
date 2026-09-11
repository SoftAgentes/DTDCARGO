# Handoff — merge-driver-symbol-declarations

- Fecha: 2026-09-11
- Owner / sesión: Worker Claude Code, claim `claude-d18bce87-6770-4e8e-a576-63018623eb68` (se libera al cerrar)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/merge-driver-symbol-declarations`
- Rama: `codex/merge-driver-symbol-declarations`, publicada en `origin` con upstream
- Base verificada: `07d000970011ee12364e31124ebe4b301f064b40` (`origin/main` después de `git fetch origin`). A pedido del Director (H2) se actualizó con `git merge origin/main` en `4eedeb8a` (merge `f32c467c`, 37 commits, sin solapamiento de archivos).
- Estado de tarea: lista-para-revision; PR draft [#88](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/88) con la revisión del Director aplicada
- SDD: no aplica; enmienda de ADR-0002 (ver «Decisión de SDD»)
- Dependencias: ninguna para integrar. Consumidores: integración serial de #75, #76, #77, #78, #82 y #83. Según la revisión del Director, #88 entra antes que #93.
- Permisos del encargo: commits locales; el 2026-09-11 Sam autorizó publicar la rama y abrir la PR draft, y activó Auto-fix en #88. Sin merge, deploy ni producción; la PR sigue en draft.
- Último resultado: revisión del Director aplicada (H1, H2 y la prueba opcional H4) y validada sobre el árbol unido con main.
- Siguiente paso: el Director revisa el SHA nuevo y relanza el CI cuando se desbloquee la facturación de GitHub Actions.

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
  el repo temporal y diez casos nuevos: ocho ejecutan merges Git reales en
  repositorios temporales, uno invoca el driver directamente y otro verifica el
  `.gitattributes` real con `git check-attr`:
  1. contrato del `.gitattributes` real: los tres registros usan el driver;
  2. unión por id, adición idéntica colapsada y mismo resultado byte a byte en
     ambos sentidos;
  3. retiro de un lado respetado, en ambos sentidos, sin resucitar;
  4. retiro de la misma declaración en ambas ramas (H4);
  5. edición unilateral tomada según la base;
  6. conflicto por `$doc` cambiado en una sola rama;
  7. conflicto por el mismo id agregado con contenido distinto;
  8. conflicto por borrado contra edición;
  9. conflicto por dos ediciones distintas de la misma declaración;
  10. rechazo, sin tocar `%A`, de ids repetidos, claves JSON duplicadas y
      `schemaVersion` 2.
- `docs/architecture/decisions/0002-merge-semantico-registros-generados.md`:
  enmienda con contexto, reglas, interacción con el baseline, límite, evidencia
  y rollback; el rollback general ahora dice tres reglas. `2fd726fe` precisa la
  interacción con lo que mostró el ensayo D, y `b24682c4` agrega la guía para
  ramas creadas antes de la enmienda (H1).

### Decisiones visibles para revisión

El Director ratificó en su revisión (H3) la edición unilateral y el encabezado
estricto.

- **Edición unilateral.** Leí «un mismo id trae contenido distinto» como
  contenido distinto que la base no desambigua. Así es el three-way que ya usa
  `mergeValue` y el mismo criterio que el encargo pide para el retiro. Una
  edición legítima, como mover `callSites` tras un refactor, no bloquea la
  unión.
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
  #75 → #83. Sentido: cada head de PR se integra **dentro** de la rama que ya
  tiene el driver, como hace el Director hacia main. Los seis merges salen con
  exit 0 y el driver actúa en las declaraciones desde #76. Resultado:
  `l01 … l06` en orden de id. Cada entrada es idéntica a la de su PR, el
  encabezado coincide y el formato es el canónico de `JSON.stringify(…, null, 2)`,
  sin ruido de reformateo.
- **B'. Mismo sentido, orden inverso** #83 → #75. Seis merges con exit 0 y
  declaraciones idénticas byte a byte a B. El árbol completo solo difiere en la
  posición de una clave del baseline (fuera de alcance 3).
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
- **E. Sentido contrario: una rama antigua absorbe main (H1).** `main-sim` =
  #88 (`5a33c320`) + #76. En #75, que no tiene la regla ni el driver nuevo,
  `git merge main-sim` sale con exit 1: el baseline y el índice se fusionan con
  el driver anterior y las declaraciones quedan en `CONFLICT (content)`. Después
  de ese merge el árbol ya trae la regla y el driver nuevos:
  `git checkout -m -- supabase/pending-migration-symbol-declarations.json`
  imprime `✓ merge semántico` y deja `[l02-…, l05-…]`, y el archivo sigue sin
  resolver hasta `git add`. `git diff main-sim -- supabase/migrations-baseline.json`
  solo muestra la espera propia `0405_…`. Si la rama antigua cambió `$doc`,
  `git checkout -m` imprime `✖ merge semántico rechazado`, sale con exit 0 y deja
  el archivo igual a la versión propia, sin marcadores y sin resolver: un
  `git add` a ciegas perdería el lado de main.

## VALIDACIÓN

Observado sobre la base `07d00097` y los commits `40721b4d`, `2fd726fe` y
`8ee7a475`; tras el merge con main (`f32c467c`), sobre `c9069960` y `b24682c4`:

| Comprobación | Resultado |
|---|---|
| `node scripts/harness-worktree.mjs guard` / `claim` / `guard --owner` | PASÓ, también antes de cada commit |
| `corepack pnpm harness:test` antes del cambio | PASÓ: 33/33 |
| `node scripts/install-merge-drivers.mjs --check` antes y después | PASÓ |
| `node --check scripts/merge-generated-records.mjs` | PASÓ |
| `node --test scripts/tests/merge-generated-records.node.mjs` | PASÓ: 15/15 (5 previos + 10 nuevos), sobre el árbol unido con main |
| `corepack pnpm harness:test` después del cambio | PASÓ: 43/43 en 7 archivos, 0 omitidos, sobre el árbol unido con main (42/42 antes del merge) |
| `corepack pnpm exec eslint` sobre driver y prueba | PASÓ: 0 errores, 0 avisos |
| `corepack pnpm docs:check` | PASÓ: índice sincronizado con 423 specs tras el merge con main (416 antes) |
| `corepack pnpm sdd:check` | PASÓ: sin números repetidos; solo choques históricos exentos |
| `node scripts/check-pending-migration-symbols.mjs` | PASÓ: `0 ROJO · 0 AMARILLO`, también sobre el árbol unido con main |
| `git merge origin/main` en `4eedeb8a` | PASÓ: sin conflictos; el diff contra `origin/main` se limita a los 5 archivos de la tarea y baseline, índice y declaraciones quedan idénticos a main |
| `git diff --check` y `git diff --cached --check` | PASÓ |
| `corepack pnpm install --frozen-lockfile` | PASÓ: lockfile sin cambios; aviso preexistente de `pnpm.onlyBuiltDependencies`; main no cambió dependencias |
| Ensayo de merge en repo temporal | PASÓ para el driver: A reproduce el choque en 5 de 6 PR; B y B' unen las seis con exit 0 y declaraciones idénticas; C respeta el retiro; E confirma la guía de H1 y el exit 0 de `git checkout -m` ante un rechazo. El gate sobre la unión da exit 2 por un ancla de L03 que ajusta la PR (fuera de alcance 2); D confirma la interacción del baseline (fuera de alcance 1). |
| `corepack pnpm verify` | NO EJECUTADO: cambio solo de harness (driver, su prueba, `.gitattributes` y ADR). No toca código de producto, SQL, dependencias ni entradas del build; typecheck, Vitest, E2E, build, rebuild de schema y `migrations-applied` no ejercitan este diff. |
| CI hospedado de #88 | PASÓ sobre `5a33c320`: run [34631241098](https://github.com/hailuwaycom-sketch/DTDCARGO/actions/runs/34631241098), workflow `Calidad continua`, job `Calidad local sin secretos`, evento `pull_request`, `success`; según la revisión del Director, sobre la combinación con `bbc7493f`. NO DISPONIBLE para el head nuevo: el CI está bloqueado por la facturación de GitHub Actions y el Director relanza los runs. |

## COMMITS

- `40721b4d` — `chore(harness): driver dtd-generated-records une declaraciones de símbolos pendientes`
  (driver, pruebas, `.gitattributes` y enmienda de ADR-0002).
- `2fd726fe` — `docs(harness): ADR-0002 precisa la interacción con el baseline según el ensayo`.
- `f2fd88ed` — `docs(handoff): cerrar merge-driver-symbol-declarations con ensayo y evidencia`.
- `8ee7a475` — `chore(harness): prueba el conflicto por dos ediciones distintas de una declaración`.
- `56da11c2` — `docs(handoff): registrar la prueba de dos ediciones distintas en merge-driver-symbol-declarations`.
- `5a33c320` — `docs(handoff): registrar PR #88 y la evidencia viva de 0409 en merge-driver-symbol-declarations`.
- `f32c467c` — `Merge remote-tracking branch 'origin/main' into codex/merge-driver-symbol-declarations`
  (H2, main en `4eedeb8a`).
- `c9069960` — `chore(harness): prueba el retiro de la misma declaración en ambas ramas` (H4).
- `b24682c4` — `docs(harness): ADR-0002 guía para ramas creadas antes de la enmienda` (H1).
- Commit que contiene esta versión del documento: revisión del Director aplicada.

## PR / BRANCH

- Rama `codex/merge-driver-symbol-declarations`, base `main`, worktree indicado
  arriba; actualizada con main en `4eedeb8a` (`f32c467c`).
- Publicada con autorización de Sam, sin force:
  `git push -u origin codex/merge-driver-symbol-declarations:codex/merge-driver-symbol-declarations`.
- PR draft [#88](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/88). Al
  abrirla (head `56da11c2`) GitHub la reportó `MERGEABLE` y `BEHIND`; el merge
  con main resuelve el `BEHIND`. El cuerpo de la PR incluye la guía de H1.
  Auto-fix activo.
- Merge y deploy: no autorizados en esta tarea, no ejecutados.

## PENDIENTES DE ESTA TAREA

- Ninguno de implementación. El CI del head nuevo espera el desbloqueo de la
  facturación de GitHub Actions; el Director relanza los runs y Auto-fix avisa si
  algo falla.

## FUERA DE ALCANCE DETECTADO

1. **La regla del baseline resucita esperas retiradas.** ADR-0002, regla 1: en
   `pendingBelowCutoff` la eliminación unilateral no gana. Si una rama registra
   la aplicación de una migración (retira su espera y su declaración, como
   `b49f1c0b`) y se fusiona con el driver contra otra rama que también cambió el
   baseline, la espera vuelve. En el ensayo D reaparecen 0425 y 0427 y el gate da
   ROJO `delete_portal_delivery_address`. Sin código alcanzable que use los
   símbolos, ese gate no lo vería. `check-migrations-applied` tampoco: imprime
   cada espera como «sin aplicar A PROPÓSITO» sin cruzarla con el ledger
   (`scripts/check-migrations-applied.mjs:351-355`).
   **Ya ocurre:** #85 retiró `0409_bank_reconciliation_rbac` de main
   (`bbc7493f`). Al actualizar #75 con ese main en un clon configurado, 0409
   vuelve a `pendingBelowCutoff` sin conflicto. Como 0409 no crea funciones,
   tablas, vistas ni columnas, el gate queda en `0 ROJO · 1 AMARILLO` y ningún
   control lo detecta. Afecta a toda rama que parta de antes de un registro así,
   haya tocado el baseline y se actualice con `git merge origin/main` en un clon
   configurado, y a los merges locales del Director. Según su revisión, el
   Director corrige esa regla en #93, que entra después de #88 y reconcilia
   ADR-0002, el comentario de `mergeDeclarationEntry` y la prueba 3; aquí no se
   cambió.
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

1. Revisa el SHA nuevo de #88. Quedaron aplicados H1 (guía para ramas antiguas
   en ADR-0002, en este handoff y en la PR), H2 (merge con main en `4eedeb8a` y
   CI `34631241098` registrado) y H4 (prueba del retiro en ambas ramas). H3
   ratificó la edición unilateral y el encabezado estricto.
2. Integración: esta PR entra antes de la segunda PR que toque el archivo y antes
   de #93. Este clon no necesita reinstalar: `merge.dtd-generated-records` ya
   está en su `.git/config` común. En clones nuevos:
   `node scripts/install-merge-drivers.mjs`. El merge hospedado de GitHub no usa
   el driver.
3. **Ramas creadas antes de #88 (H1).** En una rama creada antes de esta
   enmienda, el primer `git merge origin/main` deja el archivo en conflicto
   textual y fusiona el baseline con el driver anterior. Resolver con
   `git checkout -m -- supabase/pending-migration-symbol-declarations.json` y
   `git add`, y verificar el baseline contra origin/main. Antes de `git add`,
   confirma que `git checkout -m` imprimió `✓ merge semántico`: sale con exit 0
   aunque el driver rechace y, en ese caso, deja la versión propia sin
   marcadores (ensayo E). `git diff origin/main -- supabase/migrations-baseline.json`
   debe mostrar solo las esperas propias de la rama; si reaparece una retirada,
   como 0409, hay que quitarla (fuera de alcance 1). Integrar una rama antigua
   **dentro** de main, como en el ensayo B, sí usa el driver nuevo.
4. Después de cada merge serial, corre `node scripts/check-pending-migration-symbols.mjs`:
   el driver no valida sitios ni evidencia. Cuando convivan #76 y #83, espera el
   exit 2 de L03 (fuera de alcance 2).
5. Cambios compartidos: `scripts/merge-generated-records.mjs`, `.gitattributes`
   y ADR-0002. No se tocaron `supabase/pending-migration-symbol-declarations.json`,
   el gate, SDD-0450, `quality.yml` ni ramas de otros Workers.
6. Sesiones consumidoras: ninguna conocida para este worktree. El claim se
   libera al cerrar; worktree y rama se conservan.
7. Los artefactos del ensayo (clon descartable, `rehearsal.sh`,
   `rehearsal-helper.mjs` y `rehearsal.log`) quedan en el scratchpad de la
   sesión, fuera del repo, y no se versionan.
