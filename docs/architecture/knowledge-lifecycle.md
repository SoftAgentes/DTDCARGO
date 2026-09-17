# Mapa del conocimiento: Director, Graphify, Archify y Obsidian

Este mapa explica el recorrido de una tarea verificada hasta la bóveda DTD Cargo. La
[especificación Archify de diez componentes](knowledge-lifecycle.archify.json) se mantiene
en Git; la [política de evidencia](../../scripts/knowledge-visual-evidence.json) identifica
una fuente concreta para cada componente y conexión. El builder comprueba que cada
afirmación siga en el archivo, anota su línea y hash completo y valida el artefacto.

Director revisa el handoff Worker, conserva conocimiento autorizado y separa propuestas.
Git guarda documentos y código; Graphify 0.9.61 verifica estructura y semántica por
separado. La proyección produce Markdown y el JSON de ocho temas con relaciones y
etiquetas de evidencia. Archify 2.16.0 construye una explicación visual autoral: su
topología no pretende ser una extracción automática de aristas del grafo. Obsidian
lee la bóveda local y permite notas personales fuera de Generado.

La bóveda compartida solo refleja main integrado, grafo comprobado y mapa visual vigente.
Un Worker puede generar una vista previa en su propio worktree; no publica esos cambios
pendientes en la bóveda. Obsidian detecta los archivos al cambiar, pero no ejecuta
Graphify, Archify, los comandos de publicación ni un push.

## Observación del piloto

La validación showcase pasó nueve comprobaciones sin advertencias. En capturas de
1440×900 y 2048×1320 el HTML cabe sin desplazamiento horizontal ni vertical, y
las rutas/etiquetas no se cruzan. El texto de contexto ronda 7,3 px en el primer
tamaño: para leer detalles conviene abrir el HTML con zoom; el índice de Obsidian
prioriza enlaces a documentos y el JSON de evidencia sobre el diagrama.
Es una revisión visual del piloto, no una prueba de cobertura completa de Graphify
ni de publicación en la bóveda habitual.

El [runbook de conocimiento](../runbooks/knowledge-graphify-obsidian.md) da los comandos,
las condiciones de actualización y las comprobaciones al cerrar una tarea.
