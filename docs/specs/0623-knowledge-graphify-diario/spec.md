---
sdd: "0623"
title: "Corrida diaria mecánica de Graphify, Archify y Obsidian"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-09
updated: 2026-11-09
supersedes: null
superseded_by: null
related: ["0471"]
confidencialidad: interno
---

# SDD-0623 — Corrida diaria mecánica de conocimiento

## Problema

El runbook de conocimiento (SDD-0471) prohibía toda ejecución en segundo plano: la estructura de
Graphify, el visual Archify y la bóveda de Obsidian solo se ponían al día cuando el Director abría una
sesión. Entre sesiones, la bóveda quedaba atrás de main aunque nada semántico hubiera cambiado.

## Autorización

Sam, 2026-11-09, ante la propuesta de programar la actualización diaria a las 22:00 hora de Venezuela
(UTC-4) en su PC: «Sí, a las 22:00». Cubre solo lo mecánico. La tarea programada la crea el Director
después de la integración; esta SDD no la crea.

## Contrato

1. Se permite **una** corrida programada al día, en la PC de Sam, desde el checkout principal.
2. La corrida solo hace: `git fetch origin main`, `git merge --ff-only origin/main`, `graphify update .`,
   `knowledge:visual`, `knowledge:publish` y `knowledge:check`.
3. La extracción semántica sigue siendo manual: la hace el Director cuando cambie alguna de las 16 fuentes
   del piloto o una vez por semana.
4. Sin hooks de Git, sin instalaciones globales, sin commit, push, stash, reset, clean ni borrado de
   archivos rastreados.
5. Para sin tocar nada (salida 2) si no es el checkout principal, si no está en `main`, si hay cambios
   rastreados o si el fast-forward no es posible.
6. Tras la primera falla salta los pasos que escriben, corre `knowledge:check` para informar y sale con 1.
   También falla, sin revertir, si algún paso dejó cambios rastreados. Otra corrida viva → salida 3.
   Trabajo manual en curso → salida 3, sin fetch ni pasos. Cuenta como trabajo manual cualquiera de estos
   candados: `graphify-out/knowledge-manual.lock`, `knowledge-record.lock`, o los de publicación y
   recuperación de la bóveda. La comprobación se hace antes del fetch y otra vez antes de los pasos.
   Si el update falla, el resumen dice `UPDATE_FAILED` aunque `check` mida otra cosa.
   El candado de publicación de un publicador muerto de esta máquina no bloquea: se anota y lo recupera `publish`.
   Un timeout mata solo al proceso directo; los hijos pueden quedar huérfanos y se revisan a mano.
6b. Tope de tiempo por comando: git a los 5 min, cada paso a los 30 min, con `GIT_TERMINAL_PROMPT=0`. El
    Python fijado de Graphify llega a los cuatro pasos. Un candado muerto se aparta con `rename` y se toma
    con `wx`.
7. Escribe una línea por corrida en un log fuera del repo (`%LOCALAPPDATA%\dtd-cargo\knowledge-daily.log`
   por defecto) con fecha, revisión, resultado, estructura, Archify, Obsidian y pendientes semánticos
   (piloto y global).

## Implementación

- `scripts/knowledge-daily.mjs` (`pnpm knowledge:daily`), con `--dry-run`, `--log` y `--python`.
- Regla en `docs/runbooks/knowledge-graphify-obsidian.md` y en `.agents/skills/director/SKILL.md`.
  AGENTS.md y el registro de gobernanza no contienen la prohibición, así que no cambian.

## Aceptación

- `scripts/tests/knowledge-daily.node.mjs`, con Git real en carpetas temporales y dobles en lugar de Graphify:
  checkout sucio, otra rama, HEAD separado, fast-forward imposible y worktree enlazado paran sin pasos y sin
  cambios; la corrida feliz hace el fast-forward y ejecuta los cuatro pasos en orden; es idempotente; un paso
  fallido da salida 1 y check informa; un cambio rastreado se detecta y no se revierte; el candado vivo se
  respeta; el guion no invoca verbos de Git que escriban historia o borren.
- `pnpm harness:test`, `pnpm docs:check`, `pnpm skills:check`, `pnpm sdd:check`, `git diff --check`.
- Aceptación posterior a la integración (Director): crear la tarea programada, ver la primera línea del log.

## Fuera de alcance

Crear la tarea programada; programar la parte semántica; tocar la bóveda o `graphify-out/` del checkout principal.
