# Handoff — SDD-0582 piloto de Chatwoot

- **Owner:** Claude Worker «Chatwoot piloto», sesión de Sam del 2026-10-28 (claim `claude-chatwoot-piloto`).
- **Worktree:** `C:\Users\AKX generator\Desktop\Developer\DTD-worktrees\chatwoot-piloto`
- **Rama:** `codex/chatwoot-piloto`, base `origin/main` ec5786bb8.
- **SDD:** 0582, reservada con `sdd:next --reserve chatwoot-piloto` (rama `codex/sdd-reserve-0582-chatwoot-piloto`
  y ref `refs/dtd/reservations/0582`, ambas solo locales; la reserva no está publicada).
- **Objetivo:** especificar el piloto de Chatwoot autohospedado con WhatsApp Cloud API y bot propio, y las
  puertas para salir de Kommo. Solo documentación: nada instalado, nada tocado en Kommo, Meta ni producción.

## OBJETIVO ORIGINAL

Sam: «Piloto de Chatwoot». Luego pidió explicar la conexión con WhatsApp y dijo que quiere salir de Kommo por el
costo de su IA. Citas literales en la spec, sección «Pedido de Sam».

## COMPLETADO

- `docs/specs/0582-chatwoot-piloto/spec.md` con status `proposed`: contexto verificado, reglas de Meta, fases 0-3,
  decisiones para Sam, privacidad, aceptación y allowlist.
- `docs/specs/README.md` regenerado con `docs:index`.

## VALIDACIÓN

- `node scripts/build-docs-index.mjs --check` (docs:check): PASÓ, 565 specs.
- `node scripts/check-numbering.mjs` (sdd:check): PASÓ, sin números repetidos; avisos históricos conocidos.
- `git diff --check`: PASÓ.
- `pnpm verify`: NO EJECUTADO; el cambio es solo de documentación.
- Graphify, Archify y `knowledge:status`: NO EJECUTADOS; no hay `node_modules` en el worktree. Impacto
  documental: una spec nueva; queda para el Director al integrar.

## PR / BRANCH

Commit local en `codex/chatwoot-piloto`. Sin push ni PR: falta la autorización de publicación de Sam.

## PENDIENTES DE ESTA TAREA

- Decisiones 1-4 de la spec (máquina, ruta de corte, dueño de la WABA, tope de gasto del bot).
- Publicar la reserva y la rama y abrir la PR cuando Sam lo autorice.
- Antes de la fase 1: `revisar-datos-ve`, inventario de terceros y texto de `/privacidad`.

## FUERA DE ALCANCE DETECTADO

- `/privacidad` dice que los datos se tratan en Venezuela (`app/privacidad/page.tsx:262-264`), pero la base vive
  en Contabo, en EE. UU. Ya se había registrado en la revisión del traslado a Contabo.
- La PDF del DPA de Contabo está sin seguimiento en la raíz del checkout principal.

## HANDOFF AL DIRECTOR

Spec documental lista para revisión. Hay que coordinar la publicación de la reserva 0582 antes de integrar.
