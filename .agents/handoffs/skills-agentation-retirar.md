# Retirar las skills de Agentation del repo

- Fecha: 2026-09-12. Owner / sesión escritora: `director-skills-agentation-20260912` (Claude Code, Opus 5).
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/skills-agentation-retirar`.
- Rama: `codex/skills-agentation-retirar`. Base: `origin/main` = `e3dcd314b1a8dc9b5467fcbd23ac2dd1926ba9fc`.
- Estado de tarea: lista-para-revisión.
- SDD: no aplica. No hay cambio de comportamiento de Studio ni de producto; el alcance es documentación de agentes y su manifiesto de instalación.

## OBJETIVO ORIGINAL

Sam pidió el 2026-09-12, dentro de esta sesión Director, que las dos skills de Agentation se
borren **en su propia rama**. El borrado ya existía sin commitear en el árbol de trabajo del
checkout principal desde hacía días: lo registró como preexistente el handoff
`.agents/handoffs/c-fix-pending-symbols-utf16.md:155`, que decidió no tocarlo. Esta tarea lo saca
de ahí y lo convierte en un cambio revisable.

## ALCANCE

Rutas escritas: los tres archivos borrados, `skills-lock.json` y este handoff. Nada más.

- `.agents/skills/agentation/SKILL.md`
- `.agents/skills/agentation-self-driving/SKILL.md`
- `.agents/skills/agentation-self-driving/references/two-session-workflow.md`

Se borran los **directorios completos**, no solo los dos `SKILL.md` que estaban borrados en el
árbol principal. Un directorio de skill sin `SKILL.md` deja el archivo de referencias colgando.
En `.agents/skills/` quedan `director` y `worker`, que son las que cita AGENTS.md.

**Decisión que conviene revisar:** también se retiran las dos entradas de `skills-lock.json`
(`agentation` y `agentation-self-driving`, ambas con `source: benjitaylor/agentation`). Si se
dejaran, el manifiesto seguiría declarando instaladas dos skills ausentes y una reinstalación
podría resucitarlas, deshaciendo el borrado. El archivo ya estaba desincronizado por otro motivo
ajeno a esta tarea —las ocho entradas restantes (`find-skills` y las siete `higgsfield-*`)
tampoco tienen directorio en `.agents/skills/`—, y **eso no se tocó**.

## LO QUE NO SE TOCÓ

**La dependencia npm `agentation` sigue intacta y en uso.** Es producto vivo, distinto de estas
skills: `package.json:58` declara `agentation ^3.0.2` y `package.json:85` `agentation-mcp ^1.2.0`;
`app/layout.tsx:13` importa `Agentation` y `app/layout.tsx:341` la monta. También conservan su
estado `e2e/sin-scroll-horizontal.spec.ts`, que oculta ese toolbar, y las menciones en
`app/page.tsx:410` y `docs/audits/2026-09-05-codex-engineering.md:20`. Esta rama no cambia el
toolbar ni su configuración: retira únicamente la documentación de agente sobre él.

Los handoffs históricos que mencionan el borrado son evidencia fechada y se conservan.

## VALIDACIÓN

- `node scripts/build-docs-index.mjs --check`: **PASÓ**, índice sincronizado con 437 specs.
- `node scripts/check-numbering.mjs`: **PASÓ**, sin números repetidos. Los cinco avisos de choque
  histórico (0336, 0342, 0362, 0363, 0394) son previos y ajenos a esta tarea.
- Búsqueda de referencias vivas a las rutas borradas fuera de `.agents/handoffs/`: la única era
  `skills-lock.json`, atendida arriba. Después del cambio no queda ninguna.
- Control de formato antes de escribir `skills-lock.json`: se verificó que el archivo es idempotente
  bajo `JSON.stringify(obj, null, 2)`, así que el diff son exactamente las 12 líneas de las dos
  entradas y ninguna reindentación.
- `pnpm verify`: **NO EJECUTADO**, no aplica. No hay cambio de producto ni de sus pruebas; el
  worktree no tiene dependencias instaladas por diseño del harness.

## PENDIENTES

Revisión y decisión de integración del Director/Sam. La PR queda en borrador: no se pide merge.

## FUERA DE ALCANCE DETECTADO

`skills-lock.json` declara ocho skills más (`find-skills`, siete `higgsfield-*`) que no existen en
`.agents/skills/`, y `.claude/skills/` contiene dos (`revisar-datos-ve`, `ui-pro`) que el manifiesto
no declara. El manifiesto y el árbol de skills no describen lo mismo. Merece revisión propia; no se
tocó acá.
