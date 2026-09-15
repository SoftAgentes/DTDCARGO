# Integración de conocimiento Director–Graphify–Obsidian

- Owner/sesión: codex-knowledge-20260915.
- Estado: lista-para-revision; activación en main pendiente.
- Fecha: 2026-09-15.
- Worktree: C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/knowledge-graphify-obsidian-20260915.
- Rama: codex/knowledge-graphify-obsidian-20260915.
- Base: c70956bf8b58b70e7e49676f29264d11796d7f81 (main/origin-main verificados al reservar).
- SDD: docs/specs/0471-knowledge-graphify-obsidian/spec.md; in-progress por aceptación posterior a integración.
- Autorización: implementación, pruebas, commits locales y piloto. Publicación de rama/PR, merge y producción no autorizados.
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

## VALIDACIÓN

| Comprobación | Estado | Evidencia y límite |
|---|---|---|
| Suite general del harness | PASÓ | node scripts/tests/run-harness.mjs: 127/127, 0 SKIPs; antes de las últimas pruebas añadidas de Obsidian/E2E |
| Suite focal final conocimiento | PASÓ | node --test scripts/tests/knowledge-{graph,state,sync,vault}.node.mjs (rutas explícitas): 36/36, 0 SKIPs; includes fixtures sintéticos declarados |
| Índice/documentación | PASÓ | node scripts/build-docs-index.mjs y --check: 457 specs |
| Skills y numeración | PASÓ | node scripts/check-skills-manifest.mjs; node scripts/check-numbering.mjs |
| Sintaxis y whitespace | PASÓ | node --check de módulos; git diff --check |
| Piloto con fuentes reales | PASÓ | 8 documentos copiados con hashes y un archivo de código, más configuración excluida del AST; 38 nodos semánticos reales; grafo final 50 nodos/55 relaciones |
| Publicación/check del piloto | PASÓ | preview de 8 temas, 8 documentos, 12 relaciones documentales; estructura CURRENT, semántica CURRENT; segunda publicación unchanged=true |
| Consulta del piloto | PASÓ | graphify query Director --budget 900: 7 nodos, relaciones explícitas/inferidas y fuentes concretas |
| Benchmark estándar Graphify | FALLÓ | No matching nodes found for sample questions; CLI devolvió 0 pese al mensaje. No se atribuye ahorro de tokens |
| Build/DB/E2E de producto | NO EJECUTADO | No cambia producto, DB ni Studio; pruebas de esta tarea son harness y documentación |
| Bóveda habitual / main integrado | NO EJECUTADO | Sin autorización de publicar/integrar. La bóveda personal preexistente se conservó |

Se invocaron pnpm docs:index/harness:test, pero pnpm inició instalación automática en el worktree nuevo; se interrumpieron esas dos invocaciones y se ejecutaron directamente los scripts Node equivalentes. Quedó node_modules parcial ignorado; lockfile no modificado. No se usó esa instalación como evidencia de checks.

### Artefactos del piloto (ignorados, locales)

- Índice: graphify-out/knowledge-pilot-source/graphify-out/obsidian-preview/Generado/Indice.md.
- JSON: graphify-out/knowledge-pilot-source/graphify-out/obsidian-preview/Generado/Mapa/mapa.json.
- SHA-256 del JSON: 658328856b9b5384fc643ad675d2894394b84bd107c0e23c9628cd2af1f9c5ff.
- Grafo/HTML/informe: graphify-out/knowledge-pilot-source/graphify-out/.
- Evidencia: graphify-out/knowledge-pilot-result.json, knowledge-pilot-provenance.json y recibo/evidencia semántica dentro del graphify-out del piloto.
- Revisión del repositorio de muestra: fee8ff3431fdf4f513e41295371e856e2c401bb3. Es una instantánea Git aislada de archivos reales durante implementación; no un commit integrado de DTDCARGO.
- Límites: 6 extremos AST ausentes del corpus acotado antes de construir el grafo; grafo final sin extremos colgantes. 12 advertencias de enlaces fuera/no resueltos en la muestra. Tokens del host NO DISPONIBLE, nunca se interpretan los placeholders cero como consumo real.

## COMMITS

2865139e — stub SDD-0471. Implementación: commit que contiene este documento.
Reserva local: cdda5ce1805d49ab89a1d4093e9a59c10ad60dcc, refs/heads/codex/sdd-reserve-0471-knowledge-graphify-obsidian.

## PR / BRANCH

Sin PR ni respaldo remoto de esta rama. Base main; rama/worktree indicados arriba. No hubo merge ni deploy.

## PENDIENTES DE ESTA TAREA

1. Revisión del código y del piloto; autorizar publicación de rama/PR y, separadamente, integración.
2. Tras integrar, completar y verificar la cobertura del corpus elegido antes de publicar a la bóveda habitual; generar recibos semánticos de documentos realmente procesados.
3. Ejecutar desde main comprobado knowledge:publish/check y demostrar una decisión autorizada real en esa bóveda. Entonces cerrar criterio 8 del SDD y evaluar legibilidad en Obsidian.
4. Director informa guardado en rama, integración, estructura, semántica y Obsidian como estados separados. Las reglas nuevas no están activas en el checkout main hasta integrarse.

## FUERA DE ALCANCE DETECTADO

- El grafo previo principal contiene una procedencia fuera de raíz: ../app/portal/(auth)/login/page.js; no se corrige código de producto ni el paquete upstream para ocultarla.
- La reconstrucción estructural local completa produjo 33.676 nodos, 62.927 aristas y 2.249 comunidades. Diagnóstico posterior: esa procedencia externa, fuentes sin salida AST y 1.064 documentos sin recibo semántico; cambios posteriores del propio trabajo vuelven a invalidar hashes. No representa cobertura completa.
- Graphify reportó dos archivos legales TSX parcialmente parseados. Los 67 bucles propios observados en el grafo anterior son advertencias, no se eliminaron arbitrariamente.
- Numbering informa colisiones históricas entre refs y migraciones aplicadas; el check local pasa con el tratamiento vigente. No se renumeraron.

## HANDOFF AL DIRECTOR

Revisar SDD-0471, runbook y comandos; usar preview para evaluación. Mantener la frontera de PR y la cobertura pendiente visible. Director recomendará destino/razón para ideas nuevas y conservará hechos autorizados en su fuente canónica.
Al cerrar se libera el claim codex-knowledge-20260915; el worktree y la rama se conservan. Para retomar escritura, volver a reclamarlo. No instalar hooks ni automatizaciones de fondo.
