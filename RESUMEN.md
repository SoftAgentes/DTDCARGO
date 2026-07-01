# RESUMEN — Inventario del Portal del Cliente

**Rama:** `feat/portal-inventario`
**Worktree:** `C:/Users/Trabajo/Desktop/Developer/software/DTD-worktrees/portal-inventario`
**Base:** `main` @ `c2e8a8a7`
**Tipo de tarea:** exploración + diagnóstico (read-only). No se implementaron features.

## Qué hice
Inventario "¿qué le falta al portal camino al Norte?" con estado REAL en `main` (no ramas en vuelo). Método: lectura del código de `app/portal/**` + `lib/portal/**`, la RLS del portal (migr 0080/0081/0085/0086/0117/0145/0187) y el Norte visual (`docs/design/studio/_norte/`), más 3 exploradores en paralelo (mapa de rutas / gaps vs Norte / auditoría de capa de datos).

## Entregable
- **`INVENTARIO-PORTAL.md`** (raíz del worktree) — 4 secciones: (1) mapa de 23 rutas, (2) faltantes priorizados con ⭐/esfuerzo/deps, (3) deuda (RLS, nav, copy, a11y), (4) propuesta de SDDs (A hitos+push ⭐ / B cut-off / C UI v2).

## Hallazgos clave
- El portal está **muy por encima** del roadmap `portal-norte-erp-gaps.md` (obsoleto): asesor y Naviera Tier 1 ya en prod. `NORTE_PORTAL_LIVE = true` para todos.
- Falta real: **hitos con fecha (`shipment_events`) + push de estado al cliente** (⭐), **cut-off de zarpes** (`sailings` ya existe), y piezas visuales del Norte nuevo (ciclo animado, nueva-compra 3-pasos, academia 2-col).
- RLS **sólida** (defensa en profundidad, sin fugas). Deuda menor: nav de 11 ítems en scroll sin overflow; `AccesoChip.soon` código muerto; `PortalHeader` comment stale; roadmap doc obsoleto.

## Archivos tocados
- `INVENTARIO-PORTAL.md` (nuevo)
- `RESUMEN.md` (este, nuevo)
- **Cero cambios de código** → no se corrió `verify.mjs` (no aplica).

## Pendientes / para el Director
- Decidir prioridad y abrir SDDs (números libres los asigna el Director; en main máx spec 0119 / migr 0189, ramas en vuelo hasta 0122 / migr 0191).
- Confirmar con el founder el punto #7 (reportar pago / subir comprobante) — probablemente intencional que no exista.
- Actualizar o marcar como superado `docs/architecture/portal-norte-erp-gaps.md`.
- Considerar cerrar SDD-0075 (`portal-norte-alineacion`) como done/superseded (sus 3 gaps ya están hechos).
- **No cerré integración** (merge/push/migraciones/specs) — eso lo hace el Director.
