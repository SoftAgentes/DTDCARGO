# Handoff de cierre — SDD-0172, SDD-0118 y CMP-01 P1–P2

| Control | Valor |
|---|---|
| Fecha | 2026-07-29 |
| Rol | ventana autónoma en worktree aislado |
| Rama | `codex/sdd-0172-ephemeral-cmp-01` |
| Worktree | `C:\Users\Trabajo\Desktop\Developer\software\DTD-worktrees\sdd-0172-ephemeral-cmp-01` |
| Destino autorizado | `origin/main` |
| Estado previo al push | limpio · 17 commits propios · 0 detrás |
| Tiempo/tokens | n/a |

## Alcance cerrado

- SDD-0172 recibió cinco recorridos efímeros fail-closed; todos terminaron con
  teardown terminal y el inventario remoto volvió a mostrar sólo `main`.
- SDD-0118 reparó forward-only el historial reproducible mediante `0271`,
  `0272`, `0273` y `0274`, aplicadas individualmente con autorización,
  postcondiciones y recibos.
- `0275_restore_pin_search_path_history` quedó diseñada, generada y aprobada
  localmente; no fue aplicada en Cloud.
- CMP-01 quedó poblada y validada con `ConfirmDialog` como único componente
  real, con destino normativo repo/team.
- PLG-01 conserva diseño documental; PLG-P3 y posteriores permanecen cerrados.
  No existe plugin ni marketplace.

## Propiedad

El lote propio es el rango:

```text
origin/main..aed1cbfbcae43621bd209fc5ca2eba5a538381f0
```

Contiene 17 commits atómicos sobre documentación de gobernanza, registro
CMP-01, generadores SDD-0118, migraciones `0271`–`0275` y sus pruebas. El
preflight de cierre no encontró cambios staged, unstaged ni untracked.

## Verificación

- `node scripts/build-sdd-0118-repair.mjs --check`: verde.
- Vitest focal SDD-0118: 10/10.
- PostgreSQL 15 y 17 para `0275`: UPDATE 1, UPDATE 0, 33 firmas y rollback.
- `pnpm.cmd typecheck`: verde.
- ESLint proporcional del generador y su unit: verde.
- `pnpm.cmd docs:check`: verde.
- `git diff --check`: verde.
- residuo Docker propio: cero.

## Cloud y datos

- Aplicadas con autorización exacta: `0271`, `0272`, `0273`, `0274`.
- No aplicada: `0275_restore_pin_search_path_history`.
- No se leyó PII ni filas de negocio.
- No hubo cambios en Vercel.
- No se abrió CMP-01 v1.1, caso deprecated, D1, slices de adopción, D2–D5 ni
  PLG-P3.

## Tareas y worktrees

La inspección de tareas de Codex encontró sólo esta tarea en estado `active`.
Las demás tareas DTDCargo visibles estaban `notLoaded`. Todos sus worktrees,
ramas y cambios se conservaron sin modificación.

## Publicación y limpieza

El founder autorizó `cerrar`, commit y push. Este handoff forma parte del lote
que se publicará por fast-forward a `origin/main`; el recibo final de la tarea
debe verificar `HEAD = origin/main`.

No se limpia este worktree durante el mismo cierre porque la tarea actual aún
usa su `cwd`. Tampoco se elimina ningún otro worktree o rama.

## Pendientes

1. Autorizar expresamente y aplicar individualmente
   `0275_restore_pin_search_path_history`.
2. Crear después otro entorno efímero y completar replay, seed, E2E,
   verificación y teardown terminal.
3. Mantener CMP-01 v1.1 y el caso deprecated cerrados hasta completar
   SDD-0172.
4. Ejecutar con gates propios D1, slices de adopción y D2–D5.
