# Handoff — SDD-0711 Embarques: cajas y CBM por proveedor

Fecha: 2026-11-23 · Rama: `claude/priceless-archimedes-7bd0ac` · Autor: Worker para Dir_DTD

## Qué se hizo

Pedido de Sam: «Se debe agregar el total de cajas que tiene cada proveedor» en el panel «Detalle del envío»; luego
pidió que cada proveedor diga también su CBM. Eligió la opción A (campo «Cajas» + sección «Por proveedor»).

- `lib/studio/cajas-por-proveedor.ts`: agrupación pura y `estadoDeCajas` (listo / sin recepción / no disponible).
- `lib/studio/cajas-por-proveedor-queries.ts`: una lectura a `warehouse_receipts_cn` (`consolidado`, `deleted_at is null`).
- `page.tsx` → `EmbarquesClient` → `ShipmentDetailDrawer`: prop `cajasPorEnvio` / `cajas`.
- Pruebas: `cajas-por-proveedor.test.ts` y `ShipmentDetailDrawer.cajas.test.tsx`.
- Spec: `docs/specs/0711-embarques-cajas-por-proveedor/spec.md`. Sin migraciones, permisos ni escrituras.

## Evidencia

- vitest (2 archivos nuevos + carpeta `embarques/_components/__tests__`): PASÓ, 13 archivos, 121 pruebas.
- `tsc --noEmit`: PASÓ. `eslint` de los 7 archivos de código: PASÓ.
- `pnpm docs:check`: PASÓ tras `pnpm docs:index` (índice de specs regenerado). `pnpm sdd:check`: PASÓ.
- `pnpm verify` completo: NO EJECUTADO (el portón es el CI de GitHub, por indicación de Dir_DTD).
- Panel con datos reales: NO VERIFICADO (no se leyeron filas de producción).
- Carril: `node scripts/carril.mjs` lo decide en la PR.

## Pendientes de esta tarea

- Revisión independiente (la lanza Dir_DTD) y CI en verde sobre la cabeza exacta.
- Revisión visual del panel con datos reales por Sam tras publicar (no se leyeron filas de producción).

## FUERA DE ALCANCE DETECTADO

- El panel muestra `Peso` «0,00 kg» cuando el envío no lo tiene (`weight_kg` null se ve «—», pero la captura de Sam
  muestra 0,00): revisar si el dato llega como 0. No se tocó.
- Peso por proveedor no se pidió; los datos existen (`total_weight_kg`) si se quiere después.

## Impacto documental

Spec 0711 nueva; el índice de specs puede necesitar `pnpm docs:check`.
