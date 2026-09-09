---
sdd: 0322
title: Relaciones de órdenes leídas en lote
status: done
author: Codex
created: 2026-09-02
updated: 2026-09-02
supersedes: null
superseded_by: null
related:
  - SDD-0071
  - SDD-0072
confidencialidad: interno
---

# SDD-0322 — Relaciones de órdenes leídas en lote

## Problema

Los listados de Compras asistidas y Órdenes de venta cargaban relaciones con
una consulta por cada orden. El primero hacía `N` lecturas de ítems; el segundo
hacía `2N` lecturas de prealertas y facturas. Además, esas lecturas cortaban a
500 o 200 filas sin poder demostrar que el resultado estuviera completo.

## Contrato

1. Los ítems de compra se consultan por conjuntos de ids, con lotes que respetan
   el tamaño seguro de una URL de PostgREST y paginación hasta página vacía.
2. Las prealertas y facturas de órdenes de venta siguen el mismo patrón y se
   agrupan por `sales_order_id` antes de llegar a la interfaz.
3. Las funciones de una sola orden conservan su firma pública delegando en los
   helpers batch.
4. Un resultado incompleto de ítems de compra falla explícitamente. Las
   relaciones de venta conservan su degradación histórica a colecciones vacías
   cuando la columna todavía no existe en un entorno atrasado.
5. La lectura continúa bajo la RLS del cliente Supabase recibido; no se agrega
   `service_role`, migración ni escritura.

## Aceptación

- Una prueba agrupa relaciones de al menos dos órdenes usando filtros `.in()`.
- El número de páginas consultadas no crece por cada orden dentro del lote.
- Los dos Server Components consumen los helpers batch y ya no contienen
  `orders.map(async ...)` para acceder a Supabase.
- `pnpm typecheck`, los tests focales y los checks de gobernanza/documentación
  terminan en verde.

## Gobernanza

- Clasificación: `cumplimiento` de aislamiento tenant mediante RLS existente.
- Clasificación: `no aplica` para políticas de UI; no cambia interacción,
  componente, copy ni visual.

## Allowlist exacta

- `lib/studio/purchase-orders/queries.ts`
- `lib/studio/sales-orders/queries.ts`
- `app/studio/(app)/ordenes-compra/page.tsx`
- `app/studio/(app)/ordenes-venta/page.tsx`
- `lib/studio/__tests__/orders-relations-batch.test.ts`
- `docs/specs/0322-relaciones-de-ordenes-en-lote/spec.md`
- `docs/specs/README.md`

## Fuera de alcance

- Alterar tablas, policies, índices o datos en Supabase.
- Cambiar los límites de los listados principales.
- Aplicar migraciones, desplegar o medir latencia en producción.
