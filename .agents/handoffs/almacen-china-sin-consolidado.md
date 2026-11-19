# Handoff — Almacén China sin lo consolidado (spec en borrador)

Fecha: 2026-11-19 · Rama: `claude/interesting-darwin-9a1100` · Base: `origin/main` `c04f18fca`

## Hecho

- Medido en código (sin leer producción) por qué lo del contenedor 64 sigue en Almacén China. Causa: la
  carga sí deja las recepciones `consolidado` y los embarques `in_transit`; la tabla de Almacén China
  arranca en «Todos» y no esconde lo consolidado. Detalle con archivo:línea en la spec, §1.
- Spec en borrador: `docs/specs/0682-almacen-china-sin-consolidado/spec.md` (SDD-0682, asignada por el DG el 2026-11-19).

## Pendiente de esta tarea

- Sam contestó el 2026-11-19 (spec §5): las tres vistas van dentro de Almacén China (en almacén, en
  camino, pendiente por liberar). Abiertas: A (Embarques), B (quién marca el telex), C (`cerrado`), D (contador).
- Conteo en producción autorizado: la consulta (solo lectura, solo conteos) se entregó al DG, que la corre.
  Falta anotar el resultado en la spec §5.
- No existe dato de telex release: hace falta migración (número del DG; aplicar solo con OK de Sam).
- Producto solo con la spec aprobada.

## Pruebas

- Solo docs: ver el registro de comprobaciones de la PR. Producto: NO EJECUTADO (no hay
  cambios de producto).

## FUERA DE ALCANCE DETECTADO

- La carga de consolidados crea recepciones `WR-C<n>-*` nuevas y no enlaza ni cierra recepciones registradas
  antes a mano (`scripts/consolidados/lote-sql.ts:600`). Si el conteo encuentra duplicados, otra SDD.
