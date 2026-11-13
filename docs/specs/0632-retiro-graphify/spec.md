---
sdd: "0632"
title: "Retiro de Graphify, Archify y la publicación a Obsidian"
status: in-progress
author: "Claude (Worker)"
created: 2026-11-13
updated: 2026-11-13
supersedes: "0471, 0623"
superseded_by: null
related: ["0471", "0623"]
confidencialidad: interno
---

# SDD-0632 — Retiro de Graphify, Archify y la publicación a Obsidian

> **Integración condicionada.** Esta SDD y su PR quedan en borrador. No se integran hasta que el
> repositorio privado del «segundo cerebro» de la empresa haya avanzado y Sam confirme el retiro.
> Orden de Sam del 2026-11-13: «Opino que retiremos Grafiti cuando avancemos con la creación del
> cerebro, ¿correcto?».

## Decisión

Sam, 2026-11-13: «A Graphite lo eliminamos totalmente, ya que no se estaba usando y había que
actualizarlo a cada rato». «Graphite» y «Grafiti» se refieren a Graphify. Con Graphify se retiran
Archify y la publicación a la bóveda de Obsidian, porque dependen del grafo.

Esta SDD reemplaza a SDD-0471 y SDD-0623 en todo lo que toca a Graphify, Archify y Obsidian.
Ambas quedan `superseded` como registro histórico.

## Evidencia de uso (medida el 2026-11-13)

Sobre las transcripciones locales desde el 2026-10-14:

- Claude: 1 de 1.203 transcripciones ejecutó `graphify query`, `path` o `explain`; ninguna leyó
  `GRAPH_REPORT.md`.
- Codex: 5 de 46 sesiones consultaron el grafo (7 consultas en total).
- `node scripts/knowledge-sync.mjs status` en el checkout principal devolvía `ok:false`
  («Respuesta inválida del adaptador Graphify»).
- El log diario (`%LOCALAPPDATA%\dtd-cargo\knowledge-daily.log`) solo tenía un `DRY_RUN` del 11-nov.
- La tarea programada «DTD Cargo - Graphify diario» terminó con resultado 2 y estaba en modo solo
  interactivo.
- `graphify-out/graph.json` era del 9-nov.

El costo de mantenerlo (actualizar el grafo, la semántica, el mapa y la bóveda en cada cierre) no se
correspondía con el uso.

## Qué se conserva

Guardar evidencia verificada y decisiones autorizadas en su documento canónico, specs SDD y un
handoff por tarea en `.agents/handoffs/`. Eso no es Graphify y sigue vigente en `AGENTS.md` y en las
skills Director y Worker. El conocimiento compartido de la empresa pasa a un repositorio privado
aparte (otra tarea); este repo es público y no recibe datos del negocio.

## Alcance

1. Quitar las reglas: sección de conocimiento de `AGENTS.md`, pasos de cierre de las skills Director
   y Worker, sección de conocimiento de `docs/runbooks/codex-engineering.md`, secciones Graphify/Archify
   de `docs/engineering/project-rules.md` y el enlace de `docs/architecture/README.md`.
2. Reemplazar `docs/runbooks/knowledge-graphify-obsidian.md` por una nota corta de retiro.
3. Retirar scripts, módulos, pruebas y comandos que solo servían a Graphify:
   `scripts/knowledge-{daily,sync,visual}.mjs`, `scripts/knowledge-graph.py`,
   `scripts/knowledge-graph-repair.py`, `scripts/knowledge-semantic-apply.py`,
   `scripts/knowledge-policy.json`, `scripts/knowledge-visual-evidence.json`,
   `scripts/archify.lock.json`, `scripts/lib/knowledge-{projection,state,vault,visual}.mjs`,
   las nueve pruebas `scripts/tests/knowledge-*.node.mjs`, los seis comandos `pnpm knowledge:*`,
   `.graphifyignore`, `docs/architecture/knowledge-lifecycle.{md,archify.json}` y la variable
   `GRAPHIFY_PYTHON` de los `.env.example`.
4. Conservar como protección, mientras la carpeta exista en checkouts locales, las exclusiones de
   `graphify-out` en `.gitignore`, `.dockerignore`, `eslint.config.mjs` y
   `scripts/check-pending-migration-symbols.mjs`. Se pueden retirar después de la limpieza local.
5. No tocar handoffs históricos, specs anteriores ni QA fechados que citan Graphify: son evidencia.

## Fuera de Git (no lo hace esta SDD)

La tarea programada, `graphify-out/`, la bóveda `DTD Cargo/` del checkout principal, el log diario,
la herramienta `uv` `graphifyy` y la skill local de Codex se borran a mano, después de integrar esta
SDD y con el OK de Sam. Los comandos están en el handoff
`.agents/handoffs/0632-retiro-graphify.md`.

## Aceptación

- [ ] Cero referencias activas a Graphify, Archify o `knowledge:*` en reglas, skills, scripts y CI
      (excepto las exclusiones de protección del punto 4 y los avisos de retiro).
- [ ] `pnpm harness:test`, `pnpm docs:check`, `pnpm sdd:check` y CI de la PR en verde.
- [ ] Handoff con inventario y limpieza fuera de Git pendiente.
- [ ] Sam confirma el retiro con el cerebro privado avanzado; recién entonces se integra.
