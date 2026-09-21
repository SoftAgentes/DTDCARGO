# Handoff — El sello AST no prueba que el grafo coincida con el documento

**Rama:** `claude/festive-ellis-03485b` · **Base:** `main` `03eb772a` (se midió sobre
`d9adbabf` y main se movió dos veces: `6e3140b8` y `03eb772a`. Comprobado en cada
vuelta que `project-rules.md` y `knowledge-graphify-obsidian.md` **no cambiaron**,
y que los encabezados citados siguen en L189, L255, L320 y L324 — así que las
cifras de desfase, 131 y 23 líneas, siguen midiendo lo mismo)
**Worktree:** `.claude/worktrees/modest-chaplygin-c2cdee` (claim `festive-ellis-03485b`)
**Fecha:** 2026-09-21 · **Encargo:** del Director — `knowledge:status` informaba
`structural: CURRENT` con 0 pendientes mientras el grafo guardaba los encabezados
de una versión anterior de `docs/engineering/project-rules.md`.

**Sin SDD**: no cambia el comportamiento del producto. El cambio es del harness de
conocimiento (adaptador, pruebas) más documentación.

## La causa, medida

No es la caché semántica. Son **dos comportamientos de Graphify 0.9.61 que se
contradicen**:

1. `watch.py`, `_rebuild_code` (#1915): *«A semantic-backed doc is never
   re-quick-scanned, and any AST layer it already carries coexists and is
   preserved rather than regenerated»*. Un documento que ya tiene **cualquier**
   nodo no-AST con `file_type` en {document, concept, rationale, paper, code}
   sale del conjunto que se reextrae. Su capa de encabezados se arrastra sin
   cambios en cada `graphify update`.
2. `save_manifest(..., kind="ast")` recibe `_ast_manifest_files()`, que es
   `detected["files"]` **completo** menos las fuentes cuya extracción *falló*.
   Una omisión deliberada no es una falla, así que el documento salteado se sella
   igual con el md5 vigente.

`scripts/knowledge-graph.py` deriva `astCurrent` de ese sello
(`manifest[name].ast_hash == md5(archivo)`), y `pending` sale de `astCurrent`. Por
eso `structural: CURRENT` con 0 pendientes convivía con un grafo desfasado.

### Evidencia

**Sobre el grafo real de la raíz** (`main` `d9adbabf`, lectura, sin escribir):

- `manifest.ast_hash` de `project-rules.md` = `60709b33021bde912f6b19eaeede5c9a` =
  md5 del archivo. Sellado como vigente.
- Reextraer el archivo hoy con el extractor fijado da **27 nodos**; el grafo tiene
  **25** nodos AST. Faltan `Contratos que miden…` (L189) y `Cómo se ve uno que sí
  mide` (L255), y los seis encabezados posteriores están **131 líneas** atrás
  (L320→L189, L324→L193, L334→L203, L345→L214, L349→L218, L356→L225).
- Los nodos **semánticos** de ese documento sí están al día: `L189-L206`,
  `L226-L243`, `L245-L254`, `L255-L290`, `L292-L310` corresponden a la sección
  nueva. La capa vieja es la de encabezados, no la semántica.
- **Segundo documento afectado, no reportado en el encargo:**
  `docs/runbooks/knowledge-graphify-obsidian.md`, **23 líneas** atrás en sus ocho
  encabezados (L126→L103 … L286→L263).
- Los 16 documentos «con capa semántica» del grafo son **exactamente** los 16 de
  `semanticPilot.documents` en `scripts/knowledge-policy.json`. El contraste del
  encargo (el guion de smokes sí se refrescó) encaja: no está en el piloto.

**Reproducción aislada** (repo desechable de dos archivos, fuera del repo real):
dos documentos idénticos; a `a.md` se le inyecta **un** nodo semántico y a `b.md`
no; la misma inserción de 40 líneas en los dos; `graphify update .`.

| | nodo semántico | encabezados reales | nodos AST | `astCurrent` |
|---|---|---|---|---|
| `b.md` (control) | no | 47/51/55 | **47/51/55** | `True` |
| `a.md` | uno | 47/51/55 | **5/9/13** (congelados) | `True` |

Una sola variable, efecto reproducible, y **los dos** sellados como vigentes.

## Callejones cerrados (con la medición que los cierra)

- **«La caché semántica sirve el documento y no se vuelve a recorrer»** —
  hipótesis del encargo: **descartada como explicación**. Lo que decide el salteo
  es la presencia de nodos semánticos *en el grafo*, no la caché nativa; el
  predicado está en `watch.py:1513-1533` y lo confirma la reproducción aislada,
  donde el nodo inyectado a mano (sin caché de ningún tipo) alcanza para congelar.
- **`graphify update . --force`**: **no sirve**. Medido en la reproducción: los
  encabezados siguieron congelados e imprimió «No code-graph topology changes
  detected». `--force` solo saltea el control de cantidad de nodos de `to_json`.
- **Reaplicar el recibo semántico**: no lo corrige, y el encargo ya lo decía. La
  razón es que el recibo escribe nodos de la capa **semántica** y las dos capas
  conviven por diseño (`merge_raw_extraction`, reemplazo por tier, #2333/#3411).
- **Comparar por `id` o por `label` incluyendo el nodo de página**: descartado por
  ruidoso. Medido sobre los 1.153 documentos del grafo: `id` da 1.137 falsos
  positivos y `label` 506, porque Graphify reescribe id y etiqueta del nodo de
  página al construir (`aud-02.md` → `policies/aud-02.md`). Excluyendo ese nodo,
  las tres claves quedan exactas.
- **Los 197 `.md` rastreados por git que no tienen ningún nodo**: no son un
  hallazgo; están fuera del corpus detectado (`.claude/`, `.agents/plugins/`).

**Remedio comprobado** (en la reproducción aislada): quitarle la capa semántica al
documento en `graphify-out/graph.json`, correr `graphify update .` y volver a
inyectarla. Los encabezados se refrescaron a 47/51/55. Toca el grafo de la raíz,
así que **lo ejecuta el Director desde el checkout principal**; no lo hice.

## La comprobación

`scripts/knowledge-graph.py inspect` reextrae **cada documento sellado** con el
extractor fijado de Graphify y compara `(etiqueta, línea)` de cada encabezado
contra el grafo. Una diferencia sale en `structural.drifted` y en el aviso
`graph_ast_drift`, que nombra qué encabezado falta y en qué línea está de verdad.
La estructura queda `PENDING` y `record` se niega.

Decisiones, con su porqué:

- **Reextraer, no reimplementar markdown.** Cercas de código, frontmatter y
  encabezados setext son asunto del extractor. Hay precedente en el mismo archivo
  (`extract_json` para el JSON de datos).
- **Clave `(etiqueta, línea)`**, no `id`: los ids se salan en colisión y dependen
  de la forma de la ruta. Medido: 0 falsos positivos en 1.153 documentos.
- **Solo documentos sellados.** Uno no sellado ya sale en `pending` con su remedio
  normal; el desfase es el caso que el sello tapa. Como `CURRENT` exige que todos
  estén sellados, cuando el estado es `CURRENT` **todos** fueron comparados.
- **`drifted` aparte de `pending`**: el remedio no es el mismo. A un pendiente lo
  arregla `graphify update`; a un desfasado no.

### El contrato y sus mutantes

`scripts/tests/knowledge-graph.node.mjs`. Cuatro pruebas: las tres formas de
desfase con un grafo sintético, el nodo de página que no debe leerse como desfase,
el documento sin sellar que no se reporta dos veces, y una **corrida real de
Graphify** que reproduce el congelamiento de punta a punta.

Siete mutantes, el control incluido (`node --test --test-reporter=tap`):

| Mutante | Resultado |
|---|---|
| CONTROL (identidad) | **SOBREVIVE** ✓ (si muriera, el corredor no mide nada) |
| M1 el estado no cambia: se cae `or drifted` | MUERE |
| M2 solo cuenta nodos | MUERE |
| M3 solo compara etiquetas (ignora la línea) | MUERE |
| M4 solo compara líneas (ignora la etiqueta) | MUERE |
| M5 descarta todo nodo con forma de página, no uno | MUERE |
| M6 no se limita a los documentos sellados | MUERE |

**M4 sobrevivió en la primera ronda.** El caso «renombrado» usaba `Detail` →
`Renamed`, y como el orden se calcula sobre la tupla `(etiqueta, línea)`, ese
renombre **reordenaba** la lista y una comparación de solo líneas lo detectaba de
rebote. Se cambió a `Detail` → `Context`: las dos ordenan antes que `Knowledge`,
el orden se conserva y lo único distinto queda siendo el texto. Ahí M4 muere. Es
la disposición infeliz: con la feliz, la aserción parecía alcanzar más lejos de lo
que alcanzaba.

## Validación

| Comprobación | Resultado |
|---|---|
| `node --test scripts/tests/knowledge-graph.node.mjs` | **PASÓ** — 19/19 |
| `knowledge-{semantic-apply,sync,state,graph-repair}.node.mjs` | **PASÓ** — 21/21 |
| Mutantes (7, control incluido) | **PASÓ** — 6 mueren, el control sobrevive |
| `pnpm docs:check` | **PASÓ** — índice sincronizado, 484 specs antes del merge; 485 después |
| `inspect` contra la raíz real | **PASÓ** — `PENDING`, `pending: []`, `drifted` = los dos documentos |
| `pnpm verify` completo | **NO EJECUTADO** — máquina tomada por otra sesión; el diff es harness y documentación, sin producto |
| `pnpm knowledge:status` | **NO EJECUTADO** — llama a `graphify update`; el Director pidió no lanzarlo hoy |

Tres fixtures tenían nodos de documento AST **sin `source_location`** o con uno
inventado. Se corrigieron a la línea que el extractor fijado informa de verdad
(`knowledge-graph`, `knowledge-semantic-apply`, `knowledge-sync`): con la
comprobación puesta, un fixture infiel se lee como desfase. Ninguna aserción se
debilitó.

**Un arreglo extra, obligado:** el adaptador responde JSON con
`ensure_ascii=False` y en Windows un stdout redirigido es cp1252, que no tiene
`→`. Las etiquetas de encabezado que informa el desfase rompían **toda** la
respuesta con un error de codificación. Se fija la codificación de salida en
`main()`. Era una fragilidad latente que este cambio destapó.

## PENDIENTES DE ESTA TAREA

- **Rama publicada sin PR**, por instrucción del Director al cierre del día. Falta
  abrir la PR cuando él lo indique.
- **`pnpm knowledge:status` no se corrió**: necesita `graphify update` y hoy la
  máquina estaba tomada. Queda comprobar que la salida del comando muestra
  `drifted` como se espera (el `inspect` que lo alimenta sí se corrió, con el
  resultado de la tabla).
- **El desfase de los dos documentos no está reparado.** La comprobación lo
  delata; repararlo toca el grafo de la raíz. El remedio está medido y escrito en
  el runbook.
- Este mismo handoff y el runbook editado **aumentan** el desfase de
  `knowledge-graphify-obsidian.md` cuando se integre: es una fuente del piloto y
  le agregué 47 líneas por encima de sus últimos encabezados. Las cifras de este
  documento (131 y 23) son las de `d9adbabf`, antes de mi edición.

## FUERA DE ALCANCE DETECTADO

- **El límite vive en `graphifyy`, no acá.** Que `save_manifest` selle `ast_hash`
  de un documento que `_rebuild_code` decidió **no** reextraer es una
  contradicción del paquete. No lo parcheé, por instrucción del encargo. Si
  alguna vez se reporta aguas arriba, el caso mínimo es la reproducción aislada
  descrita arriba.
- **`graphify update` imprime «Re-extracting code files»** y remite los documentos
  a `/graphify --update` en el asistente. Los documentos markdown **sí** entran en
  esa corrida (`ast_doc_files`), así que el mensaje confunde sobre lo que el
  comando cubre. No lo toqué.

## Impacto documental

- `docs/runbooks/knowledge-graphify-obsidian.md`: sección nueva **«El sello AST no
  prueba que el grafo coincida con el documento»**, con el mecanismo, la tabla de
  lo medido, qué lo delata y el remedio comprobado.
- Graphify estructural/semántico: **no reemitido**. El recibo está atado a la raíz
  y no se emite desde un worktree; el Director lo hace al integrar. Las fuentes
  del piloto que toqué en esta rama son el runbook y este handoff no lo es.
- Archify / `knowledge:visual`: **no aplica**, no cambia el mapa.
- Bóveda de Obsidian: **no publicada**. Exige el checkout principal en `main`.
