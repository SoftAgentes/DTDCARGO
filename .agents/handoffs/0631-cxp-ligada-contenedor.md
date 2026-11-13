# Handoff · SDD-0631 — CxP ligada a contenedor y embarque

- **Owner:** Worker (sesión hija del Subdirector de Contabilidad), claim `local_sdd0631`
- **Ruta:** `.claude/worktrees/sdd-0631-cxp-contenedor-5ae730`
- **Rama:** `claude/sdd-0631-cxp-contenedor-5ae730`, sale de `origin/claude/tren-ad` (ae1c0df80, tren AD #529), condición del DG
- **SDD:** [0631](../../docs/specs/0631-cxp-ligada-contenedor/spec.md) · migración **0536** (`pnpm sdd:next`: 0536 libre; la 0535 la tiene `claude/sdd-0569-bcv-carga-diaria`)
- **Permisos:** publicar la rama y abrir la PR contra main (autorizado en el encargo). No fusionar. No aplicar la 0536.

## OBJETIVO ORIGINAL

Que la CxP de un proveedor o aliado de espacio se pueda ligar a un contenedor (y, opcional, a un
embarque), y que ese costo llegue al margen del contenedor y del embarque sin contar doble.

## COMPLETADO

- **Migración 0536** (`supabase/migrations/0536_cxp_ligada_contenedor.sql`): `supplier_bills.consolidation_id`
  y `cost_category` (CHECK con las 7 categorías de Costing), dos índices parciales y el trigger
  `supplier_bills_validate_cost_link` (contenedor y embarque vivos del tenant, embarque dentro del
  contenedor, categoría obligatoria con vínculo). Idempotente; preflight y postflight. **No aplicada.**
- **Costeo** (`lib/studio/costing/cxp-ligadas.ts`, `queries.ts`): `allocateLinkedBills` (reparto por
  CBM, sin repartir si no hay CBM, USD con la tasa de la CxP, sin tasa contada aparte, excluye
  anuladas/borradas), `effectiveCosts` (la CxP **reemplaza** la categoría de `shipment_costs` que
  cubre) y `marginByContainer`. `costingRows` ahora aplica el costo efectivo, así que Dashboard y
  Reportes › Combinados reciben el mismo número. Sin la 0536, `linksAvailable: false` y sigue.
- **Tesorería:** bloque «Costo de contenedor» en la nueva CxP (contenedor → embarque opcional →
  categoría, por defecto flete) y en una CxP existente (ligar, cambiar, quitar) con la acción
  `linkBillCost`. Tipo de proveedor «Aliado de espacio» (`aliado_espacio`, sin CHECK SQL).
- **Costing:** pestaña **Contenedores** (revenue, costo, «De CxP», sin repartir, margen, margen %).
- **Camino operativo:** [`docs/runbooks/cxp-aliado-de-espacio.md`](../../docs/runbooks/cxp-aliado-de-espacio.md).

## VALIDACIÓN

| Comprobación | Resultado |
|---|---|
| `pnpm sdd:check` | PASÓ (sin números repetidos; solo choques históricos ya conocidos) |
| Contrato 0536 en PGlite (`cxp-ligada-contenedor.migration.test.ts`): verde, control rojo y 7 mutantes | PASÓ (9/9) |
| Unitarias del reparto y del margen por contenedor (`cxp-ligadas.test.ts`) | PASÓ (15/15) |
| Unitarias del vínculo en Tesorería (`cost-link.test.ts`) | PASÓ (14/14) |
| Punta a punta CxP → OP → asiento → margen (`cxp-ligada-punta-a-punta.test.ts`), con montos inventados | PASÓ (4/4). Mutante «sumar en vez de reemplazar» lo pone rojo |
| Suites vecinas: costing, treasury, tesorería, purchase-orders, dashboard, reports, reportes | PASÓ (12 archivos/250 y 23 archivos/429 pruebas) |
| `tsc --noEmit` | PASÓ |
| eslint de los archivos tocados | PASÓ |
| `pnpm docs:check` · `governance:check` · `components:check` | PASÓ |
| `pnpm verify` | PENDIENTE: se pidió turno a la sesión que me abrió |
| CI de la PR | PENDIENTE |
| Prueba visual en el navegador (`/ui-check`) | NO EJECUTADO: sin base local con la 0536 en esta sesión |

**Qué es doble en la prueba de punta a punta:** el posteo contable (registra monto y moneda que
recibe) y la RPC `register_supplier_payment_order` (se emula su efecto sobre la CxP). `createBillFor`,
`registerPaymentFor` y `costingData` corren reales sobre una base en memoria. El trigger se prueba
en PGlite, no en esa base.

## COMMITS

Ver `git log origin/claude/tren-ad..HEAD` en la rama (spec, migración, costeo, Tesorería, Costing,
prueba de punta a punta, docs).

## PR / BRANCH

Rama `claude/sdd-0631-cxp-contenedor-5ae730` · PR contra main, **depende del tren AD (#529)**.
Cuando AD entre a main: traer main una vez con merge, en su turno; sin rebase ni force push.

## PENDIENTES DE ESTA TAREA

- `pnpm verify` con turno y CI verde de la PR.
- Aplicar la 0536 en producción: con OK nominal de Sam y el runbook de migraciones. Hasta entonces
  Tesorería no muestra el selector y Costing avisa que el costo es solo el manual.
- Revisión visual de los dos bloques nuevos (`/ui-check`) con una base local que tenga la 0536.

## FUERA DE ALCANCE DETECTADO

1. **Auditoría del vínculo.** `audit_d2_financial_change` (0290) registra en `supplier_bills` solo
   código, proveedor, estado y moneda; cambiar el contenedor, el embarque o la categoría de una CxP
   cambia el margen y no deja evento. Propuesta: ampliar el payload D2 o una RPC con motivo.
2. **El cargador de consolidados mixtos registra el espacio como gasto.** `--gasto-espacio`
   (`docs/runbooks/cargar-consolidados.md`, SDD-0543) escribe en `expenses` colgado del envío FCL, y
   Costing no lee `expenses`. Si para un mismo contenedor se usa eso y además una CxP, el espacio
   queda en dos lugares contables. El runbook nuevo lo advierte; la decisión de un solo camino es
   de contabilidad.
3. **Una CxP de contenedor con embarques repartidos en dos contenedores:** el embarque recibe su
   parte por CBM y su costo vuelve a repartirse entre sus contenedores por fracción; el total se
   conserva pero parte del costo de un contenedor puede verse en otro. Caso raro; documentado en la
   spec como límite.

## Impacto documental

- Spec nueva y su índice (`docs/specs/README.md`), mapa módulo↔SDD (fila Tesorería), runbook nuevo.
- Graphify/Archify: no regenerados en este worktree; quedan para el cierre del Director sobre main
  integrada. `pnpm knowledge:status`: NO EJECUTADO.

## HANDOFF AL DIRECTOR

Revisar sobre todo: el reemplazo por categoría (`effectiveCosts`) como regla anti-doble-conteo,
la tolerancia a la base sin 0536 en `listCostLinks`/`listCostLinkData`, y el trigger de la 0536
antes de pedir el OK nominal para aplicarla.
