# Retirar ventanas de publicación

- Rama: claude/retirar-ventanas-publicacion-9edc35 · Alcance: solo docs de gobernanza.
- Decisión de Sam (2026-11-22): «Omite la regla del horario. Si no están ocupados, vamos a estar publicando… en el momento en que hay que publicar, que se publique. Borra eso y reorganiza natural; esa regla ya no es para todo».
- Cambios: `AGENTS.md` (viñeta «Publicar», sin «De noche no se publica», frontera de producción web), `docs/runbooks/codex-engineering.md` (sección Publicar), `.agents/skills/director/SKILL.md` (mismas reglas, hallado con git grep).
- Validación: `pnpm governance:check` PASÓ (cápsula vigente), `docs:check` PASÓ, `sdd:check` PASÓ. vitest/verify NO EJECUTADO (encargo).
- Impacto documental: canónicos actualizados arriba. Sin pendientes.
- FUERA DE ALCANCE DETECTADO: `.github/workflows/publicable.yml:12` menciona «una ventana» en un comentario; no se tocó.
- Handoff al Director: PR del carril rápido, sin fusionar.
