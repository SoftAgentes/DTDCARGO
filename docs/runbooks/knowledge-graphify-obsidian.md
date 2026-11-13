# Graphify, Archify y Obsidian — retirado

Dueño: Director de ingeniería · Estado: retirado · Actualizado: 2026-11-13 · SDD: 0632 (reemplaza a 0471 y 0623 en lo que toca a Graphify).

Sam retiró Graphify el 2026-11-13: «A Graphite lo eliminamos totalmente, ya que no se estaba
usando y había que actualizarlo a cada rato» («Graphite» = Graphify). Con él se van Archify y la
publicación a la bóveda de Obsidian, que dependían del grafo.

- Ya no existen los comandos `pnpm knowledge:*`, los scripts `scripts/knowledge-*` ni sus pruebas.
- Director y Worker no consultan, actualizan ni publican el grafo al iniciar o cerrar.
- El conocimiento verificado sigue en Git: documentos canónicos, specs SDD y un handoff por tarea en
  `.agents/handoffs/` (ver [AGENTS.md](../../AGENTS.md) y el [runbook de ingeniería](codex-engineering.md)).

La evidencia de uso, el inventario retirado y la limpieza pendiente fuera de Git están en
[SDD-0632](../specs/0632-retiro-graphify/spec.md). Los handoffs históricos que citan Graphify se
conservan como evidencia fechada.
