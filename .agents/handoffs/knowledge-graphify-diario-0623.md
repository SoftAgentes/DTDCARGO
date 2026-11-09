# Handoff — corrida diaria mecánica de Graphify (SDD-0623)

Fecha: 2026-11-09. Task ID: `knowledge-graphify-diario`.
Owner: Worker Claude Code, worktree `.claude/worktrees/graphify-diario-e75344`, rama `claude/graphify-diario-e75344`.
Encargo del Director General (sesión `local_25e2dded-…`). Sin subagentes.

Estado: lista para revisión. PR en borrador. No está integrada. La tarea programada **no** existe todavía.

## Autorización

Sam, 2026-11-09, transmitida por el DG: «Sí, a las 22:00». Cubre una corrida diaria a las 22:00 hora de Venezuela
(UTC-4) en su PC, solo de la parte mecánica. La tarea programada la crea el DG después del merge.

## Qué entrega

- **SDD-0623** `docs/specs/0623-knowledge-graphify-diario/spec.md` (`in-progress`). La reservé con `node scripts/next-number.mjs --reserve knowledge-graphify-diario`:
  - quedaron la rama local `codex/sdd-reserve-0623-knowledge-graphify-diario` y el lock `refs/dtd/reservations/0623`, los dos en `fb84014a1`;
  - incorporé la reserva con cherry-pick;
  - la reserva no se publicó aparte, porque la PR lleva la spec;
  - avisé el número al DG por mensaje.
- **Regla** en `docs/runbooks/knowledge-graphify-obsidian.md`:
  - la línea «No hay ejecución en segundo plano» se reemplazó por la excepción única;
  - nueva sección «Corrida diaria mecánica (SDD-0623)»;
  - nota en el cierre del Director y en «Validación».
- `.agents/skills/director/SKILL.md`: «no instales un scheduler» ahora excluye esta única tarea, y el Director lee el log.
- **AGENTS.md y `docs/governance/README.md` no cambian.** Ninguno de los dos contiene la prohibición; lo comprobé con grep de «segundo plano», «scheduler» y «programad».
- **Guion** `scripts/knowledge-daily.mjs` (`pnpm knowledge:daily`):
  - va solo en el checkout principal y en `main`, sin cambios rastreados;
  - hace fetch y después `merge --ff-only origin/main`;
  - corre `python -m graphify update .`, con el Python resuelto por `resolvePython`, y después `knowledge:visual build`, `knowledge:publish` y `knowledge:check`.
- **Códigos de salida del guion:**
  - 0: OK o `--dry-run`;
  - 1: falló un paso, o quedaron cambios rastreados (no los revierte);
  - 2: precondición; para sin tocar nada;
  - 3: candado vivo;
  - 64: uso incorrecto.
- **Log** en `%LOCALAPPDATA%\dtd-cargo\knowledge-daily.log`, fuera del repo, una línea por corrida.
- **Pruebas** `scripts/tests/knowledge-daily.node.mjs`: 16 casos con Git real en carpetas temporales y dobles `node -e` en lugar de Graphify, Archify y la bóveda.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `node --test scripts/tests/knowledge-daily.node.mjs` | PASÓ 16/16 |
| Mutante: quitar el corte por checkout sucio | Detectado: 2 rojos |
| Mutante: saltar el corte de ancestro (FF) | Detectado: 1 rojo |
| Mutante: forzar la rama a `main` | Detectado: 2 rojos |
| `pnpm harness:test` (Windows) | PASÓ: 261 pruebas, 256 pasan, 0 fallan, 5 saltadas. Las saltadas ya existían: son de `run-sql-tests-salida`, cuyo doble de docker es sh. Linux queda a la CI |
| `docs:check` (tras `docs:index`) | PASÓ, 603 specs |
| `skills:check` | PASÓ |
| `sdd:check` | PASÓ (solo choques históricos de migraciones) |
| `git diff --check` | PASÓ |
| Corrida real con Graphify en el checkout principal | NO EJECUTADO: el encargo prohíbe tocar la bóveda y `graphify-out/` del principal |
| `pnpm verify` / build / E2E | NO APLICA: el cambio es de harness y docs, no de producto |

## Impacto documental y conocimiento

- Cambian dos fuentes del piloto semántico: el runbook de conocimiento y la skill Director.
- Al integrarse, el piloto queda PENDING hasta que el DG corra `$graphify . --update` sobre ellas.
- Hasta entonces, la corrida diaria termina en salida 1 por piloto pendiente, y su log lo dice.
- Graphify, Archify y Obsidian del worktree: NO EJECUTADO.

## Pendientes de esta tarea (DG)

1. Revisión independiente y merge.
2. Después del merge, en el checkout principal:
   - `node scripts/knowledge-daily.mjs --dry-run`;
   - una corrida real a mano;
   - recibo semántico de las dos fuentes del piloto.
3. Crear la tarea programada de Windows, diaria a las 22:00 hora local:
   - comando: `node scripts/knowledge-daily.mjs`;
   - directorio: el checkout principal;
   - usuario: Sam, sin privilegios elevados;
   - si se corre en paralelo, que no inicie otra instancia.
4. Leer la primera línea del log.

## FUERA DE ALCANCE DETECTADO

- La PC tiene que estar encendida a las 22:00. Si no lo está, la tarea de Windows puede quedar con «ejecutar lo antes posible tras un inicio perdido»; eso lo decide el DG al crearla.
