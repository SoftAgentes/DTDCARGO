# Abrir Director y Workers en Codex

Dueño: Director de ingeniería · Estado: vigente · Fecha: 2026-09-05.

La carpeta determina el checkout real. Un prompt no cambia la rama por sí solo.

1. Abre Codex en la copia que contiene el harness e invoca `$director`.
2. Pide «Director, dime qué puedo trabajar en paralelo» para obtener objetivos,
   dependencias, SDD y prompts completos.
3. Crea cada Worker en modo worktree de Codex, o usa
   `node scripts/harness-worktree.mjs start <slug>` y abre la ruta devuelta:
   `codex --cd "<ruta-absoluta>"`.
4. Pega `$worker` con la asignación. Worker verifica aislamiento y reclama ownership.
5. Al retomar usa el handoff de su rama; no dependas de una conversación anterior.

[Procedimiento y autorizaciones](codex-engineering.md). Nunca abrir dos sesiones
escritoras en el mismo árbol. Si una sesión ya está activa, continuar esa tarea
o crear otra ruta; no cambiar su rama ni copiar sus modificaciones.
