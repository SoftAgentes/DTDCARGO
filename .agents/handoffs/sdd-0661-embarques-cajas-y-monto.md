# Handoff · SDD-0661 — Totales del contenedor en Embarques

Fecha: 2026-11-18 · Owner: Worker `worker-0661-vigorous-perlman` · Rama `feat/sdd-0661-embarques-cajas-y-monto`
· Worktree `.claude/worktrees/vigorous-perlman-a5e64a` · Base `origin/main` `26c54808c` · SDD asignada por el DG.

Encargo de Sam (2026-11-18, reunión con la oficina, por el DG) y diseño elegido ese día («Franja +
Excel», maqueta con datos inventados que pasó el DG). Spec:
`docs/specs/0661-embarques-cajas-y-monto-por-contenedor/spec.md`. Sin migración.

## Hecho

- **Cabecera cerrada:** pastillas de clientes, envíos, cajas y m³. Sin dinero.
- **Al abrir el contenedor:** franja de totales (Clientes · Cajas · Cajas recibidas · CBM total) y la
  tabla «Detalle por cliente» (Envíos · Cajas · Recibidas · m³) con la fila «Total del contenedor».
  Debajo sigue el acordeón de la 0643, que también dice «N cajas».
- **Cajas:** `consolidation_items.pieces` de la asignación vigente (`cajasPorEmbarque`), lo que escribe
  la carga de consolidados.
- **Cajas recibidas:** recepción VE (`warehouse_receipts_ve` por ISO del contenedor →
  `warehouse_receipt_ve_boxes` escaneadas, por Shipping Mark). Sin recepción, o si la lectura falla,
  dice «Sin recepción». Fuente y textos: decisión de Sam (2026-11-18, por el DG).
- **Por cobrar / cobrado:** de `invoices` vivas no anuladas por `shipment_id` (`total_amount` /
  `paid_amount` en USD; los borradores cuentan). En la franja y como columnas. «Sin facturar» si no hay
  facturas; «No disponible» si la lectura falla.
- **Permiso en el servidor:** `page.tsx` lee `invoices` solo si el rol es accounting o admin Y
  `moduleViewDenial(supabase, "invoices") === null`. Sin permiso no hay consulta y no existe la prop
  `montos`. El DG confirmó la puerta el 2026-11-18. La condición del rol se agregó al registrar la
  lectura en la frontera SDD-0357: la RLS `invoices_accounting_select` (0414) solo deja leer a esos dos
  roles, y un extra de la 0622 vería «Sin facturar» sin ser cierto.
- **Frontera SDD-0357:** `lib/studio/embarques-contenedores-queries.ts`: 1 en el inventario de
  `scripts/__tests__/invoice-read-boundary.test.mjs` (21 → 22 archivos, 46 → 47 lecturas).

## Evidencia

| Comprobación | Resultado |
|---|---|
| `node scripts/build-docs-index.mjs` / `--check` | PASÓ (642 specs) |
| `node scripts/check-numbering.mjs` | PASÓ (choques históricos 0342/0394 conocidos) |
| `git diff --check` | PASÓ |
| `/ui-check` | OK (montos y cifras con `nowrap`; tokens; `Badge`; `fmtUsd`) |
| vitest Embarques + lib + frontera de facturas (13 archivos, `--pool=threads --maxWorkers=1`) | PASÓ (156 pruebas) |
| `pnpm typecheck` | PASÓ |
| eslint de los archivos tocados | PASÓ |
| `pnpm verify` completo, Docker, e2e | NO EJECUTADO (turno del DG cubrió install, pruebas, typecheck y lint; el portón es el CI) |

## Pruebas nuevas

- `app/studio/(app)/embarques/__tests__/page-monto-por-rol.test.ts`: corre con la matriz real.
  commercial, operations, support, warehouse y marketing no consultan `invoices` ni reciben `montos`;
  accounting y admin sí.
- `lib/studio/__tests__/embarques-cajas-y-monto.test.ts`: cajas vigentes; sumas por cliente y por
  contenedor; filtro; FCL con 0; recibidas (0 contra «Sin recepción»); lectura VE por ISO, recepciones borradas,
  sin escanear y fallas; montos por embarque (USD, borradores, anuladas, otra moneda, cobrado).
- `app/studio/(app)/embarques/_components/__tests__/EmbarquesClient.cajas-monto.test.tsx`: render de la
  cabecera cerrada, la franja y la tabla, con y sin montos, «Sin facturar», «No disponible» y «Sin recepción».

## Impacto documental

Spec nueva 0661 e índice regenerado. Sin cambios en BRAND ni Norte: se reutilizan `Badge`, tokens y
`fmtUsd`.

## Pendientes de esta tarea

- (Hecho) Fuente de «cajas recibidas» y definición de por cobrar/cobrado: decisiones de Sam en la spec §3 y §4.2.
- CI de la PR y revisión independiente.
- Revisión independiente (la lanza el DG).

## FUERA DE ALCANCE DETECTADO

- `moduleViewDenial` vuelve a llamar a `getStudioAccess` cada vez; esta página ya hace tres lecturas de
  acceso (`tracking`, `invoices` y la del borrado). Si no está memoizado, son consultas repetidas.
