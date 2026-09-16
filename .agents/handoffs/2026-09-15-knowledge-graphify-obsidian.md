# Integración de conocimiento Director–Graphify–Obsidian

- Owner/sesión: codex-knowledge-20260915; publicación retomada por codex-knowledge-pr-20260915.
- Estado: PR borrador para revisión/CI; activación en main pendiente.
- Fecha: 2026-09-15.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/knowledge-graphify-obsidian-20260915.
- Rama: codex/knowledge-graphify-obsidian-20260915.
- Base inicial: c70956bf8b58b70e7e49676f29264d11796d7f81 (main/origin-main verificados al reservar).
- Base de revisión actual: 0d22c8247b08b28380a12de3bab83cc82eac1aa9 (PR #124 y #123, integradas por otras tareas). Incorporada solo a esta rama mediante ffb719f9; merge sin conflictos e índice sincronizado con 459 specs.
- SDD: docs/specs/0471-knowledge-graphify-obsidian/spec.md; in-progress por aceptación posterior a integración.
- Autorización: implementación, pruebas, commits, piloto y publicación de Obsidian cuando cumpla sus comprobaciones. Sam autorizó publicar esta rama como PR borrador el 2026-09-15. Merge y producción siguen sin autorizar.
- Ownership: un solo owner; subagentes con scripts de proyección/publicación y adapter/tests disjuntos; terminaron sus escrituras.

## OBJETIVO ORIGINAL

Conservar conocimiento verificado bajo Director y mantener Graphify 0.9.61 y Obsidian con evidencia, protección de notas y mapa legible por temas.

## COMPLETADO

- Contrato estable en AGENTS, skills Director/Worker y runbook de ingeniería; procedimiento dedicado con política de retención y límites de autoridad.
- Comandos knowledge:status, knowledge:publish y knowledge:check, más adaptador Python inspect/record. Sin dependencias npm nuevas ni cambios de configuración global.
- Evidencia estructural y semántica separada; SHA-256 completo, prompt, versión, fuentes/nodos/relaciones; YAML modificado y chunks fallidos permanecen pendientes.
- Proyección de cuerpos Markdown, ocho temas y JSON. Handoffs visibles bajo Agentes/handoffs; MDX como .mdx.md. Enlaces, procedencia, etiquetas originales y notas de retirada.
- Publicación confinada: main=origin/main en principal limpio y con corpus rastreado; preview local separado. Lock, mutex de recuperación, staging, journal, rollback, expectedManifest y nueva comprobación de fuentes.
- Protección de modificaciones/borrados humanos, archivos desconocidos, junctions, rutas, colisiones y escritores simultáneos. Notas personales y derivados fuera de Git/detector.
- SDD-0471 reservado localmente, especificado y agregado al índice.
- Revisión final: se cerró la invocación de un exportador no integrado apuntándolo con --root a main. La publicación integrada exige el ejecutor del propio checkout principal.
- Se cerró la carrera entre lectura y reemplazo mediante captura del archivo actual y enlace exclusivo; la recuperación preserva las capturas o destinos que cambien durante la operación.

## VALIDACIÓN

| Comprobación | Estado | Evidencia y límite |
|---|---|---|
| Suite general del harness | PASÓ | node scripts/tests/run-harness.mjs: 159/159, 0 SKIPs, 20 archivos; ejecutada sobre ffb719f9 tras incorporar main; el commit posterior hasta la PR solo cambió este handoff |
| Suite focal final conocimiento | PASÓ | 46 pruebas de conocimiento dentro de la suite final: graph 6, state 5, sync 5, vault 21 y vault-race 9; fixtures sintéticos declarados y 0 omisiones |
| Índice/documentación | PASÓ | node scripts/build-docs-index.mjs --check: 459 specs después de sincronizar main |
| Skills y numeración | PASÓ | node scripts/check-skills-manifest.mjs; node scripts/check-numbering.mjs |
| Sintaxis y whitespace | PASÓ | node --check de módulos; git diff --check |
| Piloto con fuentes reales | PASÓ | 8 documentos copiados con hashes y un archivo de código, más configuración excluida del AST; 38 nodos semánticos reales; grafo final 50 nodos/55 relaciones |
| Publicación/check del piloto | PASÓ | preview de 8 temas, 8 documentos, 12 relaciones documentales; estructura CURRENT, semántica CURRENT; segunda publicación unchanged=true |
| Consulta del piloto | PASÓ | graphify query Director --budget 900: 7 nodos, relaciones explícitas/inferidas y fuentes concretas |
| Benchmark estándar Graphify | FALLÓ | No matching nodes found for sample questions; CLI devolvió 0 pese al mensaje. No se atribuye ahorro de tokens |
| Build/DB/E2E de producto | NO EJECUTADO | No cambia producto, DB ni Studio; pruebas de esta tarea son harness y documentación |
| Bóveda habitual / main integrado | NO EJECUTADO | Obsidian está autorizado cuando cumpla los gates, pero el exportador aún no está integrado en main y el grafo completo sigue inválido. La bóveda personal preexistente se conservó |

Se invocaron pnpm docs:index/harness:test, pero pnpm inició instalación automática en el worktree nuevo; se interrumpieron esas dos invocaciones y se ejecutaron directamente los scripts Node equivalentes. Quedó node_modules parcial ignorado; lockfile no modificado. No se usó esa instalación como evidencia de checks.

### Artefactos del piloto (ignorados, locales)

- Índice: graphify-out/knowledge-pilot-source/graphify-out/obsidian-preview/Generado/Indice.md.
- JSON: graphify-out/knowledge-pilot-source/graphify-out/obsidian-preview/Generado/Mapa/mapa.json.
- SHA-256 del JSON: 42581025314e57d5642a9d70109397863bdae325e4ffbb5525d1164e275fe4fb.
- Grafo/HTML/informe: graphify-out/knowledge-pilot-source/graphify-out/.
- Evidencia: graphify-out/knowledge-pilot-result.json, knowledge-pilot-provenance.json y recibo/evidencia semántica dentro del graphify-out del piloto.
- Revisión del repositorio de muestra: fee8ff3431fdf4f513e41295371e856e2c401bb3. Es una instantánea Git aislada de archivos reales durante implementación; no un commit integrado de DTDCARGO.
- Límites: 6 extremos AST ausentes del corpus acotado antes de construir el grafo; grafo final sin extremos colgantes. 12 advertencias de enlaces fuera/no resueltos en la muestra. La revisión de muestra es local; los enlaces GitHub no demuestran publicación remota. La procedencia está en rutas, hashes y recibos locales. Tokens del host NO DISPONIBLE, nunca se interpretan los placeholders cero como consumo real.

## COMMITS

2865139e — stub SDD-0471. 428cd226 — implementación del contrato, comandos, exportador y pruebas. 7b254682 y ffb719f9 — sincronizaciones de origin/main dentro de la rama propia. 07bed1b7 — protección del publicador y recuperación. cbf35987 — revisión de pasos 1–5. Publicación como PR: commit que contiene esta actualización del handoff.
Reserva local: cdda5ce1805d49ab89a1d4093e9a59c10ad60dcc, refs/heads/codex/sdd-reserve-0471-knowledge-graphify-obsidian.

## PR / BRANCH

PR borrador [#125](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/125), base main `0d22c8247b08b28380a12de3bab83cc82eac1aa9`, rama `codex/knowledge-graphify-obsidian-20260915` respaldada en origin. Primer HEAD de la PR: `cbf359871a4357851f4965f9e5529d3451c23b59`; el handoff actualizado se publica en un commit posterior. Worktree indicado arriba. Esta tarea no se integró en main ni se hizo deploy manual.

## PENDIENTES DE ESTA TAREA

1. Revisar la PR borrador #125, su código, el piloto y los resultados de CI. Integración requiere autorización separada y aceptación de los gates correspondientes.
2. Tras integrar, completar y verificar la cobertura del corpus elegido antes de publicar a la bóveda habitual; generar recibos semánticos de documentos realmente procesados.
3. Ejecutar desde main comprobado knowledge:publish/check y demostrar una decisión autorizada real en esa bóveda. Entonces cerrar criterio 8 del SDD y evaluar legibilidad en Obsidian.
4. Director informa guardado en rama, integración, estructura, semántica y Obsidian como estados separados. Las reglas nuevas no están activas en el checkout main hasta integrarse.

## FUERA DE ALCANCE DETECTADO

- El grafo previo principal contiene una procedencia fuera de raíz: ../app/portal/(auth)/login/page.js; no se corrige código de producto ni el paquete upstream para ocultarla.
- La reconstrucción estructural local completa produjo 33.676 nodos, 62.927 aristas y 2.249 comunidades. Diagnóstico posterior: esa procedencia externa, fuentes sin salida AST y 1.064 documentos sin recibo semántico; cambios posteriores del propio trabajo vuelven a invalidar hashes. No representa cobertura completa.
- Graphify reportó dos archivos legales TSX parcialmente parseados. Los 67 bucles propios observados en el grafo anterior son advertencias, no se eliminaron arbitrariamente.
- Numbering informa colisiones históricas entre refs y migraciones aplicadas; el check local pasa con el tratamiento vigente. No se renumeraron.

## HANDOFF AL DIRECTOR

Revisar la PR borrador #125, SDD-0471, runbook y comandos; usar preview para evaluación. Mantener la frontera de integración y la cobertura pendiente visible. Director recomendará destino/razón para ideas nuevas y conservará hechos autorizados en su fuente canónica.
El claim anterior codex-knowledge-20260915 se liberó. Al terminar esta publicación se libera codex-knowledge-pr-20260915; el worktree y la rama se conservan. Para retomar escritura, volver a reclamarlo. No instalar hooks ni automatizaciones de fondo.

## REVISIÓN DE PASOS 1–5 — 2026-09-15

- Paso 1, piloto: `knowledge:check --preview` PASÓ en la muestra aislada (`fee8ff34`): ocho temas, ocho documentos y doce relaciones. Sus ocho hashes coinciden con las fuentes y la procedencia local; diez relaciones son `EXTRACTED` y dos `INFERRED`. El JSON conserva fuentes y destinos válidos. Persisten doce advertencias de enlaces fuera del corpus acotado, seis extremos AST crudos omitidos al construir el grafo final y benchmark estándar FALLÓ; no se demuestra ahorro de tokens.
- Paso 2, rama: `main` remoto comprobado en `0d22c824`; merge local `ffb719f9` en la rama de esta tarea, sin conflicto. `docs:check` PASÓ con 459 specs; skills, numbering y `git diff --check` PASARON. Suite completa del harness en el merge: 159/159 PASÓ, cero fallos y cero omisiones, 20 archivos; incluye 46 pruebas de conocimiento y las pruebas de la PR #123. No se ejecutó `pnpm verify` de producto ni DB/E2E reales.
- Paso 3, PR: antes de la autorización posterior, la consulta autenticada de GitHub devolvió `[]` para esta rama; no había PR. El diff local frente a `origin/main` contiene 23 archivos de la tarea. SDD-0471 sigue `in-progress` por aceptación posterior a integración. En ese momento la rama no estaba publicada ni integrada; el checkout principal y producción no se tocaron.
- Paso 4, grafo completo: `knowledge:status --preview` en `ffb719f9` informó Graphify 0.9.61, estructura `INVALID` con 50 cambios pendientes, semántica `INVALID` con 1.069 documentos pendientes y la procedencia fuera de raíz `../app/portal/(auth)/login/page.js`. La vista previa de ocho documentos pasa, pero no certifica el corpus completo. El estado temporal cambia al modificar nuevas fuentes y debe medirse otra vez antes de publicar.
- Paso 5, bóveda habitual: Sam autorizó su publicación, pero el `main` comprobado no contiene `scripts/knowledge-sync.mjs` ni `knowledge-policy.json`; `DTD Cargo/Generado/.knowledge-manifest.json` no existe. El contrato exige exportador integrado en `main` y cobertura estructural/semántica vigente sin errores. Por esos bloqueos no se ejecutó `knowledge:publish` sobre la bóveda ni se modificaron notas personales. La autorización de Obsidian permanece para cuando se cumplan los gates; la autorización posterior cubre solo la PR borrador, sin merge ni producción.

### HANDOFF ACTUAL AL DIRECTOR

Revisar la PR borrador #125 y sus checks. Resolver la cobertura y procedencia de Graphify antes de aprobar la publicación compartida. Integración/producción requieren sus controles y permisos propios; luego publicar desde `main` limpio, ejecutar `knowledge:check` y verificar una decisión autorizada real en Obsidian. Esta revisión deja el trabajo en su rama publicada y conserva la bóveda compartida.

## PUBLICACIÓN DE RAMA Y PR BORRADOR — 2026-09-15

- Sam autorizó explícitamente publicar `codex/knowledge-graphify-obsidian-20260915` como PR borrador para revisión y CI. Tras verificar worktree limpio, ausencia de PR/rama remota y `main` remoto en `0d22c824`, se hizo push de la rama a sí misma, sin force, y se abrió [PR #125](https://github.com/hailuwaycom-sketch/DTDCARGO/pull/125) contra main.
- GitHub confirmó PR `OPEN`, `isDraft=true`, head inicial `cbf35987` y base `0d22c824`. En la primera consulta, `Calidad local sin secretos` estaba `IN_PROGRESS`, Vercel preview `PENDING` y `Vercel Preview Comments` `SUCCESS`. Son estados observados, no un pase global de CI. Un commit posterior de este handoff vuelve a iniciar los checks del HEAD final.
- `node scripts/knowledge-sync.mjs status --preview` sobre `cbf35987` devolvió `ok=false`: Graphify 0.9.61, estructura `INVALID`, semántica `INVALID`, `graph_external_sources` y Obsidian `PENDING`. El comando terminó correctamente como informe de estado; no se interpreta su exit 0 como cobertura completa.
- Documentos canónicos afectados por la implementación: AGENTS, skills Director/Worker, runbooks, SDD-0471 y su índice, y reglas de ingeniería; comandos, política, exportador y tests quedan en esta rama. El estado documental y el grafo completo requieren actualización después de integrar. Los ocho documentos del piloto solo respaldan su preview local.
- La bóveda compartida no se publicó: el exportador no existe aún en main, la cobertura estructural/semántica completa está pendiente y falta el recorrido de una decisión autorizada real. No se hicieron merge, despliegue manual ni cambios en notas personales.

## AMPLIACIÓN DE LA MISMA TAREA: ARCHIFY Y CIERRE DIRECTOR — 2026-09-15

- Owner escritor retomado: codex-knowledge-archify-20260915, en el mismo worktree y rama de la PR #125.
  No se abrió otra PR ni se modificó el checkout principal. El claim se liberará al cerrar la escritura.
- Contrato Director/Worker, runbook, SDD-0471, arquitectura y reglas de ingeniería ampliados: al cerrar un
  Worker se conservan documentos/handoff, estructura Graphify, recibos semánticos, mapa Archify y preview;
  Director publica la bóveda habitual solo tras integración autorizada y main/grafo/visual comprobados.
  Obsidian detecta archivos locales, pero no ejecuta el pipeline ni hace push/publicación web.
- Archify 2.16.0 oficial instalado solo en graphify-out ignorado. ZIP SHA-256
  4c59fa6557a2385beaaef8c7219cc414573acc9f0c30a932d5053b0b20689a46;
  árbol SHA-256 a1c035262b493ff4506d4bdd6b703ce0dfe08c99e4ad540a399ab236ef450148.
  Ninguna skill global se instaló. El JSON autoral versionado tiene 10 componentes y 11 conexiones,
  con 11 fuentes locales comprobadas por aserción, línea y hash completo. DTDCARGO es PRIVATE;
  no se reclaman badges remotos SRC.
- JSON visual congelado: SHA-256 a60b44658c182a4c623a7a95d788f02d3772bf0b4bc6a79a1429d41c70565fd3.
  Archify showcase PASÓ 9/9, cero errores/advertencias; HTML
  c05d1946272de99427cf9efef92b02b12c11a34aa13d9fe4437b08946d56f276.
  visual-check PASÓ contención y lectura automatizada en 1440×900, 1600×1000, 1920×1080 y
  2048×1320, temas claro/oscuro. Capturas revisadas: el mapa cabe y las conexiones son legibles;
  el texto de contexto es pequeño (~7,3 px a 1440), por lo que se recomienda zoom y enlaces MD/JSON.
  SVG independiente renderizado en Chrome con tema claro; no se confirmó todavía interfaz Obsidian.
- Commit de implementación 050214f25686fe14c9fb3c943ae89bff7129b8a3, 21 archivos selectivos.
  La corrección de CI agrega GRAPHIFY_PYTHON a .env.example. El check previo de la PR #125
  Calidad local sin secretos FALLÓ por esa variable faltante; el nuevo HEAD iniciará un check nuevo al push.
- Graphify 0.9.61 ejecutó graphify update . tras el commit: exit 0, 33.931 nodos, 63.384 aristas,
  2.266 comunidades. Dos TSX legales mostraron parseo parcial. Inspección posterior:
  estructura INVALID (22 pendientes), semántica INVALID (1.070 pendientes), issue
  graph_external_sources con ../app/portal/(auth)/login/page.js. Esta reconstrucción no certifica
  toda la semántica; faltan recibos del asistente mediante la skill Graphify.
- VALIDACIÓN: suite harness inicial en sandbox FALLÓ 162/163 solo porque CIM de Windows no estaba
  disponible allí. El caso focal watchdog PASÓ 14/14 fuera del sandbox; suite completa con ese
  acceso PASÓ 163/163, 21 archivos, cero skips. Docs:check PASÓ (459 specs), skills:check PASÓ,
  numbering PASÓ con colisiones históricas informadas; JSON visual y fuentes PASÓ 4/4.
  Vitest focal de .env.example NO DISPONIBLE localmente (node_modules incompleto); lo medirá CI.
  Build/DB/E2E de producto NO EJECUTADO: esta ampliación cambia herramientas y documentación.
- Bóveda compartida: PENDIENTE. Main aún no contiene esta implementación, el grafo completo es
  inválido y no se demostró la decisión real visible tras merge. Una vista previa local no sustituye
  ni la integración ni la lectura efectiva de Obsidian.

### Corrección de cobertura JSON y vista previa del corpus

- La cifra anterior de 22 JSON pendientes era un error del adaptador: el extractor fijado de Graphify
  0.9.61 omite de manera intencional JSON de datos y extrae JSON de configuración. Ahora
  `structural.skippedDataJson` enumera las 22 omisiones como advertencia y las mantiene en el hash del
  corpus, sin afirmar AST; un JSON de configuración con manifest estampado y sin nodos permanece
  pendiente. Las pruebas focales del adaptador y exportador PASARON 13/13, incluidos JSON de ambas
  clases, cambios del hash de datos, propiedades YAML, aislamiento y publicación sintética.
- Suite completa del harness con CIM disponible PASÓ 165/165, cero skips, después de la corrección;
  docs:check PASÓ 459 specs, skills:check PASÓ y numbering PASÓ con colisiones históricas informadas.
- La vista previa completa fue publicada **solo** bajo `graphify-out/obsidian-preview` de este
  worktree. `checkVault` confirmó manifest íntegro, cero conflictos, 1.084 archivos propios,
  1.069 documentos, ocho temas, 942 relaciones documentales y 39 advertencias de enlaces
  registrados. Incluye índice Markdown, mapa JSON y la vista Archify JSON/evidencia/SVG/HTML.
  Esta comprobación es de archivos; la interfaz local de Obsidian no se inspeccionó en este cierre.
- En la inspección tras corregir el adaptador y antes de reconstruir las tres fuentes modificadas:
  estructura INVALID, tres pendientes de esta tarea, 22 JSON omitidos como tales, cero AST faltantes,
  1.070 documentos semánticos pendientes y `graph_external_sources` del portal fuera de raíz.
  Repetir `graphify update .`, construir Archify y publicar preview contra el commit final.

### PENDIENTES DE ESTA TAREA AL DIRECTOR

1. Publicar el HEAD final a la PR borrador #125 y revisar CI contra ese SHA; resolver cualquier regresión
   propia antes de solicitar integración. Merge y producción requieren autorizaciones distintas.
2. Tras integración, resolver fuentes externas y cubrir el corpus estructural/semántico elegido con
   evidencia real. En main comprobado construir Archify para su revisión, publicar/check de Generado
   y abrir una nota/documento para confirmar lectura en Obsidian.
3. Demostrar una decisión autorizada real desde su documento canónico hasta la bóveda; después
   evaluar legibilidad/fidelidad/mantenimiento del mapa y cerrar el criterio restante del SDD-0471.
4. Conservar worktree y rama hasta evidencia de integración o descarte autorizado; liberar solo
   el claim de esta sesión al finalizar la escritura.

## AVANCE DEL MISMO WORKTREE: REPARACIÓN Y COBERTURA SEMÁNTICA PARCIAL — 2026-09-15

- Writer retomado por `codex-knowledge-coverage-20260915` en la rama de PR #125. Se encontró la
  ruta externa `../app/portal/(auth)/login/page.js` en un ejemplo histórico de importación
  dentro de un comentario de `scripts/prune-next-types.mjs`, no en una ruta activa. Se convirtió
  a prosa, se comprobó con el extractor fijado y se retiró **solo** el nodo huérfano exacto
  mediante `scripts/knowledge-graph-repair.py`; el grafo previo tuvo respaldo local. El
  posterior `graphify update .` no volvió a emitir esa procedencia externa.
- Los destinos AST de importación que Graphify llama `source_file` (`react`, `node:child_process`,
  etc.) son referencias virtuales y se informan como `graph_virtual_import_targets`, no como
  documentos borrados. Un archivo previamente inventariado y retirado sigue en
  `structural.deleted`/`PENDING`. La ruta antigua de Portal generada por el texto de un fixture
  se retiró al separar esa cadena en el test. Inspección tras la reconstrucción: estructura
  `CURRENT`, cero archivos pendientes/borrados y cero errores de procedencia. Permanecen 11
  advertencias de importaciones virtuales, 22 JSON de datos sin AST por política del extractor
  y dos TSX legales con parseo parcial informado por Graphify; no se presentan como cobertura
  AST completa de esos casos.
- `.graphifyignore` añadió **exactamente** `docs/README.md` y las dos skills Director/Worker:
  faltaban en el detector aunque son fuentes canónicas de este piloto. El asistente revisó
  sus contenidos completos y el YAML de ambas skills y SDD-0471; el fragmento local ignorado
  pasó validación: 12 fuentes, 52 nodos, 45 aristas (44 EXTRACTED, una INFERRED) y una
  hiperrelación. `scripts/knowledge-semantic-apply.py` registró caché nativa para esas 12,
  respaldo/recibo y SHA-256 de cada fuente. `graphify cluster-only . --no-label` reconstruyó
  los derivados con 34.035 nodos y 63.501 relaciones. La cobertura semántica real queda
  **12 verificadas / 1.061 pendientes de 1.073**; no se usó un backend LLM ni se estampó
  contenido que el asistente no extrajo.
- Archify 2.16.0 volvió a producir el diagrama autoral local: nueve comprobaciones pasaron,
  diez componentes y once conexiones basados en once fuentes completas. Preview de Obsidian
  solo en `graphify-out/obsidian-preview/Generado`: 1.084 archivos propios, 1.069 copias
  documentales, ocho temas, 945 relaciones en mapa.json y 39 enlaces ausentes o fuera de la
  selección registrados. Índice piloto legible por temas y rutas; sus 19 líneas de relaciones
  agregadas pueden verse densas en una ventana pequeña, así que cada tema tiene su nota y
  el visual Archify queda separado con HTML/JSON/evidencia. No se abrió la interfaz de
  Obsidian en esta fase; la comprobación es de archivos, hashes y manifest, no de UI.
- PASÓ suite harness sobre los nuevos importador/reparador: 170/170, cero skips, antes de
  la clasificación de importaciones y la selección documental; pruebas focales posteriores
  14/14. Repetir la suite completa y los checks documentales contra el HEAD final antes
  del push. Build/DB/E2E de producto no aplican a esta ampliación de herramientas/docs.
- La bóveda habitual `DTD Cargo/Generado` sigue sin tocarse. El exportador aún no está
  integrado en main y la cobertura semántica completa permanece pendiente. Sam autorizó
  actualizar la rama/PR borrador, no mergear. El trabajo posterior a esta nota debe
  refrescar la fuente runbook y este handoff en Graphify, reconstruir Archify/preview,
  confirmar idempotencia, hacer push no forzado al mismo PR y revisar CI en el SHA nuevo.
- La primera agrupación `cluster-only` agregó `norm_label` y convirtió la representación JSON
  de valores enteros `1` en decimales `1.0`; el recibo original perdió temporalmente sus 12
  verificaciones, aunque diez fuentes estaban intactas. La huella ahora ignora solo metadatos
  de agrupación y normaliza puntuación/peso numéricamente; un cambio semántico real sigue
  invalidando. PASÓ prueba focal para ambas situaciones y suite completa del harness después
  de esta corrección: **172/172, cero fallos, cero omisiones**, 23 archivos. PASARON índice
  documental 459 specs, manifest de skills, numeración con choques históricos declarados y
  `git diff --check`. Al iniciar la siguiente reconstrucción se reemitió el recibo de diez
  fuentes intactas; las dos fuentes editadas se reextrajeron y reemplazaron por separado.

### Resultado comprobado de esta ampliación

- Graphify 0.9.61 sobre `b35de50c`: estructura `CURRENT`, cero archivos pendientes/borrados,
  cero errores de procedencia, 11 referencias AST virtuales y 22 JSON de datos omitidos como
  advertencias. Tras reemitir diez verificaciones y reemplazar runbook/handoff (22 nodos,
  21 relaciones, 14 IDs conservados y ocho nuevos), el recibo sobrevivió a `cluster-only`:
  **12 fuentes semánticas verificadas y 1.061 pendientes de 1.073**. El grafo tiene 34.044
  nodos, 63.512 aristas y 2.261 comunidades. Los dos TSX legales siguen parcialmente
  parseados según el CLI; no se atribuye cobertura perfecta de esos archivos.
- Archify 2.16.0 `CURRENT`: diez componentes, once conexiones, once fuentes completas,
  showcase 9/9, SVG/HTML/JSON y recibo de evidencia correspondientes a esta revisión.
  Obsidian **PREVIEW** en el worktree: 1.069 documentos navegables, ocho temas, índice,
  `mapa.json`, visual y 39 destinos de enlace faltantes o fuera de la selección.
  `knowledge:publish --preview` generó la revisión y la repetición exacta devolvió
  `published=false`, `unchanged=true`; manifest íntegro y cero conflictos. En una ventana
  pequeña, las 19 conexiones agregadas del Mermaid del índice pueden verse densas;
  las ocho notas por tema y el visual de diez componentes ofrecen navegación más cómoda.
- `knowledge:check --preview` devolvió **exit 1** por `MAIN_REQUIRED` y
  `SEMANTIC_PENDING`, como debe hacer el gate integrado; aun así el estado de la preview
  fue `PREVIEW` con Archify `CURRENT` y cero conflictos. No se comprobó esta proyección
  dentro de la interfaz de Obsidian ni se escribió la bóveda compartida; abrir una nota
  en Obsidian y demostrar una decisión autorizada tras integración continúan pendientes.
- Validación de herramientas/docs: harness 172/172, cero skips; docs:check 459 specs,
  skills manifest y numbering PASARON, con choques históricos ya aplicados declarados;
  producto build/DB/E2E NO EJECUTADO porque esta tarea toca herramientas/documentación.
  La PR borrador #125 permanece como frontera de integración; CI del nuevo push se revisa
  sobre el SHA remoto efectivo, sin inferirlo del CI previo.
