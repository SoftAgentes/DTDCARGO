# Conocimiento con Director, Graphify, Archify y Obsidian

Dueño: Director de ingeniería · Estado: vigente al integrarse · Actualizado: 2026-09-19 · SDD: 0471.

## Autoridad y conservación

Git conserva documentos canónicos, decisiones autorizadas y handoffs por tarea.
Graphify es un derivado para explorar relaciones. Archify presenta un mapa pequeño y revisable.
Obsidian ofrece lectura y notas personales.
Sigue [la organización documental](../README.md); actualiza un documento existente antes de crear un duplicado.

| Hallazgo | Acción | Destino |
|---|---|---|
| Resultado verificado o pendiente | Guardar fuente, fecha, alcance, estado y owner | Handoff propio |
| Decisión autorizada | Conservar motivo, evidencia y autorización | Documento canónico o decisión de arquitectura |
| Procedimiento probado dentro del encargo | Actualizar instrucciones reproducibles | Runbook correspondiente |
| Idea o regla nueva | Proponer destino y razón; estado propuesto hasta autorización | Handoff propio |
| Nota personal | Incorporar solo a petición de Sam y después de revisión | Documento canónico |

Formato de recomendación: «Recomiendo guardar [conocimiento] en [documento] porque [utilidad].
Evidencia: [fuente]. Estado: [verificado/autorizado/propuesto]. Siguiente acción: [responsable y paso]».
Una relación INFERRED o AMBIGUOUS conserva su etiqueta; no prueba una decisión ni cumplimiento.
AGENTS conserva reglas estables; las novedades de una tarea van a su handoff.
Worker escribe en su rama y Director coordina o documenta en su propia rama; no editar documentos rastreados en main.

## Inicio, cambios y cierre

1. Director ejecuta su inventario Git/PR habitual y `pnpm knowledge:status`.
2. Guarda resultados confirmados o propone novedades según la tabla. Worker declara impacto documental y su evidencia en el handoff.
3. Ante código modificado, `graphify update .` refresca la estructura. También puede extraer títulos/enlaces documentales, pero no refresca su interpretación semántica.
4. Ante una fuente del piloto modificada o cobertura semántica piloto pendiente, el asistente usa `$graphify . --update` en Codex. Es una instrucción a la skill; no un comando de PowerShell. La extracción semántica la hace el asistente sobre las fuentes autorizadas. Fuentes fuera del piloto siguen visibles como pendientes hasta ampliar el alcance de forma revisada.
5. Valida y registra evidencia del grafo según el contrato de abajo. Un chunk fallido queda pendiente.
6. Tras integración autorizada, desde el checkout principal actualizado y limpio: `pnpm knowledge:publish` y `pnpm knowledge:check`.
7. Cierra distinguiendo: guardado en la tarea, integración pendiente, estructura del grafo, cobertura semántica y revisión visible en Obsidian.

No hay ejecución en segundo plano. Si una sesión termina con pendientes, se detectan al iniciar la siguiente.
Un archivo AGENTS no es un scheduler. No instalar hooks ni modificar instalaciones globales para este flujo.

## Cierre de una tarea y revisión de la bóveda

El cierre de Worker ocurre en su worktree: guarda evidencia y documentos autorizados, comprueba el estado
estructural/semántico de Graphify, actualiza la vista Archify si sus fuentes cambiaron, ejecuta la vista previa
de Obsidian y registra los pendientes en su handoff. Una vista previa es local y conserva la revisión WORKTREE;
no escribe la bóveda habitual. Si cambió una fuente de `semanticPilot`, su recibo semántico es obligatorio
para que el piloto quede CURRENT. Un documento modificado fuera de ese alcance permanece como PENDING global
visible: el asistente usa la skill Graphify cuando la tarea necesite interpretarlo o cuando se amplíe el alcance;
ese pendiente por sí solo no bloquea la publicación del piloto y nunca se presenta como cobertura completa.

Director revisa la tarea, su PR y el handoff. Después de integración autorizada y de comprobar main,
actualiza Graphify según los cambios, comprueba su estructura, la cobertura semántica piloto y la global, ejecuta knowledge:visual,
knowledge:publish y knowledge:check. El manifest de la bóveda compara revisión, fuentes, versión, grafo,
artefacto visual y hashes de cada Markdown/JSON/HTML/SVG administrado. El resultado CURRENT demuestra
que los archivos locales corresponden a esa revisión; abrirlos en Obsidian confirma adicionalmente la lectura
en su interfaz. Si hay cambios pendientes, cada capa se informa por separado y se recupera en la siguiente
sesión Director. No hay sincronización automática al cerrar una conversación ni publicación web implícita.

Obsidian detecta cambios de archivos de la bóveda sin lanzar este flujo. Obsidian Publish y Obsidian Sync
son productos aparte y no forman parte de esta tarea. Una nota Markdown nueva en Git se hace visible
en Generado solo después de su selección, actualización Graphify, integración en main y publicación
comprobada; las notas personales permanecen donde ya están.

## Versiones y comprobación

Los comandos usan Node y el Python existente de Graphify, sin dependencias npm adicionales. Si pnpm intenta preparar dependencias en un worktree nuevo, puedes ejecutar directamente `node scripts/knowledge-sync.mjs status|publish|check` con los mismos argumentos.

Se fija `graphifyy==0.9.61`. El Python se resuelve desde `--python <ruta absoluta>`,
`GRAPHIFY_PYTHON`, el archivo local `graphify-out/.graphify_python` o el runtime uv conocido.
Se lee una ruta, nunca se evalúa como código. Una versión diferente bloquea publicación y requiere revisión.

`knowledge:status` es lectura y devuelve JSON: revisión Git, estado estructural, cobertura semántica piloto y global,
motivos pendientes, advertencias y estado de la bóveda. Un piloto CURRENT no convierte la global en CURRENT.
`knowledge:check` devuelve exit 1 si falta cobertura del piloto, hay conflicto, estructura/Archify están pendientes,
no corresponde a main o la publicación no coincide con las fuentes. Pendientes semánticos exclusivamente fuera del
piloto quedan como `SEMANTIC_GLOBAL_PENDING` visible y no bloquean por sí solos el piloto integrado.
`knowledge:publish` exige principal en main, HEAD igual a main y origin/main, sin cambios rastreados ni fuentes sin integrar.
El Director actualiza y verifica refs según su runbook; origin/main es una referencia local, no una consulta remota en cada comando.

Cada worktree mantiene grafo, caché y recibo locales. Los hashes cubren bytes completos, configuración,
prompt de extracción, versión y procedencia. El manifest nativo de Graphify usa hashes de bytes completos;
su caché semántica normaliza frontmatter. Por eso un hash de caché por sí solo no certifica una revisión de propiedades YAML.

Graphify 0.9.61 extrae AST de JSON de configuración y manifiestos, pero su extractor omite
intencionalmente JSON de datos. `knowledge:status` enumera estos últimos en
`structural.skippedDataJson` y como advertencia `data_json_ast_skipped`: permanecen en el hash
del corpus y nunca se presentan como AST extraído. Si un JSON de configuración no produce nodos,
sigue en `structural.missing` y `pending`, incluso con manifest nativo estampado. Una omisión de
datos no elimina otros pendientes, errores de procedencia ni la necesidad del recibo semántico.

Los nodos AST que representan destinos de importación pueden llevar como `source_file` el
nombre del paquete (`react` o `node:child_process`) o una ruta de un fixture. Si no
corresponden a un archivo detectado, `knowledge:status` los enumera como
`graph_virtual_import_targets` con advertencia; no son documentos retirados.

Graphify 0.9.61 nombra el stub de un `import("paquete")` dinámico con el último segmento del
especificador. El rescate usa una expresión regular, así que también cuenta un `typeof import("react")`
de TypeScript. `import("react")` e `import("@testing-library/react")` chocan en `react`: la
desambiguación de Graphify renombra los dos IDs con su especificador (`react_react`,
`testing_library_react_react`), pero las aristas `dynamic_import` de quienes importan siguen
apuntando al ID sin renombrar y el build las descarta. `knowledge:status` enumera esos nodos en
`graph_orphan_import_stubs` (fuentes y nodos) como advertencia, no en `structural.deleted`.
Solo entra la huella exacta: especificador de paquete npm fuera del manifest, del corpus y del
disco, sin relaciones ancladas en él; un único nodo AST con `label` y `source_file` iguales al
especificador, tipo `code`, confianza `EXTRACTED`, sin ubicación, sin aristas ni hiperaristas, y
el ID renombrado por la colisión. La advertencia no recupera esas importaciones: el grafo no las
representa. Cada `graphify update .` vuelve a crear los nodos, por eso no se reparan. Un nodo
huérfano con otra forma sigue en `structural.deleted` y se investiga.

`graphify update .` siempre escanea `graphify-out/memory/`, donde Graphify guarda respuestas de
`graphify query`, aunque `.graphifyignore` excluya `graphify-out/`. Son derivados y la política no
los reingresa al grafo. `knowledge:status` informa cada ruta de esa carpeta que aparezca en el
manifest o en el grafo con el error `graph_memory_notes`: la estructura queda INVALID y la
publicación se bloquea. Si hay archivos en `graphify-out/memory/`, muévelos sin borrarlos a
`graphify-out/memoria-archivada-AAAAMMDD/` y corre `graphify update .`; la nota sale del manifest
y del grafo. Otra ruta excluida sigue en `structural.excluded`.

La eliminación de un archivo que sí estuvo en el manifest sigue en
`structural.deleted` y bloquea el estado CURRENT. Una procedencia realmente fuera
de la raíz sigue siendo un error. Si Graphify conserva un nodo huérfano creado
por un ejemplo histórico de importación en `scripts/prune-next-types.mjs`,
`scripts/knowledge-graph-repair.py --check` comprueba la versión fijada,
el hash AST de esa fuente, su extractor nativo y que el nodo exacto no tenga
relaciones; la ejecución sin `--check` respalda el grafo y retira solo ese nodo.
Ejecuta después `graphify cluster-only . --no-label` y vuelve a inspeccionar;
no uses la reparación para descartar otras rutas externas sin investigarlas.

### Recibo de extracción

El adaptador `scripts/knowledge-graph.py inspect --root <raíz>` inspecciona Graphify sin modificar el repositorio.
El asistente conserva evidencia JSON de sus extracciones exitosas: versión, raíz, HEAD,
hashes de grafo/corpus/configuración/prompt y, por archivo, estado success, SHA-256,
IDs de nodos semánticos emitidos y constancia de revisión del frontmatter.

Después de validar los resultados, ejecutar con el Python de Graphify:
`scripts/knowledge-graph.py record --root <raíz> --semantic-evidence <archivo.json>`.
El adaptador exige nodos semánticos existentes de esa misma fuente y hashes vigentes.
El recibo no demuestra que toda inferencia sea correcta: permite auditar qué extracción produjo cada resultado.
Sin evidencia, puede registrar estructura y conservar verificaciones semánticas previas; no certificar documentación nueva.
Releer `inspect` o `knowledge:status`: éxito al guardar un recibo no implica cobertura completa.
Los recibos permanecen en graphify-out, fuera de Git.

### El sello AST no prueba que el grafo coincida con el documento

Graphify 0.9.61 **nunca vuelve a recorrer estructuralmente un documento que ya
tiene nodos semánticos** (`watch.py`, `_rebuild_code`, #1915: «A semantic-backed
doc is never re-quick-scanned»). Su capa de encabezados se arrastra sin cambios en
cada `graphify update`, `--force` incluido — esa bandera solo saltea el control de
cantidad de nodos de `to_json`. En cambio `save_manifest` sella `ast_hash` sobre
**todo** el corpus detectado menos las fuentes cuya extracción *falló*
(`_ast_manifest_files`), y una omisión deliberada no es una falla: la fila conserva
el md5 vigente del archivo mientras sus nodos describen otra versión.

Por eso `astCurrent` demuestra que el hash del corpus quedó sellado, nunca que el
grafo coincida con el documento. Las dos cosas solo se separan en un documento con
capa semántica: en este repositorio, exactamente las 16 fuentes del piloto.

**Medido el 2026-09-21 sobre main `d9adbabf`**, con `pending` vacío y el piloto
16/16 CURRENT:

| Documento | Desfase | Encabezados sin ningún nodo |
|---|---|---|
| `docs/engineering/project-rules.md` | 131 líneas | 2 |
| `docs/runbooks/knowledge-graphify-obsidian.md` | 23 líneas | 0 |

Sobrevivió a dos corridas de `graphify update .`, al recibo semántico aplicado con
`scripts/knowledge-semantic-apply.py` y a `graphify cluster-only . --no-label`. La
capa **semántica** de esos documentos sí estaba al día: lo viejo es la capa de
encabezados. Aplicar un recibo nuevo no lo corrige, porque el recibo escribe nodos
semánticos y las dos capas conviven por diseño (#2333). El efecto se reprodujo
aislado: dos documentos idénticos, un solo nodo semántico inyectado en uno, la
misma edición en los dos — al que lo tenía se le congelaron los encabezados y al
otro no, y **los dos** quedaron sellados como vigentes.

**Qué lo delata.** `scripts/knowledge-graph.py inspect` reextrae cada documento
sellado con el extractor fijado y compara la etiqueta y la línea de cada encabezado
contra el grafo. Una diferencia sale en `structural.drifted` y en el aviso
`graph_ast_drift`, que nombra qué encabezado falta y en qué línea está de verdad;
la estructura queda PENDING y `record` se niega. `drifted` va **aparte** de
`pending` porque el remedio no es el mismo: a un documento pendiente lo arregla
`graphify update`, y a uno desfasado no. El contrato, con la corrida real de
Graphify y sus mutantes, está en `scripts/tests/knowledge-graph.node.mjs`.

**El límite es del paquete `graphifyy`, no de este repositorio: no lo parchees.**
El remedio comprobado es quitarle la capa semántica al documento en
`graphify-out/graph.json`, correr `graphify update .` y volver a inyectarla. Toca
el grafo de la raíz, así que lo hace el Director desde el checkout principal; desde
un worktree mide sobre una copia y entrega el fragmento.

### Alcance semántico canónico del piloto

La política `scripts/knowledge-policy.json` fija el alcance `canonical-16-2026-09-16`. Son exactamente:

1. `.agents/handoffs/2026-09-15-knowledge-graphify-obsidian.md`
2. `.agents/skills/director/SKILL.md`
3. `.agents/skills/worker/SKILL.md`
4. `AGENTS.md`
5. `README.md`
6. `docs/README.md`
7. `docs/architecture/README.md`
8. `docs/architecture/knowledge-lifecycle.md`
9. `docs/architecture/module-sdd-map.md`
10. `docs/engineering/project-rules.md`
11. `docs/governance/AGENT-BRIEF.md`
12. `docs/governance/README.md`
13. `docs/marketing/README.md`
14. `docs/runbooks/codex-engineering.md`
15. `docs/runbooks/knowledge-graphify-obsidian.md`
16. `docs/specs/0471-knowledge-graphify-obsidian/spec.md`

El status calcula ambas coberturas desde hashes y recibos actuales. La cobertura piloto es CURRENT solo con 16/16;
una fuente sin seguimiento, ausente del corpus, renombrada, retirada o con evidencia semántica desactualizada la deja
PENDING y bloquea publicación integrada. La cobertura global conserva sus 1.057 pendientes iniciales de 1.073 como
advertencia explícita. No se certifica semántica global completa, ni se usan hashes nativos para suplir lectura real.
El índice, `Mapa/mapa.json` y `.knowledge-manifest.json` exponen los dos contadores; cada documento del JSON indica
si pertenece al piloto y si su semántica está VERIFIED o PENDING. Una huella de las listas globales ordenadas
VERIFIED/PENDING invalida el manifest si cambia la identidad de esos documentos aunque los contadores coincidan.
Una preview PENDING declara que todavía no certifica el piloto; solo CURRENT usa la afirmación de certificación.

### Importar una extracción parcial hecha por el asistente

Para un lote de documentos incluidos por `.graphifyignore`, conserva el fragmento
JSON que emitió el asistente (`nodes`, `edges`, `hyperedges`, cada elemento con
`source_file` y ubicación). Revisa las afirmaciones, sus etiquetas de confianza,
los cuerpos completos y el YAML inicial. Prepara fuera de Git un JSON de revisión
con `schemaVersion: 1`, `head` del commit, `fragmentSha256` de los bytes exactos y
`files` por ruta relativa; cada entrada contiene `sha256` del archivo completo y
`frontmatterReviewed: true` **solo después de revisarlo**. Un documento fallido
o excluido no entra en ese lote ni recibe un hash semántico nuevo.

Con el Python de Graphify 0.9.61, después de `graphify update .`:

    python scripts/knowledge-semantic-apply.py --fragment graphify-out/lote.json --review graphify-out/lote.review.json --check
    python scripts/knowledge-semantic-apply.py --fragment graphify-out/lote.json --review graphify-out/lote.review.json
    graphify cluster-only . --no-label
    node scripts/knowledge-sync.mjs status --preview

El importador rechaza cambios del HEAD o de los bytes, fuentes fuera del corpus,
IDs repetidos, extremos ausentes, puntuaciones incompatibles con la confianza,
colisiones con AST y documentos con cambios sin commit. Registra caché nativa y
recibo únicamente por los archivos exitosos, deja los demás como pendientes y
mantiene un respaldo local del graph/manifest/recibo anterior. Un fragmento
posterior de una fuente reemplaza sus nodos y relaciones semánticas anteriores
solo si no deja extremos ajenos colgantes. La vista `cluster-only` conserva la
extracción y actualiza reportes/HTML; verifica de nuevo el número de archivos
en `semantic.verified` y `semantic.pending` porque una salida exitosa del CLI no
demuestra cobertura total.

## Archify 2.16.0: visual acotado y comprobable

El mapa piloto es una explicación autoral de diez componentes del flujo de conocimiento. Su JSON
versionado vive en docs/architecture/knowledge-lifecycle.archify.json. Las afirmaciones de cada componente
y conexión están en scripts/knowledge-visual-evidence.json; knowledge:visual comprueba que existan en
archivos locales, calcula hashes completos y registra sus líneas en el JSON de evidencia generado.
El JSON de ocho temas y sus relaciones proviene de Graphify; el JSON visual de diez componentes tiene
otro propósito y nunca se presenta como una extracción AST ni como decisión aprobada por el grafo.
Los badges de fuentes verificados por GitHub de Archify requieren un repositorio público: esta PR no lo es,
por eso usamos evidencia local explícita en lugar de afirmar verificación remota.

Se fija la release oficial v2.16.0, con SHA-256 del ZIP y del árbol extraído en scripts/archify.lock.json.
No se descarga la rama de desarrollo ni se instala una skill global. Preparación local en cada checkout
que construya la vista (el directorio está ignorado por Git y Graphify):

    New-Item -ItemType Directory -Path graphify-out/archify-package -Force
    gh release download v2.16.0 --repo tt-a1i/archify --pattern archify.zip --dir graphify-out/archify-package
    Expand-Archive -LiteralPath graphify-out/archify-package/archify.zip -DestinationPath graphify-out/archify-package

    pnpm knowledge:visual
    pnpm knowledge:visual:check

El builder rechaza ZIP, extracción, fuentes o calidad discrepantes. Archify validate y deliver deben pasar
las nueve comprobaciones showcase sin errores ni advertencias; el recibo incluye versión, revisión,
fuentes, grafo, especificación y artefactos. El HTML es interactivo en un navegador; el SVG queda incrustado
en la nota del índice de Obsidian y su HTML se enlaza para abrirlo fuera de la nota. Ambos se administran
como archivos propios de Generado/Mapa y comparten las protecciones de publicación.
Cuando la especificación o cualquiera de sus fuentes cambia, ARCHIFY_PENDING impide la publicación integrada
hasta una nueva validación. La preview puede registrar ese pendiente y conservar la documentación navegable.
La vista visual no resuelve por sí misma la cobertura semántica pendiente de Graphify.

## Vista previa y publicación

Antes de integrar: `pnpm knowledge:publish --preview`.
Destino fijo: `graphify-out/obsidian-preview` del worktree, con aviso de revisión/pendientes.
Esta vista permite revisar legibilidad y vínculos; no afirma que la tarea esté integrada. Los enlaces GitHub de una revisión local requieren que esa revisión se publique; mientras tanto, la procedencia se comprueba con rutas y hashes locales.
`pnpm knowledge:status --preview` y `pnpm knowledge:check --preview` informan sus límites.

La bóveda compartida es la carpeta existente `DTD Cargo` del checkout principal. No se mueve ni se crea otra bóveda encima.
La publicación integrada exige ejecutar el propio exportador de ese checkout principal. Apuntar con --root a main desde scripts de otra rama devuelve EXECUTOR_MAIN_REQUIRED; la revisión de las fuentes también debe corresponder al código del exportador integrado.
El gate integrado acepta pendientes semánticos exclusivamente fuera de las 16 fuentes como advertencia. Bloquea si
el piloto no está 16/16, la estructura o Archify no están vigentes, existe un issue de grafo, hay fuentes sin integrar,
main no coincide con `origin/main`, el árbol está sucio o la bóveda no supera integridad/conflictos.
Solo se administran archivos registrados bajo `Generado`:
documentos Markdown completos, índice con ocho temas, mapas y JSON con procedencia.
Los temas son Proyecto, Arquitectura, Especificaciones, Runbooks, Ingeniería, Gobernanza, Marketing y Handoffs.
Los handoffs se proyectan a Documentacion/Agentes/handoffs para que Obsidian los indexe; su origen real .agents/handoffs se conserva en la procedencia. MDX se proyecta como nombre.mdx.md, evitando colisiones con notas Markdown.
Las conexiones de clasificación se distinguen de relaciones reales del grafo.

Las notas personales quedan fuera de Generado. Los archivos generados son de lectura por convención,
sin cambiar permisos del sistema. Una edición, eliminación o renombrado manual detiene la publicación.
Director informa el conflicto; se conserva la edición y se decide cómo reconciliarla antes de reintentar.
La publicación usa bloqueo, preparación temporal, hashes y recuperación; no borrar el lock de otro escritor por antigüedad.
Antes de reemplazar una nota se captura su archivo actual, se comprueba esa captura y se instala el nuevo archivo mediante un enlace físico exclusivo. Si aparece otro archivo en el destino, se conserva y se informa RECOVERY_CONFLICT; la recuperación usa la misma protección. El volumen debe admitir enlaces físicos: si no los admite, se detiene sin recurrir a un reemplazo que pueda sobrescribir notas. Las capturas que presenten cambios permanecen en la carpeta .knowledge-stage indicada por el error para su revisión; no borrarlas automáticamente.

Los enlaces internos se reescriben a destinos proyectados. Referencias a código, adjuntos o documentos
fuera del corpus conservan un enlace identificado a la revisión GitHub. No se copian adjuntos automáticamente.
Enlaces inexistentes se reportan; no se inventa contenido. Los ejemplos de código no se reescriben.
Las rutas permanecen estables; documentos retirados conservan una nota mínima de retirada/redirección para tus enlaces personales.
Las advertencias de enlaces permanecen en el manifest y en knowledge:status/check. No equivalen a una nueva comprobación del contenido de una URL externa.

## Fuentes permitidas y límites

La política versionada `scripts/knowledge-policy.json` selecciona raíces documentales.
La detección debe admitirlas también en `.graphifyignore`: raíz AGENTS/CLAUDE/BRAND/README,
arquitectura, specs, runbooks, marketing, ingeniería, gobernanza y handoffs.
Las exclusiones sensibles finales prevalecen. No leer datos de negocio, credenciales ni notas personales.
La bóveda completa y graphify-out se excluyen de Git y del detector para evitar reingresar derivados.

Obsidian detecta archivos locales modificados por otro programa.
Este flujo no requiere CLI, MCP, plugins comunitarios, Obsidian Sync ni publicar datos en la nube.
El servidor MCP opcional de Graphify 0.9.61 recarga el grafo por mtime/tamaño; no exige reiniciar Claude tras cada actualización.

## Validación y aceptación

Pruebas del harness: piloto 16/16 y 15/16, pendiente fuera de alcance, cambio de cuerpo/YAML, código, renombrado,
eliminación/exclusión, stubs de importación huérfanos por colisión de IDs, notas de `graphify-out/memory`, idempotencia, fallo semántico, conflicto humano, carrera de escritores, recuperación y aislamiento entre worktrees.
Verificar enlaces, hashes, etiquetas de evidencia y ocho temas del JSON.
Ejecutar `pnpm harness:test`, `pnpm docs:check`, `pnpm skills:check`, `pnpm sdd:check` y `git diff --check`.
Build/DB/E2E de producto no aplican a esta herramienta de documentación.
La aceptación después de integración requiere una decisión autorizada real visible desde Obsidian;
un fixture o preview no sustituye esa prueba.
Después de ese recorrido se evalúan legibilidad, fidelidad y costo de mantenimiento antes de ampliar el piloto.
Ampliar el alcance exige revisar las nuevas fuentes completas, conservar recibos y actualizar política, SDD y pruebas;
los 1.057 pendientes no ascienden en bloque por una ejecución estructural.

## Referencias verificadas para 0.9.61

- [Paquete 0.9.61](https://pypi.org/project/graphifyy/0.9.61/).
- [CLI de la versión](https://github.com/Graphify-Labs/graphify/blob/fe66389083369c3159aa391117185c8f58b4d07c/graphify/cli.py).
- [Exportador nativo: una nota por nodo](https://github.com/Graphify-Labs/graphify/blob/fe66389083369c3159aa391117185c8f58b4d07c/graphify/export.py).
- [Extractor de JSON de configuración y omisión de JSON de datos](https://github.com/Graphify-Labs/graphify/blob/fe66389083369c3159aa391117185c8f58b4d07c/graphify/extractors/json_config.py).
- [Obsidian: almacenamiento](https://obsidian.md/help/data-storage) y [enlaces](https://obsidian.md/help/links).
- [Archify 2.16.0: release inmutable](https://github.com/tt-a1i/archify/releases/tag/v2.16.0) y [skill de esa versión](https://github.com/tt-a1i/archify/blob/v2.16.0/archify/SKILL.md).
