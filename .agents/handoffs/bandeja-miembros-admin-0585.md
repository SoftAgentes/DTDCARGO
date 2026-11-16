# Handoff — lista de miembros de la Bandeja (enmienda SDD-0585)

Fecha: 2026-11-16. Task ID: `bandeja-miembros-admin-0585`. Worker Claude Code, rama `claude/dreamy-brattain-f42c87`, worktree `dreamy-brattain-f42c87`, desde `origin/main` `b9b29db96`. Reporta al Subdirector de Chatwoot.

Estado: lista para fusión por el DG. PR [#618](https://github.com/SoftAgentes/DTDCARGO/pull/618). Revisión independiente: aprobada con menores, aplicados en el segundo commit (`import "server-only"` y allowlist en la spec).

## Qué cambia

- `lib/studio/chatwoot/bandeja-miembros.ts` (nuevo): `miembrosDeBandeja(access, crearClienteAdmin)`. Si `role !== "admin"` o no hay `tenantId`, devuelve `[]` sin crear el cliente admin; si no, `listMembers(admin, { tenantId })`.
- `app/studio/(app)/bandeja/page.tsx`: usa esa función dentro del gate existente `access.role === "admin" && access.tenantId && cfg`.
- `lib/studio/chatwoot/__tests__/bandeja-miembros.test.ts` (nuevo): doble que aplica `eq`/`is` y modela la RLS.
- Nota en `docs/specs/0585-chatwoot-bandeja-studio-e2/spec.md`. Sin migración.

## Revisión de las acciones (condición 4)

`vincularAgente` (`actions.ts:167-174`) y `altaAgente` (`actions.ts:259-266`) validan al miembro con `createAdminClient()`, filtrando por `gate.tenantId`, `user_id` y `disabled_at is null`, tras `tenantAdminGate`. No tienen el defecto de RLS; no se tocaron. `altaAgente` además lee overrides (`actions.ts:268`) con el cliente admin.

## Comprobaciones

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` (local) | PASÓ |
| Vitest del archivo nuevo, sobre `2c1614b8f` | PASÓ, 3 de 3 |
| Vitest tras añadir `import "server-only"` | NO EJECUTADO localmente: `vitest.config` alias `server-only` a un stub vacío y otros tests de `lib/studio/chatwoot/__tests__` ya importan módulos server-only; lo cubre el CI |
| `pnpm verify` local | NO EJECUTADO (el portón es el CI) |
| Calidad continua en GitHub | ver el comentario de cierre de la PR para la cabeza final |

## FUERA DE ALCANCE DETECTADO

- Ninguno hasta ahora.
