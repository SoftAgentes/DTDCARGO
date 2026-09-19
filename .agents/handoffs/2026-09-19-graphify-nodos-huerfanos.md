# Handoff — Nodos huérfanos y notas de memoria que bloquean `knowledge:status`

- Fecha: 2026-09-19 (UTC). Estado de la tarea: **lista-para-revision**.
- Owner/sesión: `claude-graphify-nodos-huerfanos-52f66bf0` (Claude Opus 5, Worker). Director: sesión
  «Director notificación a workers» (antes `dtdcargo-18`).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/graphify-nodos-huerfanos`, creado con
  `harness-worktree start graphify-nodos-huerfanos`.
- Rama: `codex/graphify-nodos-huerfanos`, desde `origin/main` = `88713e47`. Después se trajo `main` dos
  veces con merge: `aab5a43b` (#163 y #164) y `3bd3aae5` (#165). Ninguno toca archivos de esta tarea.
- SDD: **ninguno nuevo**, por decisión del Director (2026-09-19). No se toca la spec 0471. El registro va en
  este handoff y en la sección del runbook de conocimiento, como se hizo con `graph_virtual_import_targets`.
- Alcance ampliado por el Director a mitad de la tarea: el error `graph_memory_notes` (ver abajo). Es el
  mismo objetivo (desbloquear la publicación) y el mismo archivo.
- Aislamiento comprobado antes de editar: `guard` → `Guard OK`, claim adquirido con el owner de arriba.
  Antes de cada commit y de cada merge se revalidó con `guard --owner`.
- Permisos del encargo: commits en esta rama. Reportar al Director antes de abrir la PR y hacer un solo push.
  **No merge. No producción.** No tocar `main` ni el `graphify-out/` del checkout principal. Corridas
  pesadas con turno del Director.

## OBJETIVO ORIGINAL

Después de `graphify update .`, `knowledge-sync status` da `structural.status = PENDING` con
`deleted: ["@testing-library/react","react"]`: dos nodos AST (`react_react`, `testing_library_react_react`)
sin aristas. Eso bloquea `knowledge:publish` integrado y `knowledge-semantic-apply.py` («structural graph must
be current»). Había que investigar el origen, arreglarlo de forma segura y probada, con control rojo, y
actualizar el runbook.

Aceptación: sobre un grafo con esos dos huérfanos, `knowledge-sync status` da structural CURRENT, y una
fuente borrada de verdad sigue en `deleted`.

## DIAGNÓSTICO

### Los dos huérfanos: colisión de IDs en Graphify 0.9.61

No hubo un archivo que dejara de importar `react`. Los huérfanos salen de una colisión de IDs, y una
extracción completa desde cero los reproduce.

1. `_rescue_js_dynamic_imports` (`graphify/extract.py`, L1718-1826) busca `import("…")` con una expresión
   regular en archivos JS/TS. Para un especificador sin ruta, `_resolve_rescued_specifier` (L1974-1979)
   arma el ID **solo con el último segmento**. `_emit_rescued_import` (L2028-2034) crea un stub con
   `label` y `source_file` igual al especificador y `confidence: EXTRACTED`, sin ubicación.
2. `import("react")` y `import("@testing-library/react")` dan los dos el ID `react`.
3. `_disambiguate_colliding_node_ids` (`graphify/extractors/resolution.py`, L916-1055) ve dos fuentes
   distintas con el mismo ID y renombra los dos: `react_react` y `testing_library_react_react`. Las
   aristas `dynamic_import` de quienes importan siguen apuntando a `react`, porque la clave del remapeo usa la
   fuente de quien importa y no la del stub. El build las descarta por colgantes.
4. Resultado: dos nodos sin ninguna relación. `scripts/knowledge-graph.py` solo tomaba como virtuales los
   stubs que eran destino de una importación, así que estos caían en `structural.deleted`.

Archivos que lo producen, en `main`:

| Archivo | Línea | Qué hace | Origen |
| --- | --- | --- | --- |
| `app/portal/(app)/perfil/page.private-context.test.tsx` | 83 | `await import("react")` | SDD-0341, `8080168c`, 2026-09-11 |
| `app/m/cn/login/qr-login.test.tsx` | 8 | `typeof import("react")` dentro de `vi.mock`: es un tipo de TypeScript, no una importación. La expresión regular lo cuenta igual (**falso positivo**) | SDD-0443, `6254e1f1`, 2026-09-06 |
| `components/document-import/DocumentImportEntry.test.tsx` | 125 y 146 | `await import("@testing-library/react")` | SDD-0473, `dd7078bf` y `02e25f72`, 2026-09-16 |

La colisión empezó cuando entró el tercer archivo: la PR #130 (SDD-0473) llegó a `main` el 2026-09-17 a las
15:48 (-04), en `98a7aca5`. Con solo `react`, el stub conserva su arista y es un destino virtual común.

**Relaciones que el grafo pierde** (la advertencia nueva no las recupera):

1. `app/portal/(app)/perfil/page.private-context.test.tsx` → `react` (`dynamic_import`).
2. `app/m/cn/login/qr-login.test.tsx` → `react` (`dynamic_import`), que además es el falso positivo.
3. `components/document-import/DocumentImportEntry.test.tsx` → `@testing-library/react` (`dynamic_import`).
   Son dos llamadas; el rescate deja una sola arista por archivo.

Evidencia:

- Extracción del Graphify fijado, archivo por archivo: los tres emiten el stub con ID `react` y la arista
  hacia `react`.
- Fixture mínimo de dos archivos con el CLI fijado. Solo con `import("react")`: stub `react` con su arista
  `dynamic_import`, un destino virtual común. Al agregar `import("@testing-library/react")`: `react_react` y
  `testing_library_react_react` quedan sin aristas, 0 aristas `dynamic_import`, y el inspector de `main` da
  PENDING con los dos en `deleted`.
- Fixture de control: si un archivo deja de importar el paquete, `graphify update` retira el stub y no
  queda huérfano. La hipótesis del import retirado queda descartada.
- Grafo nuevo de este worktree (`graphify update .` completo sobre `88713e47`: 36.078 nodos, 66.841 aristas):
  los mismos dos nodos con grado 0. Hay otros 12 stubs con aristas, clasificados como virtuales.
- Grafo real de `main` (graphHash `32b409e6…`, HEAD `1fdb5b0c` en ese momento), leído **en solo lectura**.
  El listado y las fechas de su `graphify-out` y su `git status` quedaron iguales antes y después.
  - Inspector de `main`: `deleted = ["@testing-library/react","react"]`.
  - Inspector de esta rama: `deleted = []`, con la advertencia.

### Notas de `graphify-out/memory/`: un segundo bloqueo en `main`

Al inspeccionar `main` apareció otra causa, independiente de la primera:
`excluded = ["graphify-out/memory/query_20260916_142303_51d20262_que_contratos_debe_preservar_la_correccion_de_perm.md"]`.

- Graphify 0.9.61 **siempre** escanea `graphify-out/memory/` en `update` (`graphify/detect.py`, L1809-1813,
  «Always include graphify-out/memory/»). Ahí guarda respuestas de `graphify query`. No le importa que
  `.graphifyignore` excluya `graphify-out/`.
- `knowledge-graph.py` detecta con un `GRAPHIFY_OUT` temporal, así que nunca ve esa carpeta. El archivo
  existía en disco y en el manifest, pero no en el corpus del inspector, y caía en `excluded` sin causa
  visible.
- En `main` hay un solo archivo: 1.390 bytes, respuesta de `graphify query` del 2026-09-16 (mtime 14:23 UTC).
  Entró al manifest con `seen` del 2026-09-17 20:14 UTC, con 5 nodos AST y 4 aristas.
- Fixture con el CLI fijado: `update` ingiere la nota. Al moverla a `graphify-out/memoria-archivada-20260919/`
  y volver a correr `update`, sale del manifest y del grafo, y el inspector da CURRENT.

## COMPLETADO

- **`scripts/knowledge-graph.py`**
  - Advertencia nueva `graph_orphan_import_stubs` (fuentes y nodos). Cubre solo la huella exacta de la
    colisión:
    - especificador de paquete npm válido, fuera del manifest, del corpus y del disco, sin relaciones
      ancladas en él;
    - un único nodo AST con `label` y `source_file` iguales al especificador, `file_type: code`,
      `confidence: EXTRACTED` y sin `source_location`;
    - ninguna arista ni hiperarista lo menciona;
    - el ID es el que deja la desambiguación: `make_id(especificador, make_id(último segmento))`, con el
      sufijo sha1 de 6 caracteres si hizo falta una segunda vuelta.

    Esas fuentes salen de `absent` y de `graphSourcePaths`, como los destinos virtuales. Cualquier otra forma
    sigue en `deleted` o en `excluded`.
  - Error nuevo `graph_memory_notes`: nombra cada ruta de `graphify-out/memory/` que aparezca en el manifest
    o en el grafo. La estructura queda **INVALID** y la publicación, bloqueada. Esas rutas ya no se mezclan
    con `excluded` ni con `deleted`, y otra ruta de `graphify-out/` sigue en `excluded`.
  - Se evaluó y se descartó reparar el grafo con `knowledge-graph-repair.py`. Cada `graphify update .`
    vuelve a crear los huérfanos, y la aceptación pide CURRENT con ellos presentes. El reparador no se tocó.
- **Pruebas** (`scripts/tests/knowledge-graph.node.mjs`, 5 nuevas; `scripts/tests/knowledge-sync.node.mjs`, 1
  nueva):
  - los dos huérfanos tal como están en `main` dan CURRENT; un archivo borrado cuyo nodo sobrevive sin fila de
    manifest sigue en `deleted`;
  - la huella exacta contra 13 casos de borde, uno por condición, que siguen en `deleted` o en `excluded`;
  - el CLI fijado reproduce la colisión: se pierden las aristas y el inspector advierte los dos stubs;
  - notas de memoria en el manifest y en el grafo, solo en el manifest y solo en el grafo, más una exclusión
    real (`docs/guide.md`) y otra ruta de `graphify-out/` que siguen en `excluded`; `record` se niega;
  - el CLI fijado ingiere la nota, y archivarla más `update` quita el bloqueo;
  - aceptación en `knowledge-sync`: con los huérfanos, `status` da CURRENT y `publish` integrado publica; al
    borrar una fuente de verdad, `status` da PENDING con ella en `deleted` y `publish` se niega con
    `STRUCTURAL_PENDING`.
- **Runbook** `docs/runbooks/knowledge-graphify-obsidian.md` (sección «Versiones y comprobación»):
  - un párrafo sobre los stubs huérfanos que explica la causa, la huella y que no se reparan;
  - un párrafo sobre `graph_memory_notes` con el paso: mover las notas sin borrarlas a
    `graphify-out/memoria-archivada-AAAAMMDD/` y correr `graphify update .`;
  - la lista de pruebas del harness y la fecha de actualización.

## CONSECUENCIAS EXPLÍCITAS PARA LA PUBLICACIÓN

1. **policyHash cambia.** `loadPolicy` incluye `scripts/knowledge-graph.py` en la huella de política. La
   bóveda queda PENDING hasta la próxima publicación.
2. **Cambian dos fuentes de Archify.** `scripts/knowledge-visual-evidence.json` cita
   `scripts/knowledge-graph.py` y el runbook. Hace falta `knowledge:visual` en `main` antes de `publish`. Las
   frases citadas siguen presentes (`structural_names`, `semanticNativeCurrent` y las cuatro del runbook).
3. **Cambia la fuente 15 del piloto** (el runbook). Su recibo semántico es obligatorio para el 16/16. El
   fragmento revisado queda en este worktree:
   - fragmento: `graphify-out/lote-runbook-graphify-nodos-huerfanos.json`, sha256
     `245e8ce1393b3f8cc3720f0ac18c70cf8faf2027afb677be44d2f6522b859f06` (20.289 bytes);
   - revisión: `graphify-out/lote-runbook-graphify-nodos-huerfanos.review.json`, sha256
     `c7ef30b63cf6392bf89d5e77f29e71b6603762b485a4722ee02ad89e463701a7`, con `head` `3902fcfb`;
   - runbook revisado: sha256 `9d61fc1c2a6e975875b868753712f4781d47687310cc052cd8aaab3fbbddc994`. No tiene
     frontmatter YAML; se leyó completo.
   - Contenido: 19 nodos y 25 aristas. Conserva los **17 IDs** que el runbook ya tiene en `main`, porque 15
     aristas de otras fuentes y 3 hiperaristas los usan, con sus ubicaciones movidas a las líneas actuales.
     Agrega `…_stubs_importacion_huerfanos` y `…_notas_memoria_graphify`, y conserva las 4 aristas hacia otros
     documentos: `docs/README.md` y tres nodos de la spec 0471.
   - Al aplicarlo en `main`, el importador exige `head` = HEAD de `main`. Hay que regenerar la revisión con
     ese `head` y comprobar que el sha256 del runbook siga siendo `9d61fc1c…`.

## VALIDACIÓN

| Comprobación | Alcance / SHA | Resultado |
| --- | --- | --- |
| `graphify update .` completo en worktree nuevo | `88713e47` | **PASÓ**: 36.078 nodos, 66.841 aristas y los dos huérfanos reproducidos |
| Inspector de `main` y de esta rama contra el grafo real de `main`, en solo lectura | graph `32b409e6…` | **PASÓ**: el de `main` da `deleted` con los dos; el nuevo da `deleted: []` con la advertencia. `graphify-out` y `git status` de `main`, sin cambios |
| `knowledge-graph.node.mjs` focal | árbol de `d542b7c7` | **PASÓ**: 15/15, 0 omitidas |
| `knowledge-sync.node.mjs` focal | árbol de `057446f6` | **PASÓ**: 7/7, 0 omitidas |
| Los 8 `knowledge-*.node.mjs` | árbol de `d542b7c7` | **PASÓ**: 71/71, 0 omitidas, 54 s |
| Control rojo con las 7 pruebas del patrón de `knowledge-graph` (5 nuevas y 2 previas) | `knowledge-graph.py` de `88713e47` | **FALLÓ, como tenía que fallar**: las 5 nuevas; pasan las 2 previas |
| Control rojo de la memoria | `knowledge-graph.py` de `057446f6` | **FALLÓ, como tenía que fallar**: las 2 de memoria |
| Control rojo de la aceptación en `knowledge-sync` | `knowledge-graph.py` de `main` | **FALLÓ, como tenía que fallar**: `structural.status` PENDING |
| Mutantes: 25 variantes, una por condición de las dos huellas y de las precondiciones | `d542b7c7` | **PASÓ**: 25 de 25 muertos, 0 sobrevivientes |
| `docs:check`, `sdd:check`, `skills:check`, `git diff --check` | `d542b7c7` | **PASÓ**: 475 specs, sin números repetidos, manifest de skills vigente |
| Grafo de este worktree con la capa semántica de `main` copiada en solo lectura y `update` | `3902fcfb` | **PASÓ**: structural CURRENT, `deleted`/`excluded` vacíos, advertencia de los dos stubs |
| El adaptador de `main` sobre ese mismo grafo | `3902fcfb` | **PENDING** con los dos en `deleted`: el importador lo habría rechazado |
| `knowledge-semantic-apply.py --check` con el fragmento del runbook | `3902fcfb` | **PASÓ**: VALIDATED, 19 nodos, 25 aristas |
| Aplicación local del fragmento, `cluster-only` y `status --preview` | `3902fcfb` | **PASÓ**: APPLIED; runbook VERIFIED tras `cluster-only`; structural CURRENT |
| `pnpm harness:test` completo (`node scripts/tests/run-harness.mjs`), en el turno del Director | `20d1ba50` | **PASÓ**: 24 archivos, 197/197, 0 omitidas, exit 0, 1 min 3 s (18:18:21–18:19:25 UTC) |
| `graphify update .` tras el commit del handoff | `0ef8cff4` | **PASÓ**: structural CURRENT |
| `knowledge:visual` y `knowledge:visual:check` con el paquete fijado del lock | `0ef8cff4` | **PASÓ**: Archify 2.16.0 CURRENT, 9/9 comprobaciones. Especificación `6ac8e65e…`, artefacto `c05d1946…`, evidencia `91559709…`. El `archify.zip` se copió del `graphify-out` de `main`, y su sha256 `4c59fa65…` coincide con `scripts/archify.lock.json`. No se descargó nada |
| `knowledge:publish --preview` dos veces | `0ef8cff4` | **PASÓ**: Obsidian PREVIEW en `graphify-out/obsidian-preview`, 1.129 documentos y 40 advertencias de enlaces. La repetición sale `unchanged`. Piloto 1/16 y global 1/1.130: los otros 15 recibos del piloto están atados a la raíz de `main`. Problemas informados: `MAIN_REQUIRED` y `SEMANTIC_PILOT_PENDING`, propios de un worktree |
| Build, DB y E2E de producto | — | **NO EJECUTADO**: no aplican a esta herramienta de documentación (runbook, «Validación y aceptación») |

## COMMITS

| Commit | Propósito |
| --- | --- |
| `057446f6` | `fix(knowledge)`: stubs de `import()` huérfanos por colisión de IDs no son fuentes borradas |
| `d542b7c7` | `fix(knowledge)`: las notas de `graphify-out/memory` bloquean con su propio error |
| `3902fcfb` | merge de `origin/main` `aab5a43b` (#163 y #164), sin conflictos |
| `20d1ba50` | merge de `origin/main` `3bd3aae5` (#165), sin conflictos |
| `0ef8cff4` | handoff: diagnóstico, evidencia y resultado del harness completo |
| commit que contiene este documento | handoff: Archify, preview y procedencia de los derivados |

## PR / BRANCH

- Rama `codex/graphify-nodos-huerfanos`, base `main`, worktree de arriba. PR: pendiente del OK del
  Director, con un solo push.

## PENDIENTES DE ESTA TAREA

- Reportar al Director y, con su OK, hacer el push único y abrir la PR.

Procedencia de los derivados de este worktree (todos en `graphify-out/`, fuera de Git):

- La extracción nueva quedó en `graphify-out/worktree-fresh-20260919/`.
- Después se copiaron en solo lectura el `graph.json` y el `manifest.json` de `main` (graph `32b409e6…`).
  Sobre esa copia se corrió `graphify update .` para validar el fragmento contra la capa semántica real.
- El commit que contiene esta versión solo cambia este documento. Como el handoff es fuente del corpus,
  después de ese commit hace falta otro `graphify update .` para volver a structural CURRENT. En `main` lo
  cubre la publicación del Director.

## FUERA DE ALCANCE DETECTADO

1. **Graphify 0.9.61 aguas arriba.**
   - El ID del stub de un `import()` sin ruta usa solo el último segmento, así que dos paquetes con el mismo
     final (`react` y `@testing-library/react`) pierden sus aristas.
   - El rescate por expresión regular también cuenta `typeof import("x")` de TypeScript.
   - Valdría reportarlo al proyecto o revisarlo al subir de versión. Mientras tanto, el grafo no tiene las
     tres relaciones de arriba.
2. **Codificación de la salida del inspector.** Con la salida redirigida, Python en Windows escribe el JSON de
   `knowledge-graph.py` en cp1252, y `scripts/lib/knowledge-state.mjs` lo lee como UTF-8. Hoy ninguna ruta
   del corpus tiene caracteres fuera de ASCII (0 de 4.323), así que no afecta. Una ruta o advertencia con
   tildes llegaría con U+FFFD. Una salida posible: `PYTHONIOENCODING=utf-8` en el spawn o
   `sys.stdout.reconfigure(encoding="utf-8")`.
3. **Destinos virtuales raros.** `${apuntaA}.js` y `�/page.js` vienen de cadenas de fixtures de prueba. El
   segundo ya trae U+FFFD dentro de `graph.json`. Son advertencias; no se investigaron.
4. **Archivos pendientes en `main`** tras los merges de #163, #164 y #165. Se resuelven con el `graphify
   update .` de la publicación.

## HANDOFF AL DIRECTOR

Publicación desde `main`, después de integrar:

1. Mover `graphify-out/memory/query_20260916_142303_…perm.md` a `graphify-out/memoria-archivada-20260919/`,
   sin borrarlo. Es lo que ya planeaste.
2. `graphify update .` y `knowledge:status`. Esperado: structural CURRENT, advertencia
   `graph_orphan_import_stubs` con `@testing-library/react` y `react`, y sin `graph_memory_notes`.
3. Importar el fragmento del runbook (arriba) con la revisión regenerada para el HEAD de `main`, más tu
   fragmento del README de marketing. Después, `graphify cluster-only . --no-label`.
4. `knowledge:visual`, `knowledge:publish`, `knowledge:check`.

- Sesiones consumidoras de este worktree: ninguna además de esta.
- El claim se libera al terminar la escritura.
- Impacto documental: runbook canónico actualizado; este handoff es documento nuevo fuera del piloto y queda
  como pendiente semántico global visible.
