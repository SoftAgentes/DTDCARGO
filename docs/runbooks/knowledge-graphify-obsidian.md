# Conocimiento con Director, Graphify y Obsidian

Dueño: Director de ingeniería · Estado: vigente al integrarse · Actualizado: 2026-09-15 · SDD: 0471.

## Autoridad y conservación

Git conserva documentos canónicos, decisiones autorizadas y handoffs por tarea.
Graphify es un derivado para explorar relaciones. Obsidian ofrece lectura y notas personales.
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
4. Ante documentos modificados o cobertura semántica pendiente, el asistente usa `$graphify . --update` en Codex. Es una instrucción a la skill; no un comando de PowerShell. La extracción semántica la hace el asistente sobre las fuentes autorizadas.
5. Valida y registra evidencia del grafo según el contrato de abajo. Un chunk fallido queda pendiente.
6. Tras integración autorizada, desde el checkout principal actualizado y limpio: `pnpm knowledge:publish` y `pnpm knowledge:check`.
7. Cierra distinguiendo: guardado en la tarea, integración pendiente, estructura del grafo, cobertura semántica y revisión visible en Obsidian.

No hay ejecución en segundo plano. Si una sesión termina con pendientes, se detectan al iniciar la siguiente.
Un archivo AGENTS no es un scheduler. No instalar hooks ni modificar instalaciones globales para este flujo.

## Versiones y comprobación

Los comandos usan Node y el Python existente de Graphify, sin dependencias npm adicionales. Si pnpm intenta preparar dependencias en un worktree nuevo, puedes ejecutar directamente `node scripts/knowledge-sync.mjs status|publish|check` con los mismos argumentos.

Se fija `graphifyy==0.9.61`. El Python se resuelve desde `--python <ruta absoluta>`,
`GRAPHIFY_PYTHON`, el archivo local `graphify-out/.graphify_python` o el runtime uv conocido.
Se lee una ruta, nunca se evalúa como código. Una versión diferente bloquea publicación y requiere revisión.

`knowledge:status` es lectura y devuelve JSON: revisión Git, estado estructural, semántico, motivos pendientes y estado de la bóveda.
`knowledge:check` devuelve exit 1 si falta cobertura, hay conflicto o la publicación no coincide con las fuentes.
`knowledge:publish` exige principal en main, HEAD igual a main y origin/main, sin cambios rastreados ni fuentes sin integrar.
El Director actualiza y verifica refs según su runbook; origin/main es una referencia local, no una consulta remota en cada comando.

Cada worktree mantiene grafo, caché y recibo locales. Los hashes cubren bytes completos, configuración,
prompt de extracción, versión y procedencia. El manifest nativo de Graphify usa hashes de bytes completos;
su caché semántica normaliza frontmatter. Por eso un hash de caché por sí solo no certifica una revisión de propiedades YAML.

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

## Vista previa y publicación

Antes de integrar: `pnpm knowledge:publish --preview`.
Destino fijo: `graphify-out/obsidian-preview` del worktree, con aviso de revisión/pendientes.
Esta vista permite revisar legibilidad y vínculos; no afirma que la tarea esté integrada.
`pnpm knowledge:status --preview` y `pnpm knowledge:check --preview` informan sus límites.

La bóveda compartida es la carpeta existente `DTD Cargo` del checkout principal. No se mueve ni se crea otra bóveda encima.
Solo se administran archivos registrados bajo `Generado`:
documentos Markdown completos, índice con ocho temas, mapas y JSON con procedencia.
Los temas son Proyecto, Arquitectura, Especificaciones, Runbooks, Ingeniería, Gobernanza, Marketing y Handoffs.
Los handoffs se proyectan a Documentacion/Agentes/handoffs para que Obsidian los indexe; su origen real .agents/handoffs se conserva en la procedencia. MDX se proyecta como nombre.mdx.md, evitando colisiones con notas Markdown.
Las conexiones de clasificación se distinguen de relaciones reales del grafo.

Las notas personales quedan fuera de Generado. Los archivos generados son de lectura por convención,
sin cambiar permisos del sistema. Una edición, eliminación o renombrado manual detiene la publicación.
Director informa el conflicto; se conserva la edición y se decide cómo reconciliarla antes de reintentar.
La publicación usa bloqueo, preparación temporal, hashes y recuperación; no borrar el lock de otro escritor por antigüedad.

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

Pruebas del harness: cambio de cuerpo/YAML, código, renombrado, eliminación/exclusión,
idempotencia, fallo semántico, conflicto humano, carrera de escritores, recuperación y aislamiento entre worktrees.
Verificar enlaces, hashes, etiquetas de evidencia y ocho temas del JSON.
Ejecutar `pnpm harness:test`, `pnpm docs:check`, `pnpm skills:check`, `pnpm sdd:check` y `git diff --check`.
Build/DB/E2E de producto no aplican a esta herramienta de documentación.
La aceptación después de integración requiere una decisión autorizada real visible desde Obsidian;
un fixture o preview no sustituye esa prueba.

## Referencias verificadas para 0.9.61

- [Paquete 0.9.61](https://pypi.org/project/graphifyy/0.9.61/).
- [CLI de la versión](https://github.com/Graphify-Labs/graphify/blob/fe66389083369c3159aa391117185c8f58b4d07c/graphify/cli.py).
- [Exportador nativo: una nota por nodo](https://github.com/Graphify-Labs/graphify/blob/fe66389083369c3159aa391117185c8f58b4d07c/graphify/export.py).
- [Obsidian: almacenamiento](https://obsidian.md/help/data-storage) y [enlaces](https://obsidian.md/help/links).
