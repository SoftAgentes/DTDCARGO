---
sdd: "0563"
title: "La factura en bolívares o yuanes no se convierte para cuadrar, y el borrador no cuenta"
status: in-progress
author: "founder"
created: 2026-10-19
updated: 2026-10-19
supersedes: null
superseded_by: null
related: ["0557", "0559", "0562"]
confidencialidad: interno
---

# SDD-0563 — La factura en bolívares o yuanes no se convierte para cuadrar, y el borrador no cuenta

> «Por contabilizar» (SDD-0557) y la radiografía de integridad (SDD-0559) dan el mismo estado de la cuenta 1.1.2, tenant por tenant y con el mismo dato.

## Contexto

La fase 1 del plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`) busca **una sola cifra**. La SDD-0562 alineó cuándo un recibo vuelve «no comparable» la 1.1.2, y su prueba de paridad midió otras tres diferencias entre las dos definiciones (handoff `.agents/handoffs/0562-subdiario-alineado-con-radiografia.md`, FUERA DE ALCANCE):

1. **Factura abierta en VES o CNY sin asiento** (tenant H de la fixture). La radiografía suma solo USD y USDT y da «cuadra», con el tenant en la fila 96. «Por contabilizar» convierte la VES con su tasa y da «no cuadra».
2. **Factura borrador en VES con asiento `invoice` vivo.** La radiografía la cuenta para «no comparable»; «Por contabilizar» no lee borradores.
3. **Dos casos teóricos, no verificados:** sin cuenta 1.1.2, «Por contabilizar» da «cuenta no encontrada» antes que «no comparable»; y el rollup de subcuentas por código padre podría no subir una subcuenta sin su cuenta intermedia.

**Decisiones del Director, 2026-10-19 (revisables por Sam):**

1. «**Tenant H: se alinea hacia la radiografía.** Mientras B2 no esté resuelto, una VES o CNY se reporta como "no comparable" y no se convierte con tasa para decir "cuadra". Convertir mezcla una cifra calculada con un mayor que no la tiene. Es el mismo criterio de la decisión 7.» Precisado después por el Director, **como enmienda de la decisión 7**:
   - «**Estado de la comparación 1.1.2:** pasa a "no comparable" si hay al menos una factura VES o CNY abierta con saldo, con o sin asiento.»
   - «**Lo que se cuenta como documento** no cambia. "Sin asiento" (B3) sigue contando sus documentos y "no comparable" cuenta los que lo provocan. Una misma factura puede aparecer en los dos, porque responden preguntas distintas: una sobre el documento y otra sobre la cuenta. Que la prueba lo deje explícito.»
   - «**La fila 96 queda como control en 0.** La decisión 6 (gana el mayor vacío) sigue antes que todo.»
2. «**Borrador VES con asiento `invoice` vivo: sí,** filtrar borradores en `fac` de la radiografía (`and f.estado <> 'borrador'`).»
3. «**Los dos casos teóricos:** agrégales una prueba que los fije, si sale barata. Si no, déjalos NO VERIFICADOS en el handoff.»

Hoy no cambia ninguna cifra en producción: la radiografía del 2026-10-18 midió todas las facturas en USD (B2 · facturas en otra moneda: 0).

## Decisión

### 1. La factura abierta en VES o CNY vuelve «no comparable» la 1.1.2

- `cuadreSubdiario` (`lib/studio/accounting/subdiario.ts`), lado clientes:
  - solo suman las facturas abiertas en USD y USDT, como en la radiografía; una VES deja de convertirse con su tasa;
  - toda factura abierta con saldo en VES o CNY se cuenta en `sinConvertir` y vuelve el lado «no comparable»;
  - el orden de los estados no cambia: sin cuenta, el mayor vacío (decisión 6), «no comparable», 0 contra 0, cuadra o no.
- `notasDelSubdiario` (`lib/studio/accounting/libro-control.ts`) dice por qué:
  - «no comparable»: hay facturas abiertas en bolívares o yuanes, o documentos en esas monedas con su asiento vivo;
  - las facturas que no suman: «están en bolívares o en yuanes» (ya no «en bolívares sin tasa»).
- Radiografía (`scripts/qa/radiografia-integridad.sql`): en el `case` del estado, 1.1.2 es «no comparable» también con `fuera` (`no_comparable or (cuenta = '1.1.2' and fuera)`). La condición queda escrita una sola vez y se ve que aplica solo a 1.1.2. La fila 91 cambia su texto; la 96 queda como control y da 0.
- No cambian el lado de proveedores (2.1.1), que sigue la regla de su asiento (G8, SDD-0557), ni el ingreso del período (4.5).
- La fixture conserva sus trampas. Con la regla nueva, dos tenants quedaban «no comparables» por una factura abierta y eso tapaba la trampa para la que existen:
  - FN1 (N) pasa a pagada: N vuelve a ser no comparable **solo** por su recibo;
  - FS2 (S) pasa a USD, cobrada en bolívares por RS1: S vuelve a probar que el recibo anulado no cuenta.

### 2. El borrador no vuelve «no comparable» la 1.1.2

- Radiografía: la cláusula de facturas de `no_comparable` en 1.1.2 exige `f.estado <> 'borrador'`, como ya hace «Por contabilizar».
- La fixture lleva la trampa: FP3, borrador en VES con su asiento `invoice` vivo, en P. P queda «mayor por encima» en las dos definiciones; sin el filtro, la radiografía la daría «no comparable».

### 3. Los dos casos teóricos quedan fijados por una prueba

En la prueba de paridad, cada uno es un escenario sobre la fixture, dentro de una transacción que se deshace:

- **Sin cuenta 1.1.2** (la 1.1.2 de H renombrada, que el plan de cuentas permite): «Por contabilizar» da «cuenta no encontrada» antes que «no comparable», aunque FH2 está abierta en VES. La radiografía, que no tiene ese estado, ve la 1.1.2 sin movimiento con facturas abiertas: «sin movimiento en el mayor» (decisión 6). Ninguna de las dos cuenta a H en la fila 91. También hay una prueba pura del orden.
- **Subcuenta sin su cuenta intermedia** (`1.1.2.9.1` sin `1.1.2.9`, con un asiento manual de B): la radiografía la suma a 1.1.2 (`like '1.1.2.%'`) y da «mayor por encima». «Por contabilizar» no la sube, porque `computeBalances` sube una cuenta solo a su padre directo, y B sigue cuadrando. **Es una divergencia, y queda fijada, no corregida.** No es solo teórica: el formulario de cuentas no exige que exista la cuenta padre (`validateAccountInput`) y el árbol sube las huérfanas a la raíz (`buildAccountTree`). Por la misma regla, una huérfana tampoco entra en el total de su grupo en Reportes. La decisión es del Director: subir la huérfana al ancestro más cercano en `computeBalances`, o exigir la cuenta padre al crearla.

### Paridad del estado completo

La prueba de paridad de la SDD-0562 compara solo «no comparable». Esta SDD compara **el estado completo de 1.1.2**, tenant por tenant, con esta equivalencia:

| Radiografía | «Por contabilizar» |
|---|---|
| sin movimiento en el mayor | sin movimiento en el mayor |
| no comparable | no comparable |
| sin movimiento en la cuenta, o el tenant sin movimiento | sin movimiento |
| cuadra | cuadra |
| mayor por encima, mayor por debajo | no cuadra |

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/studio/accounting/subdiario.ts` | clientes: solo USD/USDT suman; VES/CNY abierta con saldo → `sinConvertir` y «no comparable» |
| `lib/studio/accounting/libro-control.ts` | textos de `notasDelSubdiario` y comentario de `sinConvertir` |
| `lib/studio/accounting/__tests__/libro-control.test.ts` | la VES abierta, con tasa, sin tasa o en yuanes; la pagada o anulada como control; el orden de «cuenta no encontrada»; las notas nuevas |
| `lib/studio/accounting/__tests__/libro-control-queries.test.ts` | por el lector: la VES abierta sin asiento, «no comparable» y en «sin asiento»; el asiento vivo, probado con la VES pagada |
| `app/studio/(app)/contabilidad/__tests__/por-contabilizar.test.tsx` | la pantalla con la VES abierta y el mayor vacío: saldo 0.00 y la nota de la factura que no suma |
| `scripts/qa/radiografia-integridad.sql` | 1.1.2 «no comparable» con `fuera`; borradores fuera de la cláusula de facturas; texto de la fila 91 |
| `scripts/qa/radiografia-integridad.fixture.sql` | la trampa FP3; FN1 pagada y FS2 en USD para que N y S conserven sus trampas; comentarios de A y H |
| `scripts/__tests__/radiografia-integridad.test.ts` | filas esperadas, `cambia` de los mutantes recalculado, tres mutantes nuevos y el tope de la guarda de Git |
| `scripts/__tests__/subdiario-radiografia-paridad.test.ts` | el estado completo y los escenarios de los dos casos teóricos |
| `docs/specs/0563-subdiario-sin-conversion-y-borradores/spec.md` | esta spec |
| `docs/specs/0557-reportes-contables-una-cifra/spec.md` y `docs/specs/0559-radiografia-integridad-repetible/spec.md` | nota de la enmienda de la decisión 7 |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0563-subdiario-sin-conversion-y-borradores.md` | handoff |

## Criterios de aceptación

1. Una factura abierta en VES (con tasa o sin ella) o en CNY, con saldo y sin asiento, deja clientes «no comparable», sin diferencia. La misma factura sigue en «sin asiento».
2. Con el mayor de 1.1.2 sin movimiento y esa factura abierta, gana «sin movimiento en el mayor» (decisión 6).
3. Una VES pagada (saldo 0) y sin asiento no cambia el estado.
4. La radiografía da la fila 96 en 0 sobre la fixture, y la 91 cuenta también A y H (7 tenants: A E G H J N T).
5. Un borrador VES con asiento `invoice` vivo no vuelve «no comparable» la 1.1.2 en la radiografía. Sin el filtro, la trampa la delata.
6. **Paridad:** sobre la fixture, el estado de 1.1.2 de cada tenant es el mismo en las dos definiciones, con la equivalencia de arriba, y la fixture recorre todos sus estados. Con la regla anterior de la radiografía, A y H dejan de coincidir.
7. Los dos casos teóricos tienen su escenario, con lo que hace cada definición escrito en la prueba.
8. Control rojo: cada cambio tiene un mutante que muere, de los dos lados. Eso incluye volver a convertir la VES y alinear el rollup de la subcuenta huérfana, que hace saltar la prueba que la fija.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec con allowlist exacta |
| VIS-01 | cumplimiento | el estado y las notas de «Por contabilizar» dicen por qué no compara; tuteo, sin voseo |
| ERR-01, A11Y-01, BTN-01 | no aplica | no cambian errores, controles ni botones |
| AUD-01 | no aplica | solo lectura |

## Validación

Ver el handoff `.agents/handoffs/0563-subdiario-sin-conversion-y-borradores.md`.
