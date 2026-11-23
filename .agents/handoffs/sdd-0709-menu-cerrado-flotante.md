# Handoff · SDD-0709 — menú lateral cerrado con lista flotante por grupo

- **Owner:** Worker (Claude) para Dir_DTD · sesión hija de `local_25e2dded…` (Director DTD)
- **Ruta:** `.claude/worktrees/carriles-integracion-305dae` · **rama:** `claude/quizzical-tereshkova-c7e72d`
- **SDD:** `docs/specs/0709-menu-lateral-cerrado-flotante/spec.md` (reserva `codex/sdd-reserve-0709`, publicada)
- **Fecha:** 2026-11-22

## OBJETIVO ORIGINAL

Con el menú del Studio cerrado, mostrar solo los cinco grupos (más el Dashboard) y abrir, al oprimir un grupo, una
lista flotante con sus módulos visibles para el rol. Pedido de Sam del 2026-11-22.

## COMPLETADO

- Spec con alcance, criterios, accesibilidad y allowlist exacta; índice de specs regenerado.
- `lib/studio/sidebar-grupos.ts`: icono por grupo y módulo suelto (Dashboard).
- `GrupoFlotante.tsx`: botón `aria-haspopup="menu"` + `aria-expanded`, lista `role="menu"` con flechas, Inicio/Fin,
  Esc (foco al botón), Tab y clic afuera; subgrupos para Almacenes y Despacho; contadores de CRM y Gastos.
- `StudioSidebar.tsx`: en cerrado pinta Dashboard + grupos; cierra la lista al navegar y al expandir. Menú abierto igual.
- `studio.css`: bloque `.studio-sb-grupo-*` / `.studio-sb-flot*` con tokens; activo en `--accion-soft`.
- Prueba `StudioSidebar-cerrado-flotante.test.tsx` (24 casos), con contrato de «no vuelven los módulos sueltos».

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm install --frozen-lockfile` | PASÓ |
| vitest `app/studio/(app)/_components/__tests__/` + contratos de hidratación, reconciliación y revisión 0686 (8 archivos, 79 pruebas) | PASÓ |
| Mutante: volver a pintar los módulos en cerrado | FALLA la prueba de contrato, como debe |
| `tsc --noEmit` | PASÓ |
| eslint de los 4 archivos tocados | PASÓ |
| `docs:check` / `sdd:check` | PASÓ |
| `carril.mjs` | **revisión previa** (StudioSidebar toca `canAccessModule`; `lib/studio/sidebar-grupos.ts` sin clasificar) |
| `pnpm verify` completo (build incluido) | NO EJECUTADO (Dir_DTD pidió no correr build; cubre el CI) |
| Revisión visual con el menú cerrado, claro y oscuro | NO EJECUTADO |

## COMMITS

- `4d7e394a1` reserva (stub) · `0028275d9` implementación · el commit de este handoff.

## PENDIENTES DE ESTA TAREA

- Revisión independiente (la lanza Dir_DTD) y CI verde en la cabeza exacta.
- Revisión visual para Sam (iconos de grupo y Dashboard suelto son propuesta mía, sin decisión de Sam: spec §6).

## FUERA DE ALCANCE DETECTADO

- `carril.mjs` clasifica `lib/studio/sidebar-grupos.ts` como «sin clasificar» por ruta; data pura de presentación.
  Si se quiere, añadir ese tipo de archivo a rutas seguras es tarea del harness, no de esta PR.

## Impacto documental

Spec nueva + índice. No cambian `app/studio/CLAUDE.md` ni el Norte (el menú abierto no cambia).
