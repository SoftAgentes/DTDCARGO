---
sdd: "0573"
title: "Anular una factura revierte su asiento de venta, en la misma transacción"
status: in-progress
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0566", "0567", "0560"]
confidencialidad: interno
---

# SDD-0573 — Anular una factura revierte su asiento de venta, en la misma transacción

> La 2.5 del plan contable. Hoy anular una factura solo cambia su estado: el asiento de venta sigue vivo e infla Clientes (1.1.2), Ingresos (4.5) e IVA por pagar (2.1.5). Con esta SDD, anular crea su contra-asiento en la misma transacción, y una factura con cobros vivos no se anula.

**Estado: DISEÑO APROBADO por el Director el 2026-10-20** (sobre `b12fed95`), con las cinco propuestas. **Migración: 0497** (la 0496 es del embarque).

## Decisiones del Director, por la delegación de Sam del 2026-10-20

1. **`paid_amount > 0` sin recibos vivos se rechaza.**
2. **Misma firma:** se reescribe `void_invoice_with_audit_reason(uuid, text)` desde su última definición, la 0294, con preflight sobre su md5 vivo. **Lectura de catálogo del Director (producción, 2026-10-20):** md5 `76644e17876d0caaa46e727de5946138`, sin espacios `c76c80e7b8cae81c28c7999803520fca`, 496 caracteres, INVOKER, volátil, `search_path=""`. El cuerpo de la 0294 del repo da exactamente lo mismo: sin deriva.
3. **Contra-asiento siempre**, fechado `greatest(hoy en Caracas, closing_date + 1)`. El original no se toca.
4. **DEFINER con rol admin o accounting**, con el tenant de la sesión y `search_path=''`.
5. **Una sola PR, MIGRATE-FIRST.**

**Tres cuidados del Director:**
- los escenarios 1, 3 y 5 de `0467_reversion_credito_carrera.test.sql` se reescriben para esperar el rechazo nuevo, **sin borrarlos ni debilitarlos**;
- una prueba demuestra que el contra-asiento de un asiento en período cerrado pasa por la 0566 (la 0493) sin tocar el cierre;
- la anulación sigue auditada en D2 (`invoice_voided`, 0290), como hoy.

## Contexto

### El plan contable (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md`)

- **B1:** «Anular una factura no revierte su asiento de venta». `void_invoice_with_audit_reason` (0294) solo cambia el estado; `invoice-posting.ts` no tiene reverso. El libro de ventas, que excluye las anuladas, deja de cuadrar con el mayor. **El Director midió el 2026-10-18: 0 anuladas con asiento vivo.**
- **2.5:** reverso al anular la factura, en la misma transacción. Si el período está cerrado, el reverso se fecha el primer día del período abierto, con un memo. No se anula una factura con recibos vivos. La reparación histórica tiene 0 casos.
- **Decisión 2 de Sam:** nunca reabrir períodos cerrados. Los reversos se fechan el primer día del período abierto, con un memo que cita el documento y la fecha original. Lo que hay son datos de prueba.

### Cómo funciona hoy (mapa del 2026-10-20 sobre `eafbd910`, en solo lectura)

**La anulación de la factura:**
- `voidInvoice` (`app/studio/(app)/facturacion/actions.ts:661-744`) rechaza las `pagada` y las `anulada`, pero **anula las `parcial`**. Después llama `void_invoice_with_audit_reason`.
- Después, en otra transacción y sin bloquear la anulación, revierte el crédito de referido (`revertReferralCreditsForInvoice`, SDD-0567).
- **La RPC** (`0294_audit_d2_human_reasons.sql:143-170`, la única definición):
  - es INVOKER y valida el motivo;
  - su única escritura es `update invoices set status='anulada' where id=p_id and status<>'pagada' and status<>'anulada'`;
  - no mira recibos, ni `paid_amount`, ni asientos, ni el cierre.
- **Los disparadores de `invoices`** (0290 auditoría, 0466 titular, 0494 referidos) no tocan `journal_entries`.

**El asiento de venta:**
- Lo escribe la app, best-effort, con service_role (`invoice-posting.ts:56-184`).
- Su vínculo es `journal_entries.invoice_id` con `source='invoice'` (`invoices` no tiene `journal_entry_id`).
- Sus líneas:
  - debe 1.1.2, por el total;
  - haber 4.5, por la base;
  - haber 2.1.5, por el IVA, si lo hay.
- Los montos son nominales, sin convertir (B2, la 2.3).

**Ningún documento usa contra-asiento hoy:**
- recibo, CxP y pago a proveedor marcan el asiento `anulado`, best-effort y en otra transacción;
- solo el gasto (0340) y el finiquito (0316) lo hacen en la misma transacción;
- **no existe el concepto de reverso** en `journal_entries`.

**El cierre** (`accounting_settings.closing_date`, triggers de 0133 y 0493, aplicada):
- tocar o insertar un asiento con fecha `<= closing_date` falla con 23514;
- insertar uno con fecha `closing_date + 1` pasa, si el original no se toca.

**`paid_amount > 0` no es lo mismo que «tiene recibos vivos».** Lo suben también:
- un crédito de referido aplicado (0471), sin recibo;
- un reporte de pago confirmado (0464), que hoy no crea recibo (eso es la 2.7).

**Lo que fija lo de hoy:**
- `0467_reversion_credito_carrera.test.sql` (escenarios 1, 3 y 5) **anula con la RPC una factura con un recibo vivo**;
- `void-invoice-referral-warning.test.ts` espera una sola RPC con `{p_id, p_reason}` y devuelve el error crudo de la base (ERR-01);
- los lectores del libro de control (`libro-control.ts:321-418`, `libro-control-queries.ts:88-138`), la radiografía de integridad (`scripts/qa/radiografia-integridad.sql:77, :258-262`) y la regla `asiento_vivo` del asistente de borrado (`lib/studio/borrado/asistente.ts:628`, SDD-0560) consideran «vivo» todo asiento `asentado` de la factura.

## Propuesta (aprobada; así quedó implementada)

### 1. El reverso es un contra-asiento, no un «anulado»

El asiento original **no se toca**: queda `asentado`. Se crea uno nuevo con las líneas al revés (debe y haber cambiados):
- `source = 'invoice_reversal'`;
- `invoice_id` igual al de la factura;
- `reverses_entry_id` apuntando al original.

**Por qué no marcar el original `anulado`:**
- en un período cerrado eso falla (y no se reabre);
- un contra-asiento deja en el mayor cuándo se anuló, no solo que se anuló;
- un solo mecanismo sirve para los dos casos, período abierto y cerrado.

### 2. La fecha del reverso

El reverso se fecha **`greatest(hoy en Caracas, closing_date + 1)`**:
- en el caso normal, es la fecha del día, aunque el asiento original esté en un período ya cerrado (el reverso nunca entra al período cerrado);
- si la fecha del día cayera dentro del período cerrado (un cierre puesto a futuro), va al primer día del período abierto, que es `closing_date + 1`, porque `closing_date` es una sola fecha.

El memo cita el documento y la fecha original: «Reverso de la factura F-2026-0012 (asiento A-2026-0031 del 2026-09-15). Motivo: …». Si el original está en un período cerrado, agrega «— período cerrado: el reverso va en el período abierto».

### 3. Una migración: la RPC anula y revierte en la misma transacción

Se reescribe `void_invoice_with_audit_reason(uuid, text)` con `CREATE OR REPLACE`, con la misma firma y el mismo retorno, para que la app y la auditoría D2 (`invoice_voided`, 0290) sigan igual. El preflight compara el md5 del cuerpo de la 0294.

Pasos:
1. **Toma la factura** `FOR UPDATE` y comprueba el tenant y el rol: admin o accounting (hoy la cuida solo el módulo de la app). La función pasa a **DEFINER**, con `search_path` vacío.
2. **Rechaza**, con hint `dtd-anular`:
   - `pagada` o `anulada`;
   - **un recibo vivo** (`payment_receipts.invoice_id = id and deleted_at is null`): «La factura tiene N cobros vivos: anúlalos primero en Cobranzas.»;
   - **`paid_amount > 0` sin recibos** (crédito de referido o reporte de pago): pregunta 1.
3. **Busca el asiento de venta vivo:** `source='invoice'`, `status='asentado'`, sin borrar y sin reverso.
   - Si no hay (nunca se emitió, o el asiento falló), solo anula.
   - Si hay más de uno, aborta, porque es una inconsistencia que hay que mirar.
4. **Inserta el reverso:**
   - el código sale de `next_entry_code`, con reintentos ante `unique_violation`, como la 0485;
   - lleva la fecha y el memo del punto 2;
   - las líneas son las del original con debe y haber cambiados;
   - antes de insertar comprueba que el original cuadra (debe = haber).
5. **Anula la factura**, con el motivo en `dtd.audit_reason`.

**Columna nueva:** `journal_entries.reverses_entry_id uuid` referencia `journal_entries(id)`, `unique`. Así un asiento tiene a lo sumo un reverso, y el reverso no se puede borrar mientras el original exista. Un CHECK exige que `source = 'invoice_reversal'` tenga `reverses_entry_id`.

**El postflight** comprueba:
- que la función es DEFINER y su ACL (solo `authenticated`);
- la columna nueva y su índice único.

### 3b. Lo que se ajustó al implementar

- **El contrato** (`supabase/tests/0497_reverso_al_anular_factura.test.sql`) usa el fixture del contrato 0467 atómico (facturas, cobranzas, D2 con 0290 y 0294) más la 0133 y la 0493. Prueba el pedido del Director: el reverso de un asiento de enero cerrado pasa por el cierre sin usar ninguna excepción y el cierre no cambia, y un reverso a mano dentro del período cerrado lo rechaza el cierre (23514).
- **El filtro «sin reverso»** del asiento vivo se quitó de la RPC: un asiento con reverso solo existe en una factura ya anulada, que sale antes. Era código sin prueba posible.
- **Con crédito de referido aplicado:** `revert_referral_credits` (0471) no exige la factura anulada, así que `voidInvoice` revierte el crédito ANTES de anular. Si el crédito no vuelve, la factura no se anula. Si la plata volvió pero su asiento quedó vivo (`failure: "entries"`, SDD-0496), anula con su aviso.

### 4. La app

- `voidInvoice` deja sus comprobaciones previas a la RPC y muestra solo los mensajes con hint `dtd-anular` (ERR-01): hoy devuelve el error crudo.
- El detalle de la factura deshabilita «Anular» cuando hay cobros vivos, con el motivo a la vista.
- `canVoid` (`invoice-types.ts:300-302`) mira también `paid_amount`.
- El libro diario muestra el reverso con su etiqueta («Reverso de factura»); el memo cita la factura, el asiento original y su fecha.
- **Los lectores que hoy tratan como vivo todo asiento `asentado` de la factura** cuentan el par original + reverso como anulado:
  - el libro de control;
  - `saldosDeFacturas`;
  - la radiografía de integridad;
  - la regla `asiento_vivo` del asistente de borrado de la 0560: una factura **emitida** con asiento ya se anula (la 0497 lo revierte); un **borrador** con asiento vivo, o sin poder comprobarlo, sigue bloqueado, porque el asistente lo elimina y eliminar no revierte nada.
- La radiografía de integridad (`scripts/qa/radiografia-integridad.sql`) excluye del B1 el asiento de venta con su contra-asiento, y cuenta el origen `invoice_reversal`. Su fixture suma el tenant U (una anulada con su par).

### 5. Lo que se reescribe en las pruebas

- `0467_reversion_credito_carrera.test.sql`: **todos** sus escenarios arrancan con un cobro de 300, así que no solo el 1, el 3 y el 5 anulaban con un recibo vivo: también el 2, el 4 y el 6. El fixture aplica ahora la 0133 y la 0497.
  - Los «después» 1, 2, 5 y 6 exigen primero el rechazo nuevo; después anulan el recibo (y en el 1 revierten el crédito) y corren la misma carrera, con la misma propiedad.
  - El 3: la anulación espera al cobro en curso, lo ve y sale rechazada por los dos recibos vivos. Es la misma regla (no ignorar un cobro en vuelo), con su consecuencia nueva.
  - Las fases «antes» y el 4 (la generación 0490) anulan con `anular_como_0294`, la copia de la 0294 en el fixture, como las otras sentencias viejas.
  - 19 aserciones, las mismas que el original; sin la 0497 fallan los «después» 1, 2, 3, 5 y 6.
- `void-invoice-referral-warning.test.ts`: reescrita para el orden nuevo (cobros vivos, revertir el crédito, anular), con las mismas categorías: el aviso sin el texto crudo, el log, la revalidación y el éxito limpio.
- `0294_audit_d2_human_reasons.test.sql` no cambia: aplica la 0294 sola, y la RPC nueva tiene su contrato propio.

### 6. Reparación histórica

Ninguna. El Director midió 0 anuladas con asiento vivo el 2026-10-18, y la decisión 2 dice que son datos de prueba. La radiografía de integridad queda como vigilancia.

## Qué NO cambia

- Anular recibos, CxP y pagos: siguen marcando su asiento `anulado`, best-effort. Pasarlos al contra-asiento en la misma transacción es la 2.2 o una SDD propia (*Fuera de alcance*).
- El asiento de venta sigue en moneda nominal (B2, la 2.3).
- Las notas de crédito y débito (2.8).

## Preguntas que se hicieron al Director (respondidas el 2026-10-20: ver *Decisiones*)

1. **`paid_amount > 0` sin recibos vivos** (crédito de referido aplicado, o reporte de pago confirmado): ¿se rechaza la anulación? Propongo rechazar, con el mensaje «La factura tiene USD X aplicados sin recibo (crédito de referido o reporte de pago): revierte el crédito o espera a la 2.7». Hoy la reversión del crédito corre después de anular (SDD-0567). Con esta regla, quien anula una factura con crédito aplicado tiene que revertir antes. La otra opción es que la RPC revierta el crédito en la misma transacción, pero el asiento del crédito lo escribe la app.
2. **Reescribir `void_invoice_with_audit_reason` con la misma firma** (propuesta), o una RPC nueva que reemplace la de la 0294, revocándole el EXECUTE.
3. **El contra-asiento también en período abierto** (propuesta), o marcar el original `anulado` cuando el período está abierto y usar el contra-asiento solo si está cerrado. Propongo el contra-asiento siempre, por un solo mecanismo y el rastro de la fecha.
4. **DEFINER con control de rol** (admin o accounting, propuesta), o seguir INVOKER como la 0294. Con DEFINER, el permiso deja de depender solo de la app; el `INSERT` en `journal_entries` hoy lo permite la RLS a cualquier empleado del tenant (la 2.4).
5. **¿Una PR?** Propongo una sola: la migración, la app y los lectores van juntos, porque los lectores sin la migración no tienen reversos que leer y la migración sin los lectores descuadra el libro de control. Orden MIGRATE-FIRST.

## Fuera de alcance

- **El contra-asiento en la misma transacción para recibo, CxP y pago a proveedor**, que hoy marcan su asiento `anulado`, best-effort, y en un período cerrado fallan en silencio. Destino: la 2.2 («asientos sin fallos silenciosos») o una SDD propia.
- **La idempotencia de `postInvoiceJournalEntry`** cuenta cualquier asiento con el `invoice_id` (incluido el del crédito de referido) sin filtrar por `source`. No afecta esta SDD, porque una anulada no se vuelve a emitir, pero conviene acotarla a `source='invoice'`.

## Allowlist exacta

| Archivo | Cambio |
|---|---|
| `supabase/migrations/0497_reverso_al_anular_factura.sql` | la migración |
| `supabase/tests/0497_reverso_al_anular_factura.test.sql` | el contrato |
| `lib/studio/__tests__/reverso-al-anular-factura.migration.test.ts` | el contrato en PGlite: control rojo, 20 mutantes, el preflight con otro cuerpo, la reaplicación y la espera |
| `supabase/tests/0467_reversion_credito_carrera.test.sql` | los escenarios con el rechazo nuevo |
| `supabase/migrations-baseline.json` | la espera de la 0497 |
| `supabase/pending-migration-symbol-declarations.json` | `journal_entries.reverses_entry_id` y su degradación |
| `app/studio/(app)/facturacion/actions.ts` | `voidInvoice`: cobros vivos, crédito antes, mensajes con hint |
| `app/studio/(app)/facturacion/__tests__/void-invoice-referral-warning.test.ts` | reescrita para el orden nuevo |
| `app/studio/(app)/facturacion/[code]/page.tsx` | pasa los cobros vivos al detalle |
| `app/studio/(app)/facturacion/_components/InvoiceDetailClient.tsx` | «Anular» deshabilitado con cobros vivos; el diálogo nombra el reverso |
| `app/studio/(app)/facturacion/_components/InvoiceDetailClient.anular.test.tsx` | nueva |
| `lib/studio/journal-types.ts` | el origen `invoice_reversal` y su etiqueta |
| `app/studio/(app)/contabilidad/_components/LibroDiarioTab.tsx` | el reverso con el tono de la factura |
| `lib/studio/accounting/libro-control.ts` | `asientosRevertidos`: el par cuenta como anulado |
| `lib/studio/accounting/libro-control-queries.ts` | el cruce lee los reversos; `saldosDeFacturas` suma el reverso |
| `lib/studio/accounting/__tests__/libro-control-queries.test.ts` | los filtros nuevos |
| `lib/studio/accounting/__tests__/libro-control-reverso.test.ts` | nueva |
| `lib/studio/borrado/asistente.ts` | la emitida con asiento se anula; el borrador sigue bloqueado |
| `lib/studio/borrado/__tests__/asistente.test.ts`, `asistente-servidor.test.ts` | la regla nueva |
| `app/studio/(app)/embarques/__tests__/asistente-borrado-action.test.ts`, `app/studio/(app)/embarques/_components/__tests__/AsistenteBorrado.test.tsx` | la regla nueva |
| `scripts/qa/radiografia-integridad.sql` | el B1 sin los revertidos; el origen `invoice_reversal` |
| `scripts/qa/radiografia-integridad.fixture.sql` | la columna de la 0497 y el tenant U |
| `scripts/__tests__/radiografia-integridad.test.ts` | los esperados con U y un mutante nuevo |
| `scripts/__tests__/subdiario-radiografia-paridad.test.ts` | los dieciocho tenants |
| `docs/specs/0573-reverso-al-anular/spec.md` | esta spec |
| `docs/specs/README.md` | índice regenerado |
| `.agents/handoffs/0573-reverso-al-anular.md` | handoff |

## Criterios de aceptación

1. Anular una factura con su asiento de venta crea, en la misma transacción, el contra-asiento con las líneas al revés: el par suma cero en cada cuenta y el original no se toca.
2. El reverso va fechado `greatest(hoy en Caracas, closing_date + 1)` y nunca entra a un período cerrado; pasa por el cierre (0133/0493) sin usar ninguna excepción.
3. El memo cita la factura, el asiento original, su fecha y el motivo, y dice cuando el original está en un período cerrado.
4. No se anula con recibos vivos, con abono sin recibo, con dos asientos de venta vivos o con uno que no cuadra; los rechazos llevan hint `dtd-anular` y no cambian nada.
5. Solo admin o accounting del tenant de la sesión anulan. La anulación queda en la auditoría D2 con su motivo.
6. Un asiento tiene a lo sumo un reverso, el original no se borra mientras exista, y solo un `invoice_reversal` revierte.
7. La app revierte el crédito de referido antes de anular, y no anula si no vuelve; muestra solo los mensajes con hint.
8. El libro de control, la radiografía y el asistente de borrado tratan el par como anulado.
9. Control rojo, y cada regla con su mutante (20 en la 0497, 12 en la app).

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | cumplimiento | esta spec, con allowlist exacta |
| AUD-01 | cumplimiento | la anulación sigue en la auditoría D2 con su motivo (contrato); el reverso nace asentado (D2 `journal_entry_posted`) y su memo guarda el motivo y el original |
| ERR-01 | cumplimiento | la app muestra solo los mensajes con hint `dtd-anular` (prueba de `voidInvoice`) |
| Producción | por cumplir | la migración con el OK nominal de Sam y el runbook; sin reparación histórica (0 casos) |

## Validación

Ver el handoff `.agents/handoffs/0573-reverso-al-anular.md`.
