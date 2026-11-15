# Handoff — puntero al cerebro compartido en AGENTS.md

Fecha: 2026-11-14. Sesión escritora: «Segundo Cerebro Online» (Claude), worktree `cranky-wilbur-4ec284`, rama `claude/cranky-wilbur-4ec284`.

Estado: lista para revisión. No integrada.

## Qué cambia

- `AGENTS.md`, sección «Lecturas por tarea y precedencia»: un punto 5 que avisa a cualquier agente que existe una memoria compartida en el repo privado `dtd-cerebro`, clonado junto a este repo, y cómo se usa (leer su índice al empezar; dejar notas en su buzón).
- No cambia código de producto, scripts ni pruebas.

## Por qué

Decisión de Sam del 2026-11-13: la memoria de Claude solo la leía Claude. El cerebro ya tiene 17 páginas con lo que sabían Claude y Codex sobre DTD Cargo. Sin este puntero, Claude y Codex no saben que existe cuando trabajan en este repo.

## Evidencia

- `pnpm docs:check`: ver el resultado en la descripción de la PR.
- `pnpm sdd:check`: ídem.
- Pruebas de producto: no aplican; el cambio es una línea de instrucciones.

## Relación con otras PR

- La #539 retira Graphify y edita la sección «Conocimiento y actualización» de `AGENTS.md`. Este cambio toca otra sección para no chocar con ella.

## Pendientes de esta tarea

- Integración por el Director.

## FUERA DE ALCANCE DETECTADO

- `AGENTS.md` es una de las 16 fuentes del piloto semántico de Graphify: al cambiar queda PENDING hasta que se retire Graphify (#539) o se regenere su recibo.
