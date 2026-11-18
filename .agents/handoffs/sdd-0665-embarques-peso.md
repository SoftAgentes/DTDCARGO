# Handoff · SDD-0665 — Peso total del contenedor y por cliente

Fecha: 2026-11-18 · Owner: Worker `worker-0665-embarques-peso` · Rama `codex/sdd-0665-embarques-peso`
· Worktree `DTD-worktrees/sdd-0665-embarques-peso` · Base `origin/main` `53c3495c4` (con la 0661 fusionada,
#672) · SDD asignada por el DG.

Pedido de Sam en la reunión del 2026-11-18, por el DG. Spec:
`docs/specs/0665-embarques-peso-por-contenedor/spec.md`. Sin migración.

## Medición (spec §2)

- El peso declarado existe y sale del Excel de carga: la carga de consolidados escribe el mismo `peso` en
  `shipments.weight_kg`, `consolidation_items.weight_kg` y `warehouse_receipts_cn.total_weight_kg`.
- En Venezuela no se pesa nada: el escaneo solo marca `scanned_at`, y el `weight_kg` de
  `warehouse_receipt_ve_boxes` es una copia del peso de origen al crear la recepción.

## Propuesta (el DG la dio por razonable el 2026-11-18; decisión pendiente de Sam, spec §3)

- Peso = `shipments.weight_kg`, la misma fila del envío de la que ya sale el CBM.
- «Peso recibido» no se muestra: no hay un peso medido. Medirlo exige migración; «peso declarado de las
  cajas recibidas» sería una columna más, sin migración, si Sam la quiere.

## Hecho

- `agruparPorContenedor`: `pesoKg` y `enviosSinPeso` por contenedor, y `enviosSinPeso` por cliente (el
  peso por cliente es `stats.totalWeight`, que ya existía).
- Franja: «Peso total» (o «Sin peso») y el aviso «N envíos sin peso cargado».
- Tabla: columna kg por cliente y en «Total del contenedor»; un cliente sin peso dice «Sin peso».

## Evidencia

| Comprobación | Resultado |
|---|---|
| docs:check / sdd:check / git diff --check | PASÓ (645 specs) |
| vitest de Embarques + lib (13 archivos, `--pool=threads --maxWorkers=1`) | PASÓ (156 pruebas) |
| `pnpm typecheck` | PASÓ |
| eslint de lo tocado | PASÓ |
| `pnpm verify` | NO EJECUTADO (el portón es el CI) |

## Pendientes de esta tarea

- Decisión de Sam sobre la fuente del peso y sobre «peso recibido» (spec §3).
- Pruebas con turno, traer main (entra la tanda #675) y abrir la PR.

## FUERA DE ALCANCE DETECTADO

- Las «cajas recibidas» de la 0661 dependen de que exista la recepción VE del contenedor (se crea en
  `warehouse-receipt-ve-queries.ts`). Si la oficina no crea esa recepción al llegar el contenedor, la
  columna siempre dirá «Sin recepción».
