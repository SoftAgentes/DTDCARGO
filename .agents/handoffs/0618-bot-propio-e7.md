# Handoff — SDD-0618, E7 `dtd-bot` (programa SDD-0582)

- **Owner:** Claude Worker «E7 bot», sesión `cb282af0` (claim `claude-e7-bot-cb282af0`). Coordina el Subdirector de Chatwoot; fusiona el DG.
- **Objetivo:** etapa E7 (filas 7.1 a 7.11), todo apagado de nacimiento. Diseño en [`docs/specs/0618-bot-propio-e7/spec.md`](../../docs/specs/0618-bot-propio-e7/spec.md).
- **Permisos:** PR en borrador desde `main`, sin fusionar. Sin OK nominal de Sam: nada de 7.1, 7.2, 7.5, modelos pagados, encender el bot ni escribir en Kommo, Meta o el Chatwoot vivo.

## Piezas

| Pieza | Rama | Worktree | Estado |
|---|---|---|---|
| A · SDD | `claude/objective-bohr-fd58df` | `.claude/worktrees/objective-bohr-fd58df` | spec + índice; `sdd:check` y `docs:check` PASÓ |
| C · 7.4 base y reglas duras | `codex/e7-bot-conocimiento` | `DTD-worktrees/e7-bot-conocimiento` | vitest 128/128, 6/6 mutantes, tsc y eslint PASÓ |
| D · 7.6 a núcleo puro | `codex/e7-bot-nucleo` | `DTD-worktrees/e7-bot-nucleo` | vitest 117/117, 6/6 mutantes, tsc y eslint PASÓ |
| B · 7.3 respaldo de Kommo | — | — | en espera de Sam (ubicación de «analiza mi contestación» y sesión de Kommo) |
| E · 7.6 b tablas, cola, trabajador, PoC | — | — | pide número de migración al Subdirector, con su diseño; antes, `merge-tree` contra E10 |
| F, G · 7.7 y 7.8 | — | — | después de E |

## Impacto documental

- Canónico nuevo: la SDD-0618. El checklist de SDD-0582 no cambia en esta PR (ninguna fila se acepta todavía).
- Graphify, Archify y Obsidian: NO EJECUTADO en esta tarea; lo hace el DG desde main.

## FUERA DE ALCANCE DETECTADO

- Teléfono de la bodega en China distinto entre FAQ #28 (`+86 180 0689 1419`) y `lib/design-tokens.ts:326` (`+86 186 0689 1419`). El bot no da ninguno.
- La sesión «E6 · Leads de Kommo y Salesbots» puede cruzarse con 7.3 y con el menú A–H: coordinar antes de 7.3.
- Contradicciones para Sam (SDD-0618 §1.1): proveedor (F «Gemini + GLM» frente a 3.4 «Solo GLM») y tope (US$25 de E0-D3 frente a US$50 de la 3.4).
