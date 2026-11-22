# Handoff — Almacén China sin lo consolidado (spec en borrador)

Fecha: 2026-11-19 · Rama: `claude/interesting-darwin-9a1100` · Base: `origin/main` `c04f18fca`

## Hecho

- Medido en código (sin leer producción) por qué lo del contenedor 64 sigue en Almacén China. Causa: la
  carga sí deja las recepciones `consolidado` y los embarques `in_transit`; la tabla de Almacén China
  arranca en «Todos» y no esconde lo consolidado. Detalle con archivo:línea en la spec, §1.
- Spec en borrador: `docs/specs/0682-almacen-china-sin-consolidado/spec.md` (SDD-0682, asignada por el DG el 2026-11-19).

## Pendiente de esta tarea

- Sam contestó el 2026-11-19 (spec §5): las tres vistas van dentro de Almacén China; el telex lo confirma
  China con botón y documento opcional, y en DTD sale «Liberado» en verde; «Pendiente por liberar» solo en
  el mar (~15 días antes de la ETA); el contador son los días a la ETA.
- Embarques: maqueta antes/después en `docs/specs/0682-almacen-china-sin-consolidado/assets/maqueta-embarques.html`,
  publicada en https://claude.ai/artifact/MnQ36KhNCemhmqjzoQuAS8. Sam eligió (a) para Embarques y dejó el deshacer del telex a operations y admin, con motivo. Spec aprobada por Sam el 2026-11-19 («Sí, apruebo 0682»); implementación en tarea aparte tras el merge.
- Conteo en producción corrido por el DG el 2026-11-19: sin duplicados, 111 recepciones del 64 consolidadas, 0 pendientes en el almacén (spec §5).
- No existe dato de telex release: migración propuesta en spec §2.4 (número del DG al programarse; aplicar solo con OK de Sam).
- Producto solo con la spec aprobada.

## Pruebas

- Solo docs: ver el registro de comprobaciones de la PR. Producto: NO EJECUTADO (no hay
  cambios de producto).

## FUERA DE ALCANCE DETECTADO

- La carga de consolidados crea recepciones `WR-C<n>-*` nuevas y no enlaza ni cierra recepciones registradas
  antes a mano (`scripts/consolidados/lote-sql.ts:600`). Si el conteo encuentra duplicados, otra SDD.
