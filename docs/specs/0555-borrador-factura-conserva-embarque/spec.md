---
sdd: "0555"
title: "El borrador de factura conserva el embarque de cada línea"
status: in-progress
author: "founder"
created: 2026-10-18
updated: 2026-10-18
supersedes: null
superseded_by: null
related: ["0021", "0054", "0543"]
confidencialidad: interno
---

# SDD-0555 — El borrador de factura conserva el embarque de cada línea

> Editar en el Studio un borrador de varios embarques ya no borra el `shipmentCode` de sus líneas: el Portal sigue listando los embarques de la factura y sumando su medida.

## Contexto

El diagnóstico contable del 2026-10-18 (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`, fase 1, tarea 1.5) registró el hallazgo FAC-08 (`docs/audits/2026-10-18-contabilidad-anexo-hallazgos.md`), confirmado por el revisor de código.

El cargador de consolidados (SDD-0543) crea un borrador por cliente y contenedor con una línea por embarque, cada una con su `shipmentCode`. El Portal usa esas claves para listar los embarques de la factura y sumar su medida en la puerta del detalle y en la aceptación de T&C (`lib/portal/portal-legal-queries.ts`, `embarquesDeLasLineas`). El tipo `InvoiceLine` admite el campo desde la revisión de la PR #260.

El camino de edición del Studio lo soltaba en tres puntos:

1. **Al leer:** `coerce` (`lib/studio/invoice-queries.ts`) rearmaba cada línea solo con `desc`, `qty` y `unitPrice`, así que el drawer nunca recibía el código.
2. **En el drawer:** `toDraft` y `draftToLines` (`InvoiceDrawer.tsx`) tampoco lo llevaban.
3. **Al guardar:** `normalizeLines` (`lib/studio/invoice-types.ts`), que usan `parseLines` y `validateInvoiceInput`, solo conservaba los tres campos, y `updateInvoice` persistía esas líneas.

Una corrección de precio en el Studio dejaba la factura sin saber qué embarques cubría. No había aviso ni prueba que lo detectara.

## Decisión

- Un solo lector del código por línea: `lineShipmentCode(raw)` devuelve el texto recortado, o `undefined` si viene vacío, en blanco o no es texto. Lo usan los tres puntos, y una línea sin código no recibe la clave.
- `normalizeLines` y `coerce` conservan `shipmentCode`.
- Las funciones del drawer pasan a `lib/studio/invoice-types.ts` como `linesToDraft` y `draftToLines` (con el tipo `DraftInvoiceLine`) para poder probarlas sin montar el componente. El código viaja oculto: el drawer no lo muestra ni lo edita, y una línea nueva nace sin código.
- No cambia nada visible, ni el esquema, ni las acciones del servidor.

**Límite conocido.** Como el código no se ve, si el operador reutiliza una línea (le cambia la descripción para cobrar otra cosa) o pasa el borrador a otro Shipping Mark, el código viejo sigue en la línea. El Portal no filtra los códigos por Shipping Mark, así que sumaría ese embarque. Hoy solo se limpia borrando la línea. Esto lo resuelve mostrar el embarque por línea en el drawer (ver «Fuera»).

## Alcance

Dentro: conservar el código en la lectura, el drawer y la escritura; pruebas de regresión con control rojo.

Fuera:

- Mostrar o editar el embarque de cada línea en el drawer. Lo sugería el hallazgo, pero es un cambio visible que pide su propia spec con `/ui-check`.
- La tabla `invoice_lines` con `shipment_id`, servicio y cuenta de ingreso (fase 2 del plan).
- La aceptación de T&C, que sigue sellando la medida del primer envío (`shipment_code`). Es una limitación conocida de la SDD-0543.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/invoice-types.ts` | `lineShipmentCode`, `DraftInvoiceLine`, `linesToDraft`, `draftToLines`; `normalizeLines` conserva el código |
| `lib/studio/invoice-queries.ts` | `coerce` conserva el código de cada línea |
| `app/studio/(app)/facturacion/_components/InvoiceDrawer.tsx` | usa `linesToDraft`/`draftToLines` de `lib/` en lugar de las copias locales |
| `lib/studio/__tests__/invoice-lines-shipment-code.test.ts` | prueba nueva: las funciones puras de los tres puntos y su encadenado |
| `app/studio/(app)/facturacion/_components/InvoiceDrawer.conserva-embarque.test.tsx` | prueba nueva: el drawer montado en edición, leyendo el input oculto `lines` |
| `app/studio/(app)/facturacion/__tests__/update-invoice-conserva-embarque.test.ts` | prueba nueva: lo que `updateInvoice` persiste |
| `docs/specs/0555-borrador-factura-conserva-embarque/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0555-borrador-factura-conserva-embarque.md` | handoff |

## Criterios de aceptación

1. `normalizeLines` devuelve el `shipmentCode` de cada línea, recortado. Si viene vacío, en blanco o no es texto, la línea no lleva la clave.
2. `getInvoiceByCode` entrega cada línea con su código y no se lo inventa a la que no lo tiene.
3. `draftToLines(linesToDraft(lines))` devuelve las mismas líneas. Cambiar la descripción o el precio no suelta el código, y una línea agregada nace sin él.
4. El drawer montado en edición pone en el input oculto `lines` el código de cada línea. Corregir un precio no lo suelta, y una línea agregada sale sin la clave.
5. `updateInvoice` persiste en `invoices.lines` el código de cada línea, recortado. Los embarques que junta el Portal son los mismos y salen en el mismo orden: el exceso de peso de un embarque no suma un tercero.
6. Control rojo: cada una de estas regresiones hace fallar alguna de las pruebas de la tarea:
   - quitar la conservación del código en `normalizeLines`, `coerce`, `linesToDraft` o `draftToLines`;
   - volver a un `toDraft` local en el drawer;
   - que `parseLines` suelte el código;
   - dejarle a una línea sin código la clave `shipmentCode: undefined`.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| FRM-01 | no aplica | el formulario no cambia campos, errores ni validación visibles |
| AUD-01 | no aplica | no cambia qué se audita; la escritura de la factura sigue igual |
| A11Y-01, BTN-01, VIS-01 | no aplica | no hay cambio visual ni de interacción |

## Validación

Ver el handoff `.agents/handoffs/0555-borrador-factura-conserva-embarque.md`.
