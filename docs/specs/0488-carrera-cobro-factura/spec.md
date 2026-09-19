---
sdd: "0488"
title: "El registro de cobros en facturas pasa a ser atómico"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-18
updated: 2026-09-18
supersedes: null
superseded_by: null
related: ["0041", "0068", "0290", "0294", "0407", "0421", "0484"]
confidencialidad: interno
---

# SDD-0488 — El registro de cobros en facturas pasa a ser atómico

> Cobrar, identificar un pago sin referencia y anular un recibo leían la factura
> sin lock y escribían `paid_amount` absoluto en otro request. Dos operaciones
> simultáneas sobre la misma factura perdían una suma, y el saldo se validaba
> contra una lectura vieja. Con la migración `0467`, cada operación es una RPC
> que toma el recibo y la factura `FOR UPDATE`, valida el saldo con la regla
> estricta de la 0464 y escribe el recibo, el pagado y el estado en una sola
> transacción.

## Contexto

### El hallazgo

Lo detectó por lectura de código el Worker de la SDD-0484, y figura en su handoff
de la rama `codex/reporte-pago-factura-pagada` como «FUERA DE ALCANCE DETECTADO»
nº 1. El Director lo confirmó leyendo el código. Estado en `main` = `1b64bdae`:

- `registerCollectionFor` (`lib/studio/collections-actions.ts:105-109`) lee la
  factura sin lock. Después inserta el recibo (`:144-168`) y escribe
  `paid_amount = leído + monto` y el `status` en otro request (`:174-185`).
- `identifyPaymentFor` hace lo mismo: lee en `:378-383`, actualiza el recibo en
  `:413-423` y escribe el pagado absoluto en `:429-439`.
- `voidReceiptFor` anula el recibo (`:511-519`), lee la factura (`:524-533`) y
  escribe `paid_amount = leído − monto` (`:535-540`).
- Cada paso es un request PostgREST propio, o sea, una transacción. Entre la
  lectura y la escritura puede comprometerse otra operación sobre la misma
  factura, y su suma se pierde. Esa otra operación puede ser otro cobro, una
  identificación, una anulación o una confirmación de reporte de pago:
  `payment_private.run_report_command` (0421:239-242, aplicada) sí toma la
  factura `FOR UPDATE`, pero la escritura absoluta del cobro la pisa igual.
- El saldo se valida contra la lectura vieja: dos cobros que entre los dos
  superan el saldo pasan los dos.
- Si falla la escritura de la factura después de insertar el recibo, el recibo
  queda sin reflejar. La app lo informa como «Cobro registrado pero no se
  actualizó el saldo».

Al investigar aparecieron tres defectos más en el mismo flujo, que el Director
aprobó incluir (ver Decisiones):

- **Código de recibo repetido.** `next_receipt_code` (0079:90-110) calcula `max+1`
  sin lock ni contador. Dos cobros simultáneos del mismo tenant, aunque sean en
  facturas distintas, sacan el mismo `R-AAAA-NNNN` y el segundo muere por
  `unique (tenant_id, receipt_code)`.
- **Anular un recibo revive una factura anulada.** `void_invoice_with_audit_reason`
  (0294:143-168) anula facturas `parcial` con recibos aplicados. Si después se
  anula uno de esos recibos, `voidReceiptFor` pone la factura en `emitida` o
  `parcial` (`collections-actions.ts:536`). La D2 lo registra como
  `invoice_emitted` (0290:182-187).
- **Dos identificaciones del mismo pago sin referencia** hacia facturas distintas
  pasan las dos la comprobación de `recibido_sin_ref`. El pago queda acreditado
  en las dos facturas, y el recibo apunta sólo a una.

### Reproducción con dos sesiones reales

PGlite tiene una sola conexión, así que la carrera se reproduce con
`scripts/qa/cobro-factura-race.mjs`:

- levanta un `postgres:17` desechable y reconstruye el esquema completo desde
  `supabase/migrations` con los stubs de plataforma, igual que
  `check-schema-rebuild.mjs`;
- siembra un tenant sintético;
- corre cada escenario con dos sesiones `psql`. La app vieja se reproduce request
  por request, con el rol `authenticated`, el usuario de contabilidad y una
  transacción por request, como PostgREST;
- sincroniza sin sleeps. La sesión O retiene un advisory lock y S1 se detiene en
  él: entre la lectura y la escritura si es la app vieja, o dentro de su
  transacción, con los locks tomados, si es atómica. S2 corre hasta terminar o
  hasta quedar esperando un lock, según `pg_stat_activity`.

El esquema reconstruido incluye 0422 y 0423, que siguen pendientes en
producción. Ninguna de las dos cambia lo que se prueba: `run_report_command` es
DEFINER y no depende del DML de la API sobre `payment_reports`.

El invariante que se mide en cada factura es
`paid_amount = recibos vigentes + reportes confirmados`, más
`paid_amount ≤ total_amount`.

La tabla de resultados, antes y después de la 0467, está en
[Evidencia](#evidencia).

## Decisiones

### De Sam (2026-09-18, AskUserQuestion)

| Pregunta | Opción elegida (literal) |
|---|---|
| «Hoy el cobro y la identificación de pagos en Studio aceptan hasta 0,01 por encima del saldo de la factura. La confirmación de reportes de pago de la 0464 (SDD-0484) rechaza cualquier excedente y cualquier factura ya pagada. ¿Qué regla aplico en la nueva RPC de cobros?» | «Estricta, como la 0464 (Recomendado)» |

Las otras opciones eran «Tolerancia 0,01 solo en Studio» y «Saldo a favor (no
existe hoy)». Hoy no hay saldo a favor del cliente. El estado de cuenta sólo
muestra un saldo negativo si hubo sobrepago (`lib/portal/statement-ledger.ts:44`),
y el crédito de referido (SDD-0137) es otra cosa.

### Del Director (`dtdcargo-18`, 2026-09-18)

- **Alcance:** `voidReceiptFor` entra, porque es el mismo invariante. Se prueba
  con dos sesiones una anulación contra un cobro y contra una confirmación de
  reporte.
- **Orden de release: migrate-first**, con la 0467 declarada en
  `pendingBelowCutoff`. El rojo del paso de CI «Codigo contra migraciones
  pendientes» es el candado que impide integrar el código antes que la migración.
  Se descartó un fallback al camino viejo, porque dejaría viva la carrera.
- **Correcciones dentro del alcance:**
  - un lock consultivo por tenant para el código R-, sin tocar
    `next_receipt_code`;
  - la factura anulada no revive, que es un bug y no una regla de negocio;
  - rol accounting o admin en las tres RPC, como 0421.
- **La RLS de `payment_receipts` sólo filtra por tenant** (0079:145-149, con
  0230). Este cambio no la toca: el hueco de rol por PostgREST sigue abierto
  hasta otra tarea.

## Alcance

### Qué cambia

**Migración `0467_cobro_factura_atomico.sql`.** Es aditiva: crea tres funciones
y no reemplaza ni altera nada existente.

| Función | Qué hace en UNA transacción |
|---|---|
| `register_collection_receipt(p_invoice_id uuid, p_amount numeric, p_cash_account_id uuid, p_method text, p_received_at date, p_reference text, p_notes text, p_payer_kind text, p_payer_name text, p_payer_relation text, p_licit_declared boolean)` | Rol; factura `FOR UPDATE`; reglas de estado y saldo; lock consultivo del tenant; `next_receipt_code`; inserta el recibo (pagador, `fund_class` heredada, `aplicado`); sube `paid_amount`, `status` y `last_payment_at` |
| `identify_collection_receipt(p_receipt_id uuid, p_invoice_id uuid)` | Rol; recibo `FOR UPDATE` (tiene que seguir `recibido_sin_ref`); factura `FOR UPDATE`; reglas de estado, moneda y saldo; aplica el recibo (factura, snapshots, `identified_at`, `fund_class`; `received_at` intacto); sube el pagado y el estado |
| `void_collection_receipt(p_receipt_id uuid, p_reason text)` | Rol; recibo `FOR UPDATE`; su factura `FOR UPDATE` si tiene; anula con `void_payment_receipt_with_audit_reason` (0294: motivo de 4 a 1000 y `dtd.audit_reason`); baja el pagado y recalcula el estado sin revivir una factura `anulada` o `borrador` |

Las tres son SECURITY INVOKER, con `search_path` vacío y owner `postgres`. Sólo
`authenticated` tiene EXECUTE: `anon`, `service_role` y `public` no. Es el
patrón D2 de 0294. Corren con la RLS y los GRANT de quien llama, así que no
amplían ningún privilegio. La auditoría D2 (0290) sigue en los triggers, en la
misma transacción. Devuelven jsonb con lo que la app necesita para el asiento,
que sigue fuera y best-effort, como en SDD-0041 y SDD-0068.

**App.**

- `lib/studio/collections-actions.ts` llama a las tres RPC y traduce sus
  rechazos. Nunca muestra el texto crudo de Postgres. Las lecturas previas del
  cobro y de la identificación quedan sólo para el mensaje y el saldo del
  formulario; la anulación ya no lee la factura.
- `lib/studio/payment-types.ts` aplica la regla estricta en `validatePaymentInput`.

**Pruebas y QA.**

- `supabase/tests/0467_cobro_factura_atomico.test.sql`, el contrato;
- `lib/studio/__tests__/cobro-factura-atomico.migration.test.ts`, que corre el
  contrato en PGlite con el control rojo y 5 mutantes;
- `scripts/qa/cobro-factura-race.mjs` y su semilla, la carrera real;
- las pruebas unitarias actualizadas: `collections-identify.test.ts` y
  `payment.test.ts`;
- la frontera de lectura de facturas (`scripts/__tests__/invoice-read-boundary.test.mjs`),
  que baja de 6 a 2 en `collections-actions.ts` y de 46 a 42 en total.

**Espera.** La 0467 se declara en `supabase/migrations-baseline.json ›
pendingBelowCutoff`, con las instrucciones para el operador.

### Reglas

| Condición (con la fila bloqueada) | Código | errcode | Mensaje del Studio |
|---|---|---|---|
| Sin rol accounting/admin en el tenant, o sin una única membresía activa | `PAYMENT_FORBIDDEN` | 42501 | «Tu rol no puede registrar ni anular cobros.» |
| Monto nulo, ≤ 0 o con más de 2 decimales; ids nulos | `PAYMENT_INPUT` | 22023 | «Revisa el monto y la cuenta del cobro.» |
| Factura inexistente o de otro tenant | `PAYMENT_INVOICE_NOT_FOUND` | P0002 | «Factura no encontrada.» |
| Recibo inexistente o de otro tenant | `PAYMENT_RECEIPT_NOT_FOUND` | P0002 | «Recibo no encontrado.» |
| Factura borrada, `borrador` o `anulada` | `PAYMENT_STATE` | 23514 | «Solo se pueden registrar cobros en facturas emitidas o parciales.» |
| Factura `pagada` (**0464**) | `PAYMENT_INVOICE_PAID` | 23514 | «La factura ya está pagada: otro cobro o reporte la saldó. Actualiza la página.» |
| Monto > `total − pagado` (**0464**) | `PAYMENT_EXCEEDS_BALANCE` | 23514 | «El monto supera el saldo vigente de la factura: otro cobro o reporte lo cambió. Actualiza la página.» |
| Moneda del pago ≠ moneda de la factura (identificar) | `PAYMENT_CURRENCY` | 23514 | «La moneda del pago no coincide con la de la factura.» |
| El pago ya no está sin referencia (identificar) | `PAYMENT_RECEIPT_APPLIED` | 23514 | «Este pago ya fue identificado y aplicado.» |
| El recibo ya está anulado | `PAYMENT_RECEIPT_VOIDED` | 23514 | «Este recibo ya está anulado.» |

Hay dos casos que no llevan código propio de la RPC. El tercero sin nombre,
relación o licitud lo rechaza el CHECK de 0122, y la RPC entera se revierte. El
motivo de anulación fuera de rango lo rechaza el wrapper de 0294 (22023).

**Coherencia con la 0464.** Cobro, identificación y confirmación de reporte usan
la misma regla y los mismos dos códigos. `vencida` sigue siendo cobrable, como en
la app y en 0421/0464, y un pago parcial la deja en `parcial`.

### Estados

| Operación | Antes | Después |
|---|---|---|
| Cobro o identificación | `emitida`, `parcial`, `vencida` | `pagada` si pagado ≥ total; si no, `parcial` |
| Anulación | `emitida`, `parcial`, `pagada`, `vencida` | `emitida` si el pagado queda en 0; si no, `parcial` (igual que la app) |
| Anulación | `anulada`, `borrador` | **sin cambio**; sólo baja el pagado (antes revivía) |

### Concurrencia

- **Orden de locks.** Al identificar y al anular: recibo → factura. Al cobrar:
  factura → lock consultivo `(488, hashtext(tenant))`. 0421 toma factura →
  reporte. No hay ciclos. La RPC heredada `confirm_payment_report` (0359) toma
  reporte → factura, pero no toca recibos y 0422 la retira.
- **Lock consultivo.** Se toma después de validar, así que un cobro rechazado no
  serializa al tenant. Dura hasta el COMMIT, y por eso el `max+1` de
  `next_receipt_code` ve el recibo anterior.

### Qué no cambia

- No se tocan `next_receipt_code`, `void_payment_receipt_with_audit_reason` ni
  ninguna otra función, policy, ACL, trigger o fila. El contrato lo verifica
  contra un snapshot del catálogo.
- Pago sin referencia (`registerUnidentifiedPaymentFor`): sigue igual, porque no
  toca facturas. Su código R- puede chocar con el de un cobro simultáneo: el
  que pierde recibe un error limpio, sin estado parcial.
- Asientos contables: siguen fuera de la transacción y best-effort (SDD-0041 y
  SDD-0068).
- Pantallas: no cambian. Ya validaban el saldo estricto del lado del cliente
  (`amt <= balance + 1e-6` en `CobranzaDrawer.tsx:482` e
  `InvoiceDetailClient.tsx:413`).

### Allowlist exacta

- `supabase/migrations/0467_cobro_factura_atomico.sql`
- `supabase/tests/0467_cobro_factura_atomico.test.sql`
- `supabase/migrations-baseline.json` (sólo la espera de 0467)
- `lib/studio/collections-actions.ts`
- `lib/studio/payment-types.ts` (sólo la regla de saldo de `validatePaymentInput`)
- `lib/studio/__tests__/collections-identify.test.ts`
- `lib/studio/__tests__/payment.test.ts`
- `lib/studio/__tests__/cobro-factura-atomico.migration.test.ts`
- `scripts/__tests__/invoice-read-boundary.test.mjs` (sólo el conteo de `collections-actions.ts`)
- `scripts/qa/cobro-factura-race.mjs`
- `scripts/qa/cobro-factura-race.seed.sql`
- `docs/specs/0488-carrera-cobro-factura/spec.md` y `docs/specs/README.md` (regenerado)
- `.agents/handoffs/0488-carrera-cobro-factura.md`

## Aceptación

1. La carrera se reproduce sin 0467 en `postgres:17` con dos sesiones, en cada
   escenario: pérdida de suma, doble acreditación o código repetido.
2. Con 0467, en los mismos escenarios, el invariante se cumple en toda factura.
   Además, S2 esperó un lock y salen el rechazo esperado y los códigos distintos.
3. Cada mutante de 0467 sin uno de sus `FOR UPDATE` cae en su escenario.
4. El contrato SQL pasa con 0467 y falla sin ella (control rojo). Cubre reglas,
   efectos, auditoría D2 con motivo, ACL, factura anulada, tenant ajeno, rol
   comercial y membresía doble.
5. En PGlite, 5 mutantes caen en su aserción: tolerancia de 0,01, factura que
   revive, sin regla de pagada, sin `FOR UPDATE` y sin lock consultivo.
6. La app ya no escribe `invoices` ni `payment_receipts` al cobrar, identificar o
   anular (fuera del `journal_entry_id` del asiento). Traduce todos los códigos.
   El control rojo de las pruebas unitarias contra el código anterior falla.
7. `validatePaymentInput` rechaza un centavo sobre el saldo.
8. `pnpm typecheck`, eslint de lo tocado, `docs:check`, `sdd:check`,
   `governance:check` y la frontera de lecturas: verdes.
   `check-pending-migration-symbols` queda en ROJO por diseño mientras la 0467
   espera.
9. Con la 0464 en el esquema, un cobro y una confirmación de reporte que entre
   los dos superan el saldo se serializan en la factura. El segundo, sea cobro
   o confirmación, recibe `PAYMENT_EXCEEDS_BALANCE` (escenarios 12 y 13).

## Release

1. Revisión del Director y OK nominal de Sam para la 0467, con la identidad del
   archivo (md5, bytes, LF) que figura en el handoff.
2. Antes de aplicar, leer en producción `md5(prosrc)` de `next_receipt_code(uuid)`,
   `void_payment_receipt_with_audit_reason(uuid,text)` y `get_user_tenant_id()`.
   El preflight exige los cuerpos de 0079, 0294 y 0453 (exactos con CRLF→LF, o
   sin espacios) y aborta sin cambiar nada si difieren.

   Lectura de catálogo del 2026-09-19 a las 01:03 UTC:
   `void_payment_receipt_with_audit_reason` y `get_user_tenant_id` coinciden
   exacto. El cuerpo de `next_receipt_code` difiere del repo sólo en espacios:
   coincide el md5 sin espacios (`10f0a5df…`), no el exacto. Faltan cero
   columnas y los 4 CHECK están validados. Las funciones de la 0467 no existen,
   y la 0464 ya está aplicada.
3. Aplicar la 0467 sola, con `name` = `0467_cobro_factura_atomico`.
4. Commit que retira la espera de `pendingBelowCutoff`. La cabecera del `.sql` no
   se toca: una migración aplicada no se edita.
5. CI verde, integración y smoke de Sam: cobrar, identificar un pago sin
   referencia y anular un recibo.

**Rollback.** Antes de desplegar la app, basta con `drop function` de las tres
funciones; ninguna otra cosa cambió. Con la app desplegada, primero hay que
revertir la app.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.04 / AUD-01 §1 (mutación y evento, una operación) | **cumplimiento** | La D2 corre en la misma transacción que el recibo y el saldo. El contrato comprueba `payment_registered`, `payment_identified` y `payment_voided`, con motivo también en el evento de la factura. Antes, recibo y factura eran requests separados. |
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | Rol accounting/admin en la base, con pruebas negativas: rol comercial, sin membresía, membresía doble y tenant ajeno. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | Las mismas reglas antes de mutar, bajo lock. El mensaje dice qué pasó y qué hacer («Actualiza la página»). |
| SGE-00.11 / ERR-01 (lenguaje del error) | **cumplimiento** | Hay un mensaje por código y nunca se muestra el texto crudo; lo cubre una prueba. |
| MP-01 (permanencia) | **no aplica** | No hay borrado nuevo. Anular sigue siendo marca con motivo (R3 de 0294). |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No cambian pantallas ni botones. |
| Hueco de rol en `payment_receipts` por PostgREST | **no conformidad preexistente** | Fuera de alcance, anotado por el Director. |

## Evidencia

### Carrera real (`scripts/qa/cobro-factura-race.mjs --mutantes`)

Corrida del 2026-09-19 a las 00:52 UTC, sobre `592cba6f`, en `postgres:17`, con
440 migraciones reconstruidas en 21 s. Resultado: **PASS**. Cada cifra es
pagado/total de la factura. «rec» es la suma de recibos vigentes y «rep» la de
reportes confirmados.

| # | Escenario (S1 → S2) | ANTES (app vieja) | DESPUÉS (0467) |
|---|---|---|---|
| 1 | cobro 300 → cobro 200 | 300/1000, rec 500: **se perdió 200** | 500/1000; S2 esperó |
| 2 | cobro 600 → cobro 600 | 600/1000, rec 1200: **pérdida y sobrecobro** | 600/1000; S2 `PAYMENT_EXCEEDS_BALANCE` |
| 3 | cobro 300 → confirmación 200 | 300/1000, rep 200 **perdido** | 500/1000 |
| 4 | confirmación 200 → cobro 300 | 300/1000, rep 200 **perdido** | 500/1000 |
| 5 | anulación de 400 → cobro 300 | 0/1000, rec 300 **perdido** | 300/1000 |
| 6 | anulación de 400 → confirmación 200 | 0/1000, rep 200 **perdido** | 200/1000 |
| 7 | identificación 800 → la misma a otra factura | 800 en las dos: **doble acreditación** | la segunda `PAYMENT_RECEIPT_APPLIED` |
| 8 | cobro → cobro en otra factura del tenant | S1 muere por `payment_receipts_tenant_id_receipt_code_key` | R-2026-0007 y R-2026-0008 |
| 9 | cobro 300 → identificación 800 | 300/2000, rec 1100: **se perdió 800** | 1100/2000 |
| 10 | identificación 800 → anulación | 800/1000 con el recibo anulado | 0/1000 |
| 11 | cobro 300 → anulación de 400 | 700/1000, rec 300 | 300/1000 |

En los 11 escenarios DESPUÉS, S2 esperó un lock. Cada mutante con uno de los
cinco `FOR UPDATE` quitado **cae en su escenario**, 7 de 7:

- sin el de la factura al cobrar: escenarios 1, 2 y 4;
- sin el del recibo al identificar: 7;
- sin el de la factura al identificar: 9;
- sin el del recibo al anular: 10;
- sin el de la factura al anular: 11.

Los escenarios 12 y 13, de coherencia con la 0464, se agregaron después del
merge con main. Su corrida queda en el handoff.

La identidad del archivo, las huellas de preflight y postflight y los locks
medidos están en el handoff `.agents/handoffs/0488-carrera-cobro-factura.md`.

## Fuera de alcance detectado

1. La RLS de `payment_receipts` sólo filtra por tenant (0079:145-149, 0230).
   Cualquier miembro del tenant puede hacer INSERT, UPDATE o DELETE directo por
   PostgREST, y `void_payment_receipt_with_audit_reason` tampoco exige rol.
2. `app/studio/(app)/cn/actions.ts:154` llama a `next_receipt_code` para las
   recepciones de bodega China. Desde 0079 esa función genera códigos R- de
   cobros, no WR-.
3. Tesorería (`lib/studio/treasury/treasury-actions.ts:270-324`, `:410-421`)
   repite la carrera sobre `supplier_bills.paid_amount`. Su `validatePaymentInput`
   (`lib/studio/treasury/types.ts:464`) conserva la tolerancia de 0,01.
4. `revertReferralCreditsForInvoice` (`lib/studio/accounting/referral-credit-posting.ts:352-364`)
   escribe `paid_amount` absoluto con el cliente admin, sin guard. Puede pisar
   una anulación concurrente sobre una factura anulada. La aplicación del
   crédito (`app/studio/(app)/fidelizacion/actions.ts:497-517`) sí usa guard
   optimista.
5. El pago sin referencia sigue generando su código R- sin el lock consultivo
   (ver «Qué no cambia»).
