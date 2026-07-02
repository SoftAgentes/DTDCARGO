# RESUMEN — lane marketing-modulos-neutrales (2026-07-02)

> Ventana secundaria · worktree `.claude/worktrees/marketing-modulos-neutrales` ·
> rama `worktree-marketing-modulos-neutrales`. **Sin push.** Sin migración.

## Qué hace

Resuelve la decisión que quedó pendiente del founder tras SDD-0139: **el rol
`marketing` ahora VE los 4 módulos transversales** del Studio. Antes la matriz
no se los daba y la URL le redirigía al dashboard.

## Cambio

`lib/studio/rbac.ts` — agrega `"marketing"` a la matriz `ROLE_MODULE_ACCESS` de:
- `dashboard` (cockpit operativo general — NO el módulo `marketing`, que ya trae
  su propio dashboard "buenos días")
- `calendar`
- `mentions`
- `bugs` + `mis-bugs`

NO se tocan módulos de dinero, admin-only ni operativos (embarques, tracking,
almacenes siguen sin marketing — no es su trabajo).

Además:
- `lib/studio/rbac-view-guard.test.ts` — comentario de la allowlist del
  `dashboard` actualizado (ya no cita a marketing como rol fuera de la matriz).
- `docs/architecture/rbac-hardening-2026-06.md` — el pendiente del founder queda
  marcado ✅ resuelto.

## Verificación

Tests RBAC 121/121; `node scripts/verify.mjs` (ver abajo el estado al cerrar).
Sin migración, sin cambios de firma — solo data de la matriz.

## Para el Director

Merge selectivo → verify → push con OK. Es capa de app pura (matriz en código,
la fuente de verdad por decisión SDD-0139).
