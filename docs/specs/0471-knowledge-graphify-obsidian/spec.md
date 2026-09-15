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
- Bóveda compartida sólo desde main integrado, limpio y comprobado; ningún worktree publica su trabajo pendiente allí.
- Publicación con propietario de archivos, conflicto por edición/borrado manual, staging, lock, recuperación y tombstones.
- Notas personales excluidas; inferencias no ascienden a decisiones; no procesos de fondo ni actualización global de Graphify.
- Archify se fija a su release estable; una vista autoral de diez componentes conserva JSON, fuentes comprobadas
  y HTML/SVG validados. Una fuente visual o artefacto desactualizado bloquea publicación integrada; preview informa pendientes.

## Aceptación

1. Documentos navegables, ocho temas y JSON con fuentes y etiquetas de evidencia.
2. Cambios de código, cuerpo, YAML, renombrado y eliminación/exclusión invalidan cobertura correspondiente.
3. Segunda ejecución sin cambios no duplica ni modifica salidas.
4. Fallo semántico permanece pendiente y no permite publicación integrada.
5. Edición humana, dos escritores y fallo de publicación conservan datos y reportan conflicto.
6. Otro worktree no puede publicar a la bóveda principal.
7. Tests focales y harness/documentación/skills/numbering con evidencia explícita.
8. Después de integración autorizada, demostrar el recorrido de una decisión real hasta Obsidian.
9. Conservar un mapa Archify de ocho a doce componentes, JSON y evidencia local, validar nueve comprobaciones
   showcase, verificar legibilidad de escritorio y detectar fuentes/artefactos obsoletos.

## Implementación y prueba

Procedimiento: [runbook](../../runbooks/knowledge-graphify-obsidian.md).
Evidencia de ejecución: handoff de esta tarea; no convertir una vista previa o fixture en prueba de integración.
No cambia APIs de producto, DB ni comportamiento Studio. Publicación/merge se autorizan por separado.
