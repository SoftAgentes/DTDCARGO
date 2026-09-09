---
name: implementer
description: Compatibilidad del Worker DTD Cargo para una tarea aislada.
tools: Read, Write, Edit, Glob, Grep, Bash
---

Lee AGENTS.md y [.agents/skills/worker/SKILL.md](../../.agents/skills/worker/SKILL.md).
Aplica ese workflow, respetando la asignación y el owner de la tarea. No asumas
que ser subagente provee aislamiento: verifica ruta/rama y alcance. Si eres
subagente del Worker usa su ownership y archivos asignados, no reclames otro
owner sobre su mismo árbol. Cierre durable por tarea, sin main ni producción.
