---
sdd: "0496"
title: "El crédito de referido se aplica y se revierte en una sola transacción"
status: in-progress
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-20
updated: 2026-09-20
supersedes: null
superseded_by: null
related: ["0137", "0290", "0294", "0407", "0467", "0488", "0490"]
confidencialidad: interno
---

# SDD-0496 — El crédito de referido se aplica y se revierte en una sola transacción

## Contexto

Es el punto 1 de «Fuera de alcance detectado» de la
[SDD-0490](../0490-reversion-credito-referido/spec.md). Sam lo autorizó el
2026-09-20 y el Director lo asignó con turno de máquina (4 de 4).

La SDD-0490 cerró en TypeScript lo que se podía cerrar con guards optimistas y
dejó escrito, en «Riesgo residual», lo que no:

> La aplicación y la reversión siguen siendo varias peticiones sin transacción
> común. Quedan dos ventanas en las que la reversión baja un abono que nunca
> llegó a la factura:
> - una anulación que cae entre el claim de la aplicación y su UPDATE final;
> - un proceso de aplicación que murió en ese mismo tramo (el caso que ya
>   contempla el Fix B).
>
> En las dos, el crédito está `aplicado` y la factura todavía no tiene el abono.
> Si tiene otros pagos, **se le restan 80 de más**.

Es un defecto de dinero: a una factura se le descuenta un crédito que nunca se le
abonó. La propia 0490 nombró el cierre —«llevar la aplicación y la reversión a
funciones SQL con la factura FOR UPDATE, como hizo la 0467 con los cobros»— y lo
dejó propuesto porque exige una migración y la decisión de Sam.

### El camino exacto, medido (2026-09-20)

Reproducido con tres sesiones reales en
`supabase/tests/0467_reversion_credito_carrera.test.sql`, escenarios 5 y 6, fase
ANTES. Factura de 1.000 con un recibo de 300:

1. `applyReferralCredit` hace su **claim** (`acreditado` → `aplicado`) en su
   propia petición, que confirma sola. El crédito ya dice `aplicado`; la factura
   sigue en 300.
2. Alguien anula la factura. `voidInvoice` corre la reversión, que busca créditos
   `aplicado` de esa factura, encuentra ése y **le baja 80 al pagado**: 220.
3. El UPDATE final de la aplicación llega tarde, matchea 0 filas (el guard de
   estado de la 0490 funciona) y compensa el crédito, que vuelve a `acreditado`.

Final: la factura tiene 220 pagados contra un recibo vigente de 300, y el cliente
conserva su crédito. Los 80 se los comió la factura. La ventana 2 es la misma
sin el paso 3: el proceso murió, nadie compensa, y el resultado es idéntico.

Entre los pasos 1 y 3 **no hay ningún lock**: ésa es la ventana, y no se cierra
con guards porque el problema no es leer un valor viejo, sino que existe un
estado intermedio observable.

## Decisiones

### El molde es la 0467 (SDD-0488)

`register_collection_receipt`, `identify_collection_receipt` y
`void_collection_receipt` (0467:165-397) resolvieron el mismo problema para los
cobros. Se copia el patrón **completo**, no sólo el `FOR UPDATE`:

- gate de rol `accounting`/`admin` **dentro** de la función, leyendo
  `user_tenants` con `auth.uid()`;
- códigos de error de dominio con su `errcode` (`42501` permiso, `22023`
  entrada, `P0002` no encontrado, `23514` regla de negocio);
- `SECURITY INVOKER`, `search_path` vacío, owner `postgres` y `EXECUTE` sólo
  para `authenticated` — el patrón D2 de la 0294;
- el recálculo del estado de la factura al bajar el pagado, con la regla de
  `void_collection_receipt`: una factura `anulada` o en `borrador` conserva su
  estado; otra queda `emitida` sin pagos o `parcial` con pagos.

No hace falta el lock consultivo por tenant de la 0467: ése serializaba
`next_receipt_code`, y acá no se numera nada.

### Orden de locks: FACTURA → CRÉDITO(S)

El mismo en las dos funciones. En `revert_referral_credits` los créditos se leen
y se toman **después** del lock de la factura y ordenados por `id`: así una
aplicación en vuelo o ya comprometida no puede quedarse fuera del barrido, y dos
reversiones de la misma factura se serializan. La 0467 toma recibo → factura, y
la 0421 factura → reporte; ninguna toma `referrals`, así que la cadena completa
(recibo → factura → crédito) no tiene ciclos.

### Los asientos se quedan afuera, best-effort

**Decisión de esta SDD**, con el precedente literal de la 0467 («Devuelve en
jsonb lo que la app necesita para el asiento, que sigue fuera y best-effort, como
en SDD-0041/0068»). El argumento:

- el asiento lo arma `lib/studio/accounting/referral-credit-posting.ts`: busca
  dos cuentas del plan **por código**, saca el correlativo con `next_entry_code`
  e inserta cabecera más dos líneas, con *skip graceful* si al tenant le falta
  una cuenta. Portar eso a plpgsql multiplica la superficie de la migración sin
  tocar el defecto;
- el invariante que el dinero necesita es `referrals.status` ↔
  `invoices.paid_amount`, y ése es el que el lock protege;
- el asiento ya tiene idempotencia DURA en la base: el índice único parcial
  `journal_entries_referral_credit_uniq` de la 0237. Y la reversión lo barre por
  `referral_id`, así que no puede duplicarse ni quedar huérfano.

**Consecuencia asumida y escrita**: entre el COMMIT de `apply_referral_credit` y
el asiento hay una ventana en la que el crédito está aplicado y el asiento
todavía no existe. Es **recuperable** —la app compensa llamando a
`revert_referral_credits` con ese mismo crédito— a diferencia de la ventana que
esta SDD cierra, que dejaba la factura con dinero de menos y sin rastro. La
regla de la SDD-0137 («mover plata sin asiento es peor que no moverla») se
conserva: si el asiento falla, se deshace la aplicación.

### El orden se invierte respecto de la SDD-0137

Antes: claim → asiento → UPDATE de la factura. Ahora: **RPC (claim + abono, una
transacción) → asiento → link**. El asiento pasa de ir antes del dinero a ir
después, porque el dinero ya no puede quedar a medias. Si el asiento falla, la
compensación es una sola llamada en vez de tres UPDATEs sueltos.

### El fallo se dice con un campo propio, no sobrecargando `reverted`

Lo señaló el Director el 2026-09-20, corrigiendo una lectura mía. **Hoy**, antes
de esta SDD, `revertReferralCreditsForInvoice` recorre los créditos de a uno y
suma a `reverted` los que salen bien, así que `ok:false` con `reverted > 0`
significa **«unos créditos sí y otros no»** — y ese caso es alcanzable ya, sin
migración, con dos créditos de referido en la misma factura. (Además, el paso que
anula el asiento no mira su error, así que un fallo ahí no baja el `ok`.)

Con la 0471 ese significado desaparece: los créditos de una factura se revierten
en **una** transacción, todos o ninguno. Pero aparece otro caso —«la plata volvió
y no se pudo anular el asiento»— que **no** se puede expresar con `reverted` sin
que el número cambie de sentido según la versión. Así que va en un campo propio:

```ts
failure?: "revert" | "entries"
```

- `"revert"`: la RPC falló y no se movió nada (ni factura, ni crédito, ni
  asientos). `reverted` es 0. Es el caso de la 0471 sin aplicar, y el mensaje
  empieza por `REVERT_REFERRAL_CREDITS_ERROR`, exportado como constante para que
  el aviso ancle sin copiar texto.
- `"entries"`: el dinero volvió —la factura quedó bien y el crédito está
  disponible otra vez— y lo que no se pudo fue anular su asiento. Avisarle a
  contabilidad «no se revirtió» acá la mandaría a arreglar algo que ya está bien.

`ok` y `reverted` no cambian de forma, así que el aviso de la tarea hermana sigue
funcionando sin tocarlo; `failure` sólo le da con qué afinar el texto.

### La reversión pasa a correr con el cliente del USUARIO

Corría con el admin client (`service_role`). Las RPC son `SECURITY INVOKER` y
miden el rol de quien llama, así que la reversión ahora va con el cliente del
usuario. No amplía ni restringe permisos: su único llamador, `voidInvoice`, ya
está detrás de `moduleEditDenial("invoices")`, que es `accounting`/`admin` por
`MONEY_MODULES`; la policy `invoices_accounting_update` (0407) exige lo mismo, y
`referrals` es tenant-wide para `authenticated` por la 0098. Lo único que sigue
con el admin client son los asientos, como ya estaba.

### Lo que se retira

`REVERT_PAID_MAX_ATTEMPTS`, `invoiceStatusAfterPaidDecrease` y
`lowerInvoicePaidForRevert`. El reintento de la 0490 existía porque no había
lock: con la factura tomada `FOR UPDATE`, la reversión lee una vez y lo que lee
ya es definitivo. La regla de estado vive ahora en la 0471; dejar las dos copias
invitaba a que divergieran.

## Alcance

### Qué cambia

**La migración 0471** (nueva, aditiva, **NO APLICADA**):

- `public.apply_referral_credit(p_referral_id uuid, p_invoice_id uuid) → jsonb`.
  Toma la factura y después el crédito `FOR UPDATE`, revalida TODO bajo el lock
  (estado del crédito, monto, cliente, estado y moneda de la factura, compra
  nueva y saldo estricto) y escribe el claim y el abono juntos.
- `public.revert_referral_credits(p_invoice_id uuid, p_referral_id uuid) → jsonb`.
  Toma la factura y después sus créditos `aplicado` por `id`, los devuelve a
  `acreditado` con el rastro limpio y baja el abono con la regla de estado de la
  0467. Con `p_referral_id` acota a uno solo: es la compensación de la
  aplicación. Una factura inexistente devuelve `count: 0`, no un error.

**La app**:

- `applyReferralCredit` (`app/studio/(app)/fidelizacion/actions.ts`): las
  validaciones previas se conservan **para el mensaje**, no como autoridad — la
  función las revalida bajo el lock. El claim y el UPDATE final se reemplazan por
  la RPC. Los códigos de dominio se traducen a castellano en
  `applyReferralCreditError`; uno desconocido se muestra tal cual.
- `revertReferralCreditsForInvoice`
  (`lib/studio/accounting/referral-credit-posting.ts`): conserva el nombre y la
  forma `{ ok, reverted, error? }` —para que el aviso en el Studio que viene en
  otra tarea siga anclando donde ancla— y suma el cliente del usuario adelante,
  un `referralId` opcional y un campo `failure` (ver abajo).
- `voidInvoice` (`app/studio/(app)/facturacion/actions.ts`): sólo pasa el
  cliente. El `console.error` y el `revalidatePath` no se tocan.

### Qué NO cambia

- La UI: no cambia ninguna pantalla.
- Las funciones de la 0467, la 0294 y la 0407: intactas.
- El asiento del crédito y su anulación: mismo módulo, mismo admin client.
- `accredited_at`: la reversión no lo pisa, así que un crédito revertido sigue
  siendo aplicable a la misma factura.

### Orden de despliegue

**MIGRATE-FIRST, no negociable.** La 0471 se aplica a producción **antes** de
fusionar la PR. Si la PR entra primero, toda anulación de factura deja el
crédito sin revertir: `voidInvoice` anula igual, pero la reversión falla entera y
el crédito queda pegado a una factura anulada, con su abono todavía contado en
`paid_amount`. Eso no se corrige solo. La condición completa está escrita en
`supabase/migrations-baseline.json › pendingBelowCutoff`, que es lo que el gate
imprime entero antes de aplicar. **Fusionar la PR no autoriza aplicarla**:
requiere el OK nominal de Sam nombrando `0471_credito_referido_atomico` y el
[runbook de producción](../../runbooks/aplicar-migraciones-prod.md).

### Allowlist exacta

- `supabase/migrations/0471_credito_referido_atomico.sql` (nuevo)
- `supabase/tests/0471_credito_referido_atomico.test.sql` (nuevo)
- `supabase/tests/0467_reversion_credito_carrera.test.sql` (escenarios 5 y 6;
  fases DESPUÉS de 1 y 3 re-apuntadas a las RPC)
- `lib/studio/__tests__/credito-referido-atomico.migration.test.ts` (nuevo)
- `lib/studio/accounting/referral-credit-posting.ts` (sólo la reversión, su tipo
  de cliente y la constante del mensaje)
- `lib/studio/accounting/__tests__/referral-credit-revert.test.ts`
- `app/studio/(app)/fidelizacion/actions.ts` (sólo el tramo de aplicación y el
  traductor de códigos)
- `app/studio/(app)/fidelizacion/__tests__/apply-referral-credit.test.ts`
- `app/studio/(app)/facturacion/actions.ts` (sólo el argumento de la reversión)
- `supabase/migrations-baseline.json` y
  `supabase/pending-migration-symbol-declarations.json`
- `docs/specs/0496-credito-referido-atomico/spec.md` y `docs/specs/README.md`
  (regenerado)
- `.agents/handoffs/0496-credito-referido-atomico.md`

## Aceptación

1. **El contrato de la 0471** (`0471_credito_referido_atomico.test.sql`, 96
   aserciones) corre con las migraciones reales y comprueba: catálogo (INVOKER,
   `search_path`, owner, ACL), que la migración no toca ninguna policy, ACL,
   trigger, función previa ni fila; el centinela textual del `FOR UPDATE`; el
   gate de rol; la aplicación feliz (parcial, pagada, USDT, vencida, mismo día
   del crédito, saldo exacto); los quince rechazos con su código y sin mutación
   parcial; la reversión (factura anulada conserva su estado, sin pagos vuelve a
   `emitida`, una pagada baja a `parcial`, idempotencia, filtro por crédito,
   factura inexistente); la ida y vuelta; y que `anon` y `service_role` no
   ejecutan ninguna de las dos.
2. **El mismo contrato en PGlite** (`credito-referido-atomico.migration.test.ts`),
   que es la única cobertura de la migración en el CI de calidad, con **control
   rojo** (sin la 0471 falla en la primera aserción) y **10 mutantes**, cada uno
   cayendo en su aserción y no en otra.
3. **La carrera** (`0467_reversion_credito_carrera.test.sql`, 19 aserciones, tres
   sesiones reales con `dblink`): los escenarios 5 y 6 reproducen las **dos
   ventanas** con las sentencias viejas (220 pagados contra 300 cobrados) y
   demuestran que con las RPC no ocurren (300 contra 300, crédito disponible).
   Dos mutantes sobre la 0471 confirman que las fases DESPUÉS no son verdes en
   vacío: sin `FOR UPDATE` en la aplicación cae el 5; sin `FOR UPDATE` en la
   reversión cae el 1.
4. **Las pruebas unitarias** de la aplicación (17) y de la reversión (11): que la
   action ya no escribe `invoices` ni reclama el crédito por su cuenta, que los
   códigos llegan traducidos, que el asiento fallido se compensa, y que el
   barrido por `referral_id` y la distinción de los dos fallos siguen en pie.
5. **El gate de símbolos pendientes** da «0 ROJO · 1 AMARILLO declarado».
6. `pnpm verify` en verde, con el turno de máquina del Director.

## Riesgos

- **El preflight por md5 de `get_user_tenant_id()`.** La huella es la que la
  0467 y la 0468 verificaron contra producción al aplicarse (2026-09-18 y
  2026-09-19). No se leyó producción en esta tarea: si ese cuerpo cambió desde
  entonces, la migración **aborta sin cambiar nada**, que es el comportamiento
  querido, pero hay que releerlo antes de aplicar.
- **La ventana del asiento**, descrita arriba: asumida, recuperable y explícita.
- **El orden de integración**: si se aplica la PR antes que la migración, el daño
  es acumulativo y silencioso. Por eso está escrito en la espera y no sólo acá.
