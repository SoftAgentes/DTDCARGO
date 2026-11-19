# Handoff — Almacén China sin lo consolidado (spec en borrador)

Fecha: 2026-11-19 · Rama: `claude/interesting-darwin-9a1100` · Base: `origin/main` `c04f18fca`

## Hecho

- Medido en código (sin leer producción) por qué lo del contenedor 64 sigue en Almacén China. Causa: la
  carga sí deja las recepciones `consolidado` y los embarques `in_transit`; la tabla de Almacén China
  arranca en «Todos» y no esconde lo consolidado. Detalle con archivo:línea en la spec, §1.
- Spec en borrador: `docs/specs/NNNN-almacen-china-sin-consolidado/spec.md` (número pendiente del DG).

## Pendiente de esta tarea

- Número SDD del DG → renombrar carpeta y front-matter.
- Respuestas de Sam a las cuatro preguntas del §5 (una es un conteo en producción, que pide OK).
- Producto (filtro por defecto, pestañas de Embarques, enlace a Tracking `?g=mar`) solo con la spec aprobada.

## Pruebas

- Solo docs: `pnpm docs:check` / `pnpm sdd:check` cuando tenga número. Producto: NO EJECUTADO (no hay
  cambios de producto).

## FUERA DE ALCANCE DETECTADO

- La carga de consolidados crea recepciones `WR-C<n>-*` nuevas y no enlaza ni cierra recepciones registradas
  antes a mano (`scripts/consolidados/lote-sql.ts:600`). Si el conteo encuentra duplicados, otra SDD.
