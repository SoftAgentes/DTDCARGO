---
sdd: "0471"
title: "Conocimiento verificable con Director, Graphify, Archify y Obsidian"
status: in-progress
author: "Codex"
created: 2026-09-15
updated: 2026-09-15
supersedes: null
superseded_by: null
related: ["0464"]
confidencialidad: interno
---

# SDD-0471 — Conocimiento verificable

## Problema y objetivo

Director necesita conservar evidencia y decisiones autorizadas, proponer conocimiento nuevo y verificar la
vigencia de Graphify 0.9.61, Archify 2.16.0 y Obsidian. El exportador nativo produce una nota por nodo y no copia los cuerpos
documentales; una actualización AST no demuestra extracción semántica de documentos.

## Contrato aprobado

- Git conserva documentos canónicos y handoffs por tarea. Regla estable en AGENTS; procedimiento en el runbook.
- Ocho temas en Obsidian: Proyecto, Arquitectura, Especificaciones, Runbooks, Ingeniería, Gobernanza, Marketing, Handoffs.
- Comandos knowledge:status, knowledge:publish, knowledge:check; preview local separado de bóveda compartida.
- Hashes de bytes completos, revisión, versión/configuración/prompt, integridad y evidencia semántica por archivo.
- El piloto semántico tiene 16 fuentes canónicas explícitas en `scripts/knowledge-policy.json`. Su cobertura se informa
  separada de la cobertura global: el piloto puede estar CURRENT mientras el corpus completo permanece PENDING.
- Bóveda compartida sólo desde main integrado, limpio y comprobado; ningún worktree publica su trabajo pendiente allí.
- Publicación con propietario de archivos, conflicto por edición/borrado manual, staging, lock, recuperación y tombstones.
- Notas personales excluidas; inferencias no ascienden a decisiones; no procesos de fondo ni actualización global de Graphify.
- Archify se fija a su release estable; una vista autoral de diez componentes conserva JSON, fuentes comprobadas
  y HTML/SVG validados. Una fuente visual o artefacto desactualizado bloquea publicación integrada; preview informa pendientes.

## Alcance autorizado del piloto semántico

El alcance `canonical-16-2026-09-16` comprende AGENTS, README raíz, índice documental, dos skills Director/Worker,
handoff de esta tarea, tres documentos de arquitectura, reglas de ingeniería, dos documentos de gobernanza,
índice de marketing, dos runbooks y este SDD. La enumeración exacta y ordenada vive en la política versionada;
renombrar, retirar, excluir, cambiar bytes —incluido solo YAML— o perder el recibo de cualquiera de esas fuentes
deja el piloto PENDING.

La autorización acota el criterio previo porque exigir semántica completa de los 1.073 documentos impedía evaluar
el piloto ya revisado. Los otros 1.057 documentos permanecen visibles como pendientes globales y no se presentan
como CURRENT. Ese pendiente es una advertencia de alcance, no un bloqueo del piloto integrado, siempre que estructura,
Archify, integridad, main y las 16 fuentes estén vigentes. La adopción se reevalúa después de una publicación real
desde main, el recorrido de una decisión autorizada y la revisión de legibilidad, fidelidad y mantenimiento.

## Aceptación

1. Documentos navegables, ocho temas y JSON con fuentes y etiquetas de evidencia.
2. Cambios de código, cuerpo, YAML, renombrado y eliminación/exclusión invalidan cobertura correspondiente.
3. Segunda ejecución sin cambios no duplica ni modifica salidas.
4. Con 16/16 fuentes objetivo vigentes, el piloto integrado puede publicarse con los otros 1.057 pendientes visibles;
   15/16, un cambio solo YAML o una fuente objetivo renombrada/retirada bloquean la publicación.
5. Edición humana, dos escritores y fallo de publicación conservan datos y reportan conflicto.
6. Otro worktree no puede publicar a la bóveda principal.
7. Tests focales y harness/documentación/skills/numbering con evidencia explícita.
8. Después de integración autorizada, demostrar el recorrido de una decisión real hasta Obsidian.
9. Conservar un mapa Archify de ocho a doce componentes, JSON y evidencia local, validar nueve comprobaciones
   showcase, verificar legibilidad de escritorio y detectar fuentes/artefactos obsoletos.
10. Índice, mapa JSON y manifest muestran a la vez cobertura piloto y global; la global no aparece CURRENT mientras
    existan fuentes pendientes fuera del alcance.

## Implementación y prueba

Procedimiento: [runbook](../../runbooks/knowledge-graphify-obsidian.md).
Evidencia de ejecución: handoff de esta tarea; no convertir una vista previa o fixture en prueba de integración.
No cambia APIs de producto, DB ni comportamiento Studio. Publicación/merge se autorizan por separado.
