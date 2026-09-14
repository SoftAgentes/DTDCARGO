# Handoff — borrar-cliente-revoca-portal (SDD-0467, migración 0454)

- Fecha: 2026-09-14
- Owner / sesión: worker-borrar-cliente-revoca-portal-20260914 (Claude Code, subagente Worker)
- Worktree: `C:/Users/AKX generator/Desktop/Developer/DTD-worktrees/borrar-cliente-revoca-portal`
- Rama: `codex/borrar-cliente-revoca-portal`
- Base: `origin/main` 2b1d7d84b0f54f2289b83bc0c80635619eff13b4
- Reserva SDD incorporada: cherry-pick de 7690b674 (`codex/sdd-reserve-0467-borrar-cliente-revoca-portal`)
- Estado de la tarea: en-progreso

## Contrato de la tarea

**Objetivo.** Al borrar un cliente en el Studio (borrado lógico), su acceso al Portal se revoca
en el mismo acto: su vínculo en `client_users` queda revocado y ningún enlace corto pendiente en
`portal_access_links` sirve. Decisión de Sam del 2026-09-14, textual: «borrar un cliente: debe
revocar el acceso. Así debe ser.»

**SDD.** `docs/specs/0467-borrar-cliente-revoca-portal/spec.md`. Migración asignada: 0454.

**Aceptación.**
1. Todo borrado lógico (acción del Studio o `merge_clients`) deja en la misma transacción cero
   `client_users` del cliente en `invited`/`active`, las revocadas con `revoked_at` y con
   `auth_user_id` y `token` en null, y cero `portal_access_links` del cliente sin usar y sin revocar.
2. Si la revocación falla, el borrado no ocurre y el Studio muestra el error.
3. `merge_clients` conserva su contrato: acceso mudado sigue activo en el superviviente; la ficha
   fusionada queda sin acceso ni códigos; la persona puede vincularse a otra ficha.
4. Tras el borrado `portal_bind_session()` no activa y el código corto no canjea; restaurar no
   devuelve el acceso.
5. Migración 0454 con preflight/postflight, funciones con search_path vacío y grants mínimos,
   backfill idempotente con conteos agregados, espera en el baseline y prueba SQL 0454.
6. Confirmación del drawer avisa la pérdida del acceso al Portal (tuteo, sin voseo).
7. Mapa de borrado actualizado; spec con allowlist exacta y revisión revisar-datos-ve.

**Alcance.** Migración y prueba 0454; espera en `supabase/migrations-baseline.json`; declaración
de símbolos sólo si el gate la exige; `app/studio/(app)/clientes/actions.ts`, texto de
`ClientDrawer.tsx` y sus tests; `lib/studio/portal/access-link.ts` sólo si el canje no rechaza
clientes borrados; spec 0467 e índice regenerado; `docs/legal/privacidad/mapa-de-borrado.md`;
este handoff.

**Excluidos.** Aplicar migraciones; leer producción; revocar a mano el vínculo huérfano; 0414,
0415, 0422, 0423 y sus esperas; archivos de la PR #114; archivos del rediseño del enlace del
proveedor (SDD-0468); helpers con limit 1; rehacer `merge_clients` más allá del contrato.

**Dependencias.** Ninguna.

**Permisos.** Commits locales selectivos; push de la rama propia y PR draft contra main
autorizados. Sin merge, deploy, migraciones, lectura de producción ni borrado de ramas/worktrees.
