---
sdd: "0562"
title: "«Por contabilizar» cuenta los recibos como la radiografía"
status: in-progress
author: "founder"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0557", "0559"]
confidencialidad: interno
---

# SDD-0562 — «Por contabilizar» cuenta los recibos como la radiografía

> El subdiario de clientes de «Por contabilizar» (SDD-0557) y la radiografía de integridad (SDD-0559) dicen lo mismo cuando un recibo en bolívares o yuanes vuelve «no comparable» la cuenta 1.1.2.

## Contexto

La fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`) busca **una sola cifra**: con el mismo dato, Reportes, «Por contabilizar» y la radiografía tienen que contar igual.

La revisión de la SDD-0559 encontró una divergencia con la SDD-0557, ya integrada. En el subdiario de clientes, el lado 1.1.2 se vuelve «no comparable» cuando un documento en VES o CNY tiene asiento vivo (decisión 7 del Director). Las dos definiciones difieren para los recibos:

| | SDD-0557 (K10, antes de esta SDD) | SDD-0559 (radiografía) |
|---|---|---|
| Recibo vivo en VES/CNY con asiento `receipt` vivo | cuenta | cuenta, **si toca 1.1.2** |
| Pago sin referencia (sin factura), asentado a 2.1.8 | cuenta | **no cuenta**: no toca 1.1.2 |
| Recibo identificado sin `receipt_reclass` vivo | cuenta | **no cuenta**: su único asiento va a 2.1.8 |
| Recibo identificado con su `receipt_reclass` vivo | cuenta | cuenta |

**Decisión del Director, 2026-10-19 (revisable por Sam):** «Divergencia con la 0557: se alinea, no se acepta. La definición canónica es la de la radiografía, la que cuenta solo los recibos que tocan 1.1.2. El principio de la fase es "una sola cifra" y tres lugares que cuenten igual. Abre una SDD de seguimiento chica, que alinee el K10 de la 0557 con la 0559 y lleve una prueba que compare las dos definiciones sobre el mismo fixture.»

Hoy no cambia ninguna cifra en producción: la radiografía del 2026-10-18 midió 0 asientos vivos.

## Decisión

- Hay una función pura nueva, `reciboVuelveNoComparable` (`lib/studio/accounting/libro-control.ts`), con la misma regla que la radiografía. Un recibo vuelve «no comparable» a 1.1.2 si cumple todo esto:
  - está vivo;
  - está en VES o CNY;
  - tiene factura (`invoice_id`);
  - si fue identificado (`identified_at`), tiene su reclasificación viva;
  - tiene al menos un asiento de cobro vivo.
- `reclasificacionesPorRecibo` cuenta los `receipt_reclass` vivos de cada recibo, unidos por cualquiera de los dos lados, sin contar dos veces el mismo asiento.
- `cuadreDelLibro` (`lib/studio/accounting/libro-control-queries.ts`):
  - lee además `invoice_id` e `identified_at` de los recibos;
  - suma `receipt_reclass` a los asientos que lee (el cruce de «sin asiento» no la usa: filtra por origen);
  - calcula `recibosNoUsdConAsiento` con la regla nueva.
- No cambian el resto del subdiario, las pantallas ni el CSV.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/accounting/libro-control.ts` | `ReciboDelSubdiario`, `reciboVuelveNoComparable`, `reclasificacionesPorRecibo` |
| `lib/studio/accounting/libro-control-queries.ts` | recibos con `invoice_id` e `identified_at`; asientos con `receipt_reclass`; el conteo del K10 con la regla nueva |
| `lib/studio/accounting/__tests__/libro-control.test.ts` | pruebas puras de la regla y del conteo de reclasificaciones |
| `lib/studio/accounting/__tests__/libro-control-queries.test.ts` | el recibo del K10 con factura; pago sin referencia, identificado sin reclasificar y reclasificado |
| `scripts/__tests__/subdiario-radiografia-paridad.test.ts` | nuevo: compara las dos definiciones sobre la fixture de la radiografía |
| `docs/specs/0562-subdiario-alineado-con-radiografia/spec.md` | esta spec |
| `docs/specs/0557-reportes-contables-una-cifra/spec.md` | nota de que el K10 se alineó en la SDD-0562 |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0562-subdiario-alineado-con-radiografia.md` | handoff |

## Criterios de aceptación

1. Un pago sin referencia en VES, con asiento `receipt` vivo, deja clientes «cuadra».
2. Un recibo identificado sin reclasificar (o con la reclasificación anulada) deja clientes «cuadra». Con la reclasificación viva, da «no comparable».
3. Un recibo en VES con factura y asiento vivo sigue dando «no comparable».
4. **Paridad:** sobre la fixture de la radiografía (`scripts/qa/radiografia-integridad.fixture.sql`), el número de tenants que «Por contabilizar» marca «no comparable» en clientes es igual a la fila 91 de la radiografía, tenant por tenant. Con la regla vieja del K10, la prueba falla.
5. Control rojo: cada condición de `reciboVuelveNoComparable` y la lectura de `invoice_id`, `identified_at` y `receipt_reclass` tienen un mutante que muere.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| ERR-01, VIS-01, A11Y-01, BTN-01 | no aplica | no cambian textos, estados visibles, errores ni botones |
| AUD-01 | no aplica | solo lectura |

## Validación

Ver el handoff `.agents/handoffs/0562-subdiario-alineado-con-radiografia.md`.
