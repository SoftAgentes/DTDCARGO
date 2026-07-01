---
sdd: "0129"
title: "Workflows custom — puntero al motor de flujo existente (SDD-0091)"
status: in-progress
author: "Claude Code (sesión secundaria · worktree web-norte) + founder"
created: 2026-07-01
updated: 2026-07-01
supersedes: null
superseded_by: null
related: ["0091"]
confidencialidad: interno
---

# SDD-0129 · Workflows custom

> Sección PRO de Administración. **Sin migración, sin motor nuevo**: el motor de
> flujo YA existe (SDD-0091, N8N-lite) dentro del módulo Servicios
> (`servicios/_components/WorkflowEditor.tsx`, pestaña "Flujo").

## Decisión

En vez de construir un segundo motor de automatización, esta sección:

1. **Apunta** al motor existente (link a `/studio/servicios` · Flujo).
2. Deja como **por implementar** los workflows *tenant-wide* (cron, eventos
   cross-módulo, triggers que disparan agents/mailing/alertas) — un nivel por
   encima del flujo por servicio.

## Superficie de código

- `app/studio/(app)/admin/_components/WorkflowsSection.tsx` — server-safe.
- `app/studio/(app)/admin/page.tsx` — render.

## Estado

Código listo; build en verde. Sin migración.
