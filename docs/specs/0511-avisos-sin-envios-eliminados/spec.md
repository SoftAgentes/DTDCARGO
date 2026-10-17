---
sdd: "0511"
title: "Envíos y clientes eliminados fuera de los avisos, Kommo y el correo por regla"
status: in-progress
author: "Claude"
created: 2026-10-14
updated: 2026-10-14
supersedes: null
superseded_by: null
related: ["0026", "0156", "0246", "0256", "0258", "0282", "0283", "0311", "0465", "0469", "0509"]
confidencialidad: interno
---

# SDD-0511 — Envíos y clientes eliminados fuera de los avisos, Kommo y el correo por regla

> Un aviso al cliente no cuelga de un envío eliminado ni sale si su envío se eliminó
> después de programarlo; Kommo no cuenta envíos ni facturas eliminados; y el correo por
> regla no le llega a un cliente eliminado, salvo que se haya fusionado, en cuyo caso le
> llega al cliente que lo absorbió. Sin migración y sin tocar policies.

## Contexto

Hallazgo de SDD-0509 (2026-10-14, por lectura de código): estos lectores usan el
**cliente admin**, así que la RLS nunca los filtró, y no piden `deleted_at is null`.
Eliminar un envío (`deleteShipment`, `app/studio/(app)/tracking/[id]/actions.ts:180`) solo
pone `deleted_at`: no lo saca de su consolidación ni cancela los avisos ya programados.

| Lector | Qué hacía con un eliminado |
|---|---|
| `scheduleReceiptVeReceived` (`schedule-fanout.ts`) | Elegía «el envío no terminal más reciente» del Shipping Mark sin mirar `deleted_at`: un envío eliminado más reciente que el vivo se llevaba el aviso «tu carga llegó a Venezuela», con su código. Si era el único, el cliente no salía en `sinDestino` y nadie lo anotaba en la bitácora. |
| `scheduleReceiptInWarehouse` (`schedule-fanout.ts`) | Lo mismo con «recibido en bodega China». Además le quitaba el aviso a la compra (SDD-0283): con un eliminado «abierto», nunca llegaba al ancla de la compra. |
| `scheduleConsolidationEvent` (`schedule-fanout.ts`) | Avisaba a todo envío de `consolidation_items`, eliminado o no. Por él pasan `consolidated` y el `eta_set` de la naviera (`scheduleSailingEvent`). |
| `drainClientNotifications` (`drain-client-notifications.ts`) | Despachaba un aviso ya programado aunque su envío se hubiera eliminado después. Un aviso anclado al ETA puede esperar días. |
| `syncKommoContactStatus` (`kommo-contact-status.ts`) | «Carga en tránsito: Sí» por un envío eliminado; «Tiene saldo pendiente: Sí» por una factura eliminada. |
| `fireMailEvent` (`mail/mail-rule-engine.ts`) | Tomaba el correo de la ficha con ese Shipping Mark aunque estuviera eliminada. |

Lo que ya filtraba: `scheduleClientNotifications` y el despacho resuelven el **cliente**
con `deleted_at is null` (`schedule-client-notifications.ts:81-86`,
`drain-client-notifications.ts`, `dispatchEmail` y `dispatchPush`). El problema era el
**envío**, no el cliente, salvo en el correo por regla.

Sobre facturas: desde SDD-0465 solo se borran borradores, que el estado de Kommo ya
excluía por estado. El filtro nuevo cubre las facturas **emitidas** borradas antes del
2026-09-14.

## Decisión

Decisiones de Sam, 2026-10-14 ~03:23Z (2026-10-13 noche, Caracas), sobre las opciones que le
planteé con la batería en rojo:

1. **Fan-out.** «Un aviso sobre un envío eliminado no debería salir» (del encargo). Los tres
   lectores piden `deleted_at is null`. En la consolidación, el envío que no vuelve vivo de
   la lectura no recibe el aviso, y si la lectura falla no se avisa a nadie y queda en el log.
2. **Ya programados:** «Revalidar al despachar (Recomendado)». El despacho lee qué envíos del
   lote están eliminados y marca esos avisos `canceled` con `error = 'envío eliminado'`. Es
   un UPDATE condicional (`status = 'scheduled'`), como el claim: si otro worker ya tomó la
   fila, no se toca. `canceled` libera los índices de idempotencia (0247/0389, `where status
   <> 'canceled'`): si el envío se restaura, el evento se puede volver a programar. Si la
   lectura de envíos falla, el lote no se despacha y espera a la próxima corrida del cron.
3. **Kommo:** «Sí, también facturas (Recomendado)». Envíos y facturas eliminados no cuentan.
4. **Correo por regla:** «Excluir; fusionado → superviviente (Recomendado)». Ficha viva → su
   correo. Ficha eliminada → `resolve_markbox` (0341/0367) y relectura del resultado
   exigiendo `deleted_at is null`: si se fusionó, el vigente; si no, la propia ficha, que al
   releerla da `null`. La RPC devuelve el final de la cadena aunque esté eliminado; por eso
   la relectura.

**Sin migración y sin tocar policies.** `deleted_at` existe en `shipments`, `invoices` y
`clients`; `resolve_markbox` está aplicada desde 0341 y la usan CN y Kommo.
`supabase/migrations-baseline.json` no se toca.

**Datos personales.** Revisé `.claude/skills/revisar-datos-ve/SKILL.md`: el cambio no
captura, mueve ni borra datos personales. Reduce comunicaciones a fichas eliminadas
(minimización) y, en la fusión, usa el correo del cliente vigente, que ya existe y tiene la
misma finalidad. No hace falta una auditoría completa.

## Alcance

Allowlist exacta:

| Archivo | Cambio |
|---|---|
| `lib/studio/notifications/schedule-fanout.ts` | `deleted_at is null` en los tres lectores de `shipments`; la consolidación salta el envío que no vuelve vivo y no avisa si la lectura falla |
| `lib/studio/notifications/drain-client-notifications.ts` | `enviosEliminados` por lote; cancela con motivo; `DrainResult.canceled`; no despacha si no sabe qué envíos viven |
| `lib/studio/kommo-contact-status.ts` | `deleted_at is null` en `invoices` y `shipments` |
| `lib/studio/mail/mail-rule-engine.ts` | `emailDelShippingMark`: ficha viva, fusión al vigente, eliminada sin fusión → sin correo |
| `lib/studio/__tests__/lectores-admin-double.ts` | doble de PostgREST que aplica filtros, orden y `limit`; `maybeSingle` con PGRST116; `update` condicional sobre su copia del store; RPC configurables; lanza si se filtra antes de `select()` |
| `lib/studio/__tests__/avisos-sin-eliminados.test.ts` | regresión por lector, con controles del doble |
| `lib/studio/notifications/__tests__/drain-client-notifications.test.ts` | su doble acepta el `.in()` nuevo y el resultado vacío incluye `canceled: 0`; no cambia lo que afirma |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/0511-avisos-sin-envios-eliminados.md` | documentación |

El doble es equivalente al `listados-double.ts` de SDD-0509 (PR #203), que no estaba en
main. No se copió: cuando los dos estén integrados conviene unirlos (pendiente en el handoff).

### Lo que NO se toca, a propósito

- **El drain sigue sin redirigir fusiones.** Un aviso de journey de un cliente fusionado
  (envío con el Shipping Mark viejo) no tiene destino, igual que antes: el despacho resuelve
  al cliente con `deleted_at is null`. Alinearlo con el correo por regla es otra decisión;
  queda en FUERA DE ALCANCE del handoff.
- **Kommo no suma lo del Shipping Mark viejo de un fusionado.** Lee los Shipping Marks de los
  clientes vivos; envíos y facturas con el código retirado no cuentan para el vigente. Igual
  que antes; FUERA DE ALCANCE.
- **Avisos que cuelgan de una compra.** El despacho solo revalida el envío; si una compra
  (prealerta) se elimina, su aviso sale. FUERA DE ALCANCE.
- **El respaldo al correo del prospecto** (`prospectEmail`, SDD-0061) sigue igual: si el
  Shipping Mark es de una ficha eliminada sin fusión y el evento trae `prospectEmail`, el
  correo va al prospecto. Hoy solo lo pasa el cotizador para estimados web **sin** Shipping
  Mark.
- **Un código retirado por renombrado** no tiene fila en `clients` y sigue sin correo, como
  antes: `emailDelShippingMark` no amplía a quién se le escribe.

## Aceptación

> **`status: in-progress` a propósito.** Los criterios 1-6 tienen prueba automática con
> mutantes. `pnpm verify` está **NO EJECUTADO** a la espera del turno del Director.

1. `scheduleReceiptVeReceived` y `scheduleReceiptInWarehouse` eligen el envío vivo aunque un
   eliminado sea más reciente; si el único abierto está eliminado, el cliente sale en
   `sinDestino` o el aviso cuelga de la compra.
2. `scheduleConsolidationEvent` no avisa a un envío eliminado del contenedor y, si no puede
   leer los envíos, no avisa a nadie y lo deja en el log.
3. El despacho cancela con motivo el aviso vencido de un envío eliminado, despacha los
   demás, no pisa una fila ya tomada y no despacha nada si no puede saber qué envíos viven.
4. Kommo no marca «Carga en tránsito» por un envío eliminado ni «Tiene saldo pendiente» por
   una factura eliminada.
5. El correo por regla no le llega a un cliente eliminado sin fusión; al fusionado le llega
   al vigente; si el vigente también se eliminó o la RPC falla, a nadie. Un Shipping Mark
   sin ficha no rompe las demás reglas del evento.
6. Sin migración, sin cambio de policies, sin cambio en `migrations-baseline.json`.

## Evidencia

**Rojo contra main.** Con el código de `c80eea64`, la batería da **15 rojos y 14 verdes**.
Los 14 verdes son 10 controles del doble (el mismo fixture con todo vivo elige la fila
eliminada) y 4 de no-regresión (fila tomada por otro worker, aviso de compra, cliente vivo,
Shipping Mark sin ficha). Cada rojo es un lector tomando la fila eliminada, o el despacho y
la consolidación avisando sin poder leer los envíos.

**El fixture es infeliz.** El envío eliminado es el más reciente (encabeza el
`order by created_at desc`) y cumple los demás filtros: mismo tenant, mismo Shipping Mark,
estado no terminal. En el despacho, el aviso del eliminado vence primero y su cliente está
vivo y con correo. En el correo, la ficha eliminada tiene el Shipping Mark exacto y un
correo válido.

**Verde con el arreglo.** La batería, 29/29. `vitest related` sobre los 4 archivos de
producto: 19 archivos, 174 pruebas. `pnpm typecheck` y `eslint` sobre lo tocado: limpios.

**Mutantes.** 21, uno por línea del diff que implementa el cambio (reemplazo exacto, sin
sed): **21/21 mueren**, con control sin mutar verde al inicio y al final (68/68). En la
primera corrida sobrevivió el corte `if (!fila?.client_id) return null` del correo: sin él,
una RPC fallida lanza y el `catch` general se traga las demás reglas del evento. Faltaba la
prueba, no sobraba el código. Lista completa en el handoff.

## Riesgos y límites

- **El deploy escribe en producción por sí mismo.** La primera corrida del cron después de
  desplegar marca `canceled` los avisos vencidos cuyo envío está eliminado, y desde ahí cada
  aviso que venza en ese estado. Es lo pedido, pero es una escritura que no pasa por una
  migración. La cuenta previa está pendiente (OK nominal de Sam, en el handoff).
- **Una caída en la lectura de envíos detiene el despacho** hasta que vuelva. Es a propósito
  (no se despacha a ciegas) y el cron repite cada minuto; el log lo dice.
- **El resultado del despacho cambia de forma**: `DrainResult` suma `canceled`, y la ruta
  `/api/cron/client-notifications-drain` lo devuelve en su JSON. Ningún lector de ese JSON
  en el repo depende de sus claves (medido con grep de `drainClientNotifications`).

## Seguimiento (2026-10-14)

`status: in-progress` a propósito: falta observar la primera cancelación real («envío
eliminado»).

- **La cuenta previa.** Conteo READ ONLY autorizado por Sam («ok, autorizo el conteo de la
  #205»), a las 03:59:44Z: 0 avisos `scheduled` con envío eliminado (0 vencidos, 0 futuros);
  2 clientes eliminados por fusión.
- **Integración.** El Director resolvió el conflicto del índice con un merge de `origin/main`
  `4328f4fa` (→ `374568d3`).
- **CI.** PASÓ (18m34s).
- **`pnpm verify` local:** NO EJECUTADO; el merge se hizo con el CI como evidencia.
- **Merge.** PR #205, merge `55d1b871` a las 04:26:52Z, con `--match-head-commit 374568d3`.
- **Deploy** a las 04:28:44Z.
- **Smoke de pantalla:** no hay; el cambio no tiene UI.
- **Pendiente.** Observar la primera cancelación real: un aviso con `status = 'canceled'` y
  `error = 'envío eliminado'`, y `canceled` en el JSON del cron `client-notifications-drain`.
