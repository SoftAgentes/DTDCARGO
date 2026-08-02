# Cierre — SDD-0224 · protección de limpiadores de adjuntos

- Fecha: 2026-08-02
- Rama: `codex/sdd-0224-gastos-close`
- Worktree: `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0224-gastos-close`

## Alcance entregado

Se incorpora en SDD-0224 el mandato no negociable: los limpiadores heredados
deben continuar desactivados; no puede activarse un borrado físico a siete días.
Antes se exige cuarentena recuperable de al menos 30 días, restauración con
auditoría/checksum, respaldo externo inmutable probado, controles fail-closed y
purga física separada y autorizada. El piloto de Gastos no se implementa hasta
tener una allowlist autorizada de forma explícita.

## Rutas propias

- `docs/specs/0224-adjuntos-seguros-reanudables/spec.md`

## Verificación

- `pnpm.cmd docs:check` — OK.
- `git diff --check` — OK antes del commit.

## Entrega

- Commit de contenido: `aa5e9fc9 feat(studio): SDD-0224 — protege limpiadores de adjuntos`
- Publicado en: `origin/codex/sdd-0224-gastos-close`
- Migraciones / deploy / Supabase / Vercel: no aplicados ni modificados.

## Siguiente responsable

Integrador autorizado: revisar esta rama e integrar únicamente la SDD-0224.
