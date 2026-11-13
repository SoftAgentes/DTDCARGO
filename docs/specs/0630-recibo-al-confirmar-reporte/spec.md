---
sdd: "0630"
title: "Confirmar un reporte de pago crea su recibo de cobro"
status: in-progress
author: "Sam + Claude Opus 5.5 (Worker)"
created: 2026-11-13
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0134", "0365", "0366", "0484", "0488", "0576"]
confidencialidad: interno
---

# SDD-0630 — Confirmar un reporte de pago crea su recibo de cobro

> Al confirmar en el Studio un pago que el cliente reportó en el portal, ahora se
> crea su recibo de cobro en la misma transacción y por la misma función que usa
> Cobranzas. Así se cierra el doble conteo entre el reporte y Cobranzas. La
> migración `0537` está **en espera** y su aplicación pide un OK nominal de Sam.

## Problema

Lo midió el Subdirector de Contabilidad el 2026-11-13. Confirmar un reporte
(`payment_private.run_report_command`, 0421, con el tope de saldo de la 0464 y la
fecha de Caracas de la 0533) sólo sumaba `invoices.paid_amount`. No creaba recibo,
ni asiento, ni movimiento de caja. Si el equipo además registraba ese pago en
Cobranzas (`register_collection_receipt`, 0467), la factura lo contaba dos veces.
Con un lote de contenedores por llegar, la contabilidad tiene que poder cuadrar
caja contra facturas.

Además, la 0422 y la 0423 siguen en espera. Su orden de liberación
(`.agents/handoffs/c-l14-portal-comandos-recibos.md`, guion
`.agents/handoffs/smokes-app-l14-0454-0472-guion.md`, Bloque 3) pedía un smoke en
producción que nunca se hizo. El guion nuevo cubre las tres.

## Contrato

### Base de datos (migración `0537_recibo_al_confirmar_reporte.sql`)

1. **Vínculo.** `payment_receipts.payment_report_id uuid` con FK a
   `payment_reports(id)` e índice único parcial (un reporte, a lo sumo un recibo).
   Lo protege el trigger `payment_receipts_report_link_guard`: sólo el owner
   `postgres` (el comando `SECURITY DEFINER`) lo fija, sólo de NULL a un reporte
   **confirmado** del mismo tenant y la misma factura, y nunca se cambia ni se
   borra. Una sesión API con `UPDATE` sobre recibos (0470) recibe
   `PAYMENT_RECEIPT_REPORT_LINK` (42501).
2. **Motor de comandos.** `run_report_command` es la copia íntegra del cuerpo de
   la 0533 con deltas sólo en `confirm`:
   - el input exige `cash_account_id`. Entra en la huella del intento, así que la
     misma clave con otra cuenta da `PAYMENT_REQUEST_CONFLICT`;
   - la cuenta tiene que ser de caja o banco, postable y del tenant. Es la regla de
     `isCashAccount` (`qbo_type = 'Bank'` o código `1.1.1…`). Si no se cumple, da
     `PAYMENT_CASH_ACCOUNT` (22023), sin efectos;
   - en vez de sumar `paid_amount` a mano, llama a
     `public.register_collection_receipt`, en la misma transacción. Esa función
     pone el correlativo R- (`next_receipt_code`, serializado por el lock 488 del
     tenant), la cuenta de caja, el `fund_class` heredado de la factura, el recibo
     `aplicado`, `paid_amount`, `status` y `last_payment_at`, con las mismas reglas
     de saldo que Cobranzas;
   - el recibo usa `received_at` = `paid_at` del reporte. El método del reporte
     pasa igual, salvo `binance`, que entra como `usdt`. Las notas dicen
     «Reporte de pago del portal» y el pagador es `cliente`;
   - el recibo se vincula al reporte y vuelve en el resultado (`receipt`: id,
     código, tenant, monto, moneda, tasa, cuenta, fecha, pagado, estado de la
     factura y si quedó saldada). Ese resultado queda guardado en
     `payment_private.report_commands`, así que un reintento con la misma clave
     devuelve **el mismo** recibo sin crear otro;
   - la constancia `payment_report_confirmed` suma `related_receipt_id`.

   `create`, `cancel` y `reject` quedan igual. Se conservan la idempotencia por
   clave, el tope de saldo de la 0464, los permisos (admin/accounting activos del
   tenant) y la auditoría.
3. **Wrapper.** `public.confirm_payment_report_with_receipt(request, report,
   cuenta, motivo)`, `SECURITY INVOKER`, con EXECUTE sólo para `authenticated`.
   `resolve_payment_report` queda intacto, porque la 0422 lo exige y el Studio lo
   usa para rechazar. Si alguien confirma por ahí, recibe `PAYMENT_CASH_ACCOUNT`:
   no queda ningún camino que confirme sin recibo.
4. **Preflight y postflight.** El preflight exige el cuerpo exacto que deja la
   0533 en `run_report_command` y en `register_collection_receipt`, con su firma,
   owner, config y ACL. También aborta si la migración ya se aplicó. El
   postflight comprueba que no cambiaron la identidad, la firma ni los privilegios
   de las funciones previas, y que sólo cambió el cuerpo del motor. Verifica
   además el wrapper, el guard, el índice y la FK, y que no se vinculó ninguna
   fila.

### Asiento

Va por la misma vía que en Cobranzas (SDD-0041/0068/0488). El asiento DR caja / CR
1.1.2 lo arma la app después del COMMIT, con
`lib/studio/accounting/receipt-posting.ts`. Es best-effort e idempotente por
recibo. La función `postCollectionReceiptEntry` ahora la comparten el cobro de
Cobranzas y la confirmación. La confirmación lo intenta también en un replay, para
completar un asiento que el primer intento no llegó a hacer. Si falla, el recibo
queda en «Por contabilizar».

**Decisión técnica, a revisar.** El encargo pedía el asiento «en una sola
transacción». Moverlo a SQL obligaba a escribir una segunda implementación del
posteo de cobros, distinta de la de Cobranzas, y el encargo también pedía «la
misma vía». Se eligió la misma vía. La transacción única cubre el recibo, la
cuenta, el `fund_class`, el saldo, el estado y el vínculo. Si el DG o Sam quieren
el asiento atómico, eso es una SDD aparte para cobros y confirmaciones a la vez.

### App

- `lib/portal/payment-report-commands.ts`: `confirm` exige `cashAccountId` y llama
  al wrapper nuevo. Decodifica y valida el recibo (llaves exactas, código R-,
  misma cuenta). Traduce `PAYMENT_CASH_ACCOUNT` y trata `PGRST202` (sin la 0537)
  como «no disponible», no como resultado incierto.
- `app/studio/(app)/facturacion/payment-report-actions.ts`: pasa la cuenta y
  asienta el recibo. Revalida también Cobranzas.
- `StudioInvoicePaymentReports`: muestra un selector «Cuenta donde entró el
  dinero» (con una sola cuenta, ya viene elegida) y no abre la confirmación sin
  cuenta. El diálogo nombra la cuenta y advierte «No lo registres también en
  Cobranzas». Si el resultado es incierto, conserva la cuenta y la clave y bloquea
  el selector. Un reporte confirmado muestra «Recibo de cobro R-…» y la nota de que
  ya está en Cobranzas, sin operaciones.
- Cobranzas: `PendingReportsNotice` avisa en el cobro de una factura si tiene
  reportes del portal sin revisar, cuántos y por cuánto, y enlaza a la factura para
  confirmarlos ahí. Si no pudo leerlos, también lo dice. Carga sus datos con la
  acción `getPendingPaymentReports`, con la misma puerta de vista que el historial,
  y el drawer sólo lo monta. Así no cruza con la #531 (SDD-0629).
- `lib/studio/payment-queries.ts`: `receiptCodesByReport` (sin la 0537 devuelve un
  mapa vacío) y `pendingReportsForInvoice`.

### Convivencia y orden

La 0537 va **después de la 0533** y es **MIGRATE-FIRST**, con el despliegue de la
app inmediatamente después. Entre una y otra:

- con la app vieja y la 0537 aplicada, confirmar devuelve `PAYMENT_CASH_ACCOUNT`
  sin efecto. La app vieja lo muestra como incierto;
- con la app nueva sin la 0537, PostgREST devuelve `PGRST202` sin efecto, y la app
  lo muestra como «PAGO-NO-DISPONIBLE».

Rechazar y cancelar siguen funcionando. La 0422 y la 0423 pueden aplicarse
después de la 0537: no tocan lo que ella cambia, y el contrato las aplica encima y
vuelve a confirmar, reintentar y rechazar.

## Allowlist exacta

- `docs/specs/0630-recibo-al-confirmar-reporte/spec.md` y `docs/specs/README.md`
  (índice generado).
- `supabase/migrations/0537_recibo_al_confirmar_reporte.sql` (nuevo).
- `supabase/tests/0537_recibo_al_confirmar_reporte.test.sql`,
  `…casos.sql` y `…despues.sql` (nuevos).
- `supabase/migrations-baseline.json`: la espera de la 0537.
- `supabase/pending-migration-symbol-declarations.json`: las dos degradaciones de
  la 0537.
- `lib/portal/payment-report-commands.ts` y
  `lib/portal/__tests__/payment-report-commands.test.ts`.
- `lib/portal/__tests__/payment-report-ui.test.tsx`.
- `lib/portal/__tests__/payment-report-receipt.migration.test.ts` (nuevo).
- `lib/studio/collections-actions.ts`: sólo se extrae `postCollectionReceiptEntry`,
  sin cambiar el comportamiento del cobro.
- `lib/studio/payment-queries.ts`: dos consultas nuevas al final.
- `app/studio/(app)/facturacion/payment-report-actions.ts`.
- `app/studio/(app)/facturacion/_components/StudioInvoicePaymentReports.tsx`.
- `app/studio/(app)/facturacion/[code]/page.tsx`.
- `app/studio/(app)/cobranzas/actions.ts` (una acción nueva de lectura),
  `app/studio/(app)/cobranzas/_components/PendingReportsNotice.tsx` y su prueba
  (nuevos), y `app/studio/(app)/cobranzas/_components/CobranzaDrawer.tsx` (sólo el
  import y el render).
- `.agents/handoffs/0630-recibo-al-confirmar-reporte.md`.

No se tocan la 0421, la 0464, la 0467, la 0533 ni ninguna migración sellada o en
espera, ni sus contratos.

## Criterios de aceptación

1. Confirmar crea **un** recibo `aplicado` vinculado al reporte, con correlativo
   R-, la cuenta elegida, el `fund_class` de la factura, el monto y la moneda del
   reporte y su fecha. La factura sube su `paid_amount` una sola vez y queda
   `parcial` o `pagada`. Todo pasa en la misma transacción.
2. Un reintento con la misma clave y los mismos datos devuelve el mismo recibo, con
   `replayed`, sin ninguna escritura. Con otra cuenta u otro actor da
   `PAYMENT_REQUEST_CONFLICT`.
3. Rechazar no crea recibo ni toca el saldo.
4. Sin una cuenta válida (nula, mal formada, de gasto, no postable, de otro tenant
   o inexistente) no se confirma, y nada cambia.
5. Los permisos, el tope de saldo de la 0464 y la auditoría siguen igual.
6. El vínculo no se falsifica ni se reescribe desde la API, y tampoco lo reescribe
   el owner.
7. Después de confirmar, Cobranzas no puede volver a cobrar ese monto: pagado =
   suma de recibos vigentes.
8. Concurrencia con sesiones reales: dos confirmaciones que juntas pasan el saldo,
   una confirmación contra un cobro de Cobranzas en los dos órdenes, la misma
   clave en dos sesiones y dos facturas a la vez con correlativos distintos.
9. La 0422 y la 0423, aplicadas después, pasan su preflight y su postflight, y
   confirmar, reintentar y rechazar siguen bien encima.
10. El Studio pide la cuenta, muestra el recibo y no ofrece volver a registrar un
    reporte ya confirmado. Cobranzas avisa de los reportes pendientes.
11. Las pruebas usan montos inventados y ningún dato real.

## Fuera de alcance

- **Reportes confirmados antes de la 0537.** Siguen sin recibo y con su monto en
  `paid_amount`. Conciliarlos (recibo retroactivo o revisión manual) lo decide
  contabilidad con Sam y va en una SDD propia. Para medirlos en producción hace
  falta una autorización de lectura.
- **Anular el recibo de un reporte confirmado.** `void_collection_receipt` baja el
  pagado y el reporte sigue `confirmado`. El Studio no lo ofrece de forma
  especial.
- El asiento atómico en SQL (ver la decisión técnica de arriba).
- Aplicar la 0533, la 0537, la 0422 o la 0423 en producción. Cada una pide su OK
  nominal y el runbook.
