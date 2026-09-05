# Worktrees de ingeniería

Dueño: Director de ingeniería · Estado: sustituido · Fecha: 2026-09-05.

El procedimiento vigente está en [Ingeniería con Director y Workers](codex-engineering.md#aislamiento).
Se conserva la decisión: una tarea por worktree, fuera del checkout principal,
en el contenedor hermano DTD-worktrees. Nunca cambiar ramas o mover cambios de
una sesión activa. Los worktrees existentes se preservan.

Este runbook ya no autoriza merge local ni push directo a main. Integración por
PR revisada por Director; cierre y cleanup son pasos separados. Historia anterior
en Git; no usar sus comandos de publicación como procedimiento actual.
