---
sdd: "0575"
title: "Asientos sin fallos silenciosos: lo que no se asienta se ve, se explica y se puede asentar"
status: draft
author: "founder"
created: 2026-10-20
updated: 2026-10-20
supersedes: null
superseded_by: null
related: ["0557", "0559", "0566", "0572", "0573"]
confidencialidad: interno
---

# SDD-0575 — Asientos sin fallos silenciosos

> La 2.2 del plan contable (cierra B3): «Asientos sin fallos silenciosos: tabla de fallos con pantalla «Asientos no creados» y «asentar pendientes»; lock en `next_entry_code`; unicidad por origen; guard de período visible en Cobranzas y Tesorería» (`docs/audits/2026-10-18-contabilidad-diagnostico-y-plan.md:825`).

**Estado: DISEÑO, para revisión del Director.** No hay código. Necesita número de migración y las respuestas de *Preguntas*.

## Qué cambia para Sam

Hoy, cuando un documento no se asienta, nadie se entera. La factura, el cobro, la CxP o el pago se guardan, pero el asiento no se crea y el error se pierde en el log. Solo la pestaña «Por contabilizar» (SDD-0557) los encuentra después, sin decir por qué.

Con esta SDD:

1. **Al guardar**, si el asiento no se puede crear, la pantalla lo dice con el motivo y qué hacer:
   - «sin tasa: cárgala en Contabilidad › Tasas de cambio»;
   - «período cerrado»;
   - «falta la cuenta 1.1.2»;
   - …
2. **Contabilidad › «Asientos no creados»** lista cada documento sin asiento: tipo, código, fecha, monto, motivo del último intento y cuántas veces se intentó.
3. Desde esa lista se puede **«Asentar»** uno o **«Asentar pendientes»** todos. Primero corre un **ensayo en seco** que muestra qué asientos se crearían, sin crear nada.
4. **Cobranzas y Tesorería** avisan antes de guardar si la fecha cae en un período cerrado, como ya lo hacen Gastos y el Libro diario.

## Evidencia (lo que hay hoy)

### Los asientos son best-effort, del lado de la app

- **Cada asiento automático se declara best-effort** en su cabecera: `invoice-posting.ts`, `receipt-posting.ts`, `bill-posting.ts` y `supplier-payment-posting.ts`, línea 15, «si algo falla, NO rompe la emisión (el caller logea y sigue)».
  - Corre con service_role y no es transaccional: cabecera y líneas son dos inserts.
  - El `catch` está en `invoice-posting.ts:181`, `receipt-posting.ts:293`, `bill-posting.ts:211` y `supplier-payment-posting.ts:216` (SDD-0566, *Evidencia para la 2.2*).
- **El período cerrado no se mira en la app** para esos cuatro documentos. `isPeriodClosed` no aparece en:
  - `facturacion/actions.ts`;
  - `lib/studio/sales-orders/actions.ts`;
  - `lib/studio/collections-actions.ts`;
  - `lib/studio/treasury/treasury-actions.ts`.

  Con fecha cerrada, el insert choca con `journal_entries_validate_closing` (0133) y el `catch` lo convierte en un resultado: el documento se guarda sin asiento (SDD-0566).
- **Sin tasa tampoco se asienta.** Desde la SDD-0572, un cobro, una CxP o un pago en bolívares o yuanes sin tasa devuelve `missing-fx-rate` y no se asienta. Es correcto (decisión 1 de esa SDD), pero hoy solo queda en el log.

### Unicidad del código y del documento

- **El código del asiento es max + 1, sin candado.** `next_entry_code` (`0078_contabilidad.sql:91-111`) calcula `max(...) + 1` y la app inserta en otra llamada.
  - Hay `unique (tenant_id, entry_code)` (`0078:58`). Si dos documentos se asientan a la vez, el segundo choca con `23505` y el `catch` lo pierde.
  - Un candado dentro de `next_entry_code` **no** lo arregla: la transacción de PostgREST termina al devolver el código, antes del insert.
- **No hay unicidad por documento.** `journal_entries` ya tiene las columnas de origen (el plan decía lo contrario, B3):
  - `invoice_id` (0078);
  - `receipt_id` (0079);
  - `bill_id` y `supplier_payment_id` (0088);
  - `charge_id` (0114);
  - `expense_id` (0132);
  - `claim_id` (0157).

  Pero el único índice único por origen es el del crédito de referido (`0237:95`).

### La idempotencia y el vínculo con el documento

- **La idempotencia cuenta asientos anulados.** `invoice-posting.ts:62-71` y `receipt-posting.ts:203-211` dan por existente cualquier asiento no borrado, incluido el **anulado**, y la reclasificación repite el defecto (`:464-473`). Un documento cuyo asiento se anuló no se vuelve a asentar nunca (SDD-0559, fuera de alcance 1 y 2).
- **El vínculo de vuelta no se comprueba.** `collections-actions.ts:215-219` no guarda `journal_entry_id` cuando el asiento ya existía, y los vínculos se escriben con el cliente de sesión sin mirar el error (0559, punto 3).
- **El borrado de compensación no mira su error.** Si fallan las líneas, nueve lugares borran la cabecera sin comprobar el resultado. Si ese borrado falla, queda un asiento `asentado` sin líneas, que la idempotencia ya no rehace (0559, punto 7; trampa AFI2 de la fixture).

### Lo que falta para verlo y para repararlo

- **No hay registro de fallos ni pantalla para reasentar.** «Por contabilizar» (`PorContabilizarTab.tsx`, SDD-0557) es de solo lectura y dice «No asienta nada: reparar el posting es la fase 2 del plan contable». No explica el motivo.
- **Gastos** es el quinto documento best-effort (`expense-posting.ts:1-20`), pero sí mira el cierre (`app/m/erp/actions.ts:94`, `:257`).
- **Hay casos reales.** La radiografía del 2026-10-18 encontró 5 de 5 facturas emitidas sin asiento y un recibo que apunta a un asiento anulado (plan, 2.2).

### Modelos a copiar

| Migración | Qué aporta |
|---|---|
| 0485 | Reclamos: indemnización con `correlation_id` y `unique_violation` controlada |
| 0497 | Reverso al anular, SDD-0573: RPC atómica, `SECURITY DEFINER`, fecha `greatest(hoy Caracas, cierre + 1)` |
| 0340 | Anulación de gastos con gobierno |
| 0316 | Liquidación de nómina con gobierno |

## Propuesta

### 1. «No asentado» se deriva, el motivo se registra

**La lista de pendientes se calcula, no se guarda.** Son los documentos vivos que deberían tener asiento y no tienen uno vivo, la misma regla de «Por contabilizar». Abarca los cinco tipos: factura, cobro (aplicado, sin identificar y su reclasificación), CxP, pago a proveedor y gasto. Así la lista no puede desincronizarse.

**Una tabla nueva, `accounting_posting_attempts`, guarda solo el motivo del último intento:**

| Campo | Qué guarda |
|---|---|
| `tenant_id` | el tenant |
| `doc_kind`, `doc_id` | el documento |
| `motivo` | código cerrado: `sin_tasa`, `periodo_cerrado`, `falta_cuenta`, `choque_de_codigo`, `no_cuadra`, `otro` |
| `detalle` | texto sin PII |
| `intentos` | cuántas veces se intentó |
| `primero_at`, `ultimo_at` | primer y último intento |

Lleva RLS por tenant: lectura para admin y contabilidad, escritura solo por la RPC. Cuando el asiento se crea, la fila se borra.

### 2. Una RPC atómica por documento (Pregunta 1)

`asentar_documento(p_kind text, p_id uuid, p_ensayo boolean)` corre como `SECURITY DEFINER`, para los roles admin y contabilidad. Hace todo en una transacción:

1. **Candado por tenant:** `pg_advisory_xact_lock` sobre el tenant y el código.
2. **Idempotencia:** un asiento **vivo** es uno no anulado y no borrado. Si ya existe, vuelve a apuntar el documento a ese asiento.
3. **Validaciones:** tasa, período, cuentas y cuadre. Cada falla escribe el motivo y devuelve el código.
4. **Inserción:** cabecera y líneas juntas, con el vínculo del documento. Sin compensación a mano: si algo falla, la transacción entera se deshace.
5. **Ensayo:** con `p_ensayo = true`, devuelve el asiento que crearía y no escribe nada.

Los cinco posters de la app pasan a llamar esta RPC. Las cuentas y las líneas se arman en SQL con la misma regla de hoy: el mapa de cuentas de cada `*-posting.ts` pasa a la migración, con una prueba de paridad.

### 3. Unicidad por origen

Índices únicos parciales en `journal_entries`, uno por par (`source`, columna de origen), con `status <> 'anulado' and deleted_at is null`:

- `invoice` → `invoice_id`;
- `receipt` → `receipt_id`;
- `receipt_reclass` → `receipt_id`;
- `bill` → `bill_id`;
- `supplier_payment` → `supplier_payment_id`;
- `expense` → `expense_id`.

**Preflight:** cuenta en producción los duplicados vivos por par. Si hay alguno, la migración no corre y se informa.

### 4. Período cerrado (Pregunta 2)

Propuesta: igual que Gastos. La app mira `isPeriodClosed` antes de guardar en Facturación, Cobranzas y Tesorería, y avisa con el mismo texto. Con el modo de cierre de la 0566 (superclave o advertencia), el documento se puede guardar con su excepción registrada; sin ella, no se guarda. La RPC repite el control.

### 5. Pantalla «Asientos no creados»

Es una pestaña nueva de Contabilidad, o una sección arriba de «Por contabilizar» (Pregunta 3).

- **Lista:** tipo, código con enlace, fecha, monto en su moneda, motivo y su texto con qué hacer, intentos y último intento.
- **«Asentar»** por fila, y **«Asentar pendientes»** para todos: primero corre el ensayo en seco, con la lista de asientos que se crearían, y después la confirmación.
- **Estados:** vacío («Todo asentado»), cargando, error, sin permiso.

### 6. Los casos reales de producción

Asentar en producción las 5 facturas y reasentar el recibo con asiento anulado **no** es parte de la PR. Es una operación aparte, que hace el Director con el OK nominal de Sam:

1. ensayo en seco;
2. radiografía SDD-0559 antes;
3. asentar;
4. radiografía después.

Va antes de cargar los consolidados en la base oficial (plan, 2.2).

## PR propuestas (Pregunta 4)

| PR | Contenido | Migración |
|---|---|---|
| **0575-a** | La tabla de intentos, los índices únicos con su preflight y la RPC `asentar_documento` para factura, cobro, CxP y pago, con contrato PGlite, contrato Docker y mutantes | sí |
| **0575-b** | Los posters de la app llaman la RPC, el aviso al guardar y el guard de período en Facturación, Cobranzas y Tesorería | no |
| **0575-c** | La pantalla «Asientos no creados» con «Asentar» y el ensayo en seco; también el gasto | no, salvo que el gasto necesite su rama en la RPC |

## Preguntas para el Director

1. **¿RPC atómica (propuesta) o reintento en la app?** La alternativa barata es dejar el asiento en la app, reintentar ante `23505` y agregar los índices únicos. No arregla el borrado de compensación ni la falta de transacción. Propongo la RPC, como la 0497.
2. **Período cerrado:** ¿se bloquea el documento con la excepción de la 0566 (propuesta) o se asienta con fecha `cierre + 1`, como el reverso de la 0497?
3. **¿Pestaña nueva** «Asientos no creados» **o sección** dentro de «Por contabilizar»?
4. **¿Tres PR** como arriba? ¿Y qué número de migración lleva la 0575-a?
5. **¿El gasto entra en la RPC** en esta SDD o se queda con su posting actual, que ya mira el cierre?

## Qué NO cambia

- La regla de cuentas de cada documento (solo se mueve a SQL).
- El asiento de la venta sigue al nominal hasta la 2.3 (B2).
- Los datos de producción: se reparan en la operación del punto 6, no en la PR.

## Fuera de alcance

- Los asientos de crédito de referido, reclamos, nómina, depreciación y liquidaciones, que tienen su propio camino.
- La invariante de `scripts/qa/cobro-factura-race.mjs:20-22` sin los créditos de referido (0559, punto 4).
- El endurecimiento de `infra/ops/migraciones/aplicar.sh:114-117` (0559, punto 6), cuyo dueño es el Director.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| Cambio de comportamiento Studio | por cumplir | allowlist exacta con cada PR |
| Producción | por cumplir | migración con número del Director, previa, OK nominal de Sam y runbook; la operación del punto 6 con su propio OK |
| Datos personales | no aplica | `detalle` sin PII; la pantalla muestra códigos y montos del propio tenant |
| ERR-01 | por cumplir | cada motivo con un texto que dice qué hacer |

## Validación

Pendiente: es diseño.
