---
sdd: "0489"
title: "Los pagos a proveedores en Tesorería pasan a ser atómicos"
status: done
author: "Sam + Claude Opus 5 (Worker)"
created: 2026-09-19
updated: 2026-09-19
supersedes: null
superseded_by: null
related: ["0044", "0484", "0488"]
confidencialidad: interno
---

# SDD-0489 — Los pagos a proveedores en Tesorería pasan a ser atómicos

> Registrar y anular una orden de pago leían la CxP sin lock y escribían
> `paid_amount` absoluto en otro request: es la misma carrera que Cobranzas tenía
> antes de la SDD-0488. Dos operaciones simultáneas sobre la misma CxP perdían
> una suma, el saldo se validaba contra una lectura vieja y una CxP anulada podía
> revivir con un pago. Con la migración `0468`, cada operación es una RPC que toma
> la orden y la CxP `FOR UPDATE`, valida el saldo con la regla de Cobranzas y
> escribe la orden, el pagado y el estado en una sola transacción.

## Contexto

### El hallazgo

Es el «FUERA DE ALCANCE DETECTADO» nº 3 de la SDD-0488. El Director lo asignó
el 2026-09-19. Estado en `main` = `d624ea45`, en
`lib/studio/treasury/treasury-actions.ts`:

- `registerPaymentFor` lee la CxP sin lock (`:252-257`) y después su moneda en
  otro request (`:276-280`). Luego saca el código (`:285-288`), inserta la orden
  (`:294-311`) y escribe `paid_amount = leído + monto` y el `status` en otro
  request (`:317-325`).
- `voidPaymentFor` lee la orden (`:375-388`), la anula con el wrapper de la 0294
  (`:392-398`), lee la CxP (`:403-413`) y escribe `paid_amount = leído − monto`
  (`:414-423`).
- Cada paso es un request PostgREST propio, o sea, una transacción. Entre la
  lectura y la escritura puede comprometerse otro pago o una anulación sobre la
  misma CxP, y su suma se pierde.
- El saldo se valida contra la lectura vieja: dos pagos que entre los dos superan
  el saldo pasan los dos. Si falla la escritura de la CxP después de insertar la
  orden, la orden queda sin reflejar. La app lo informa como «Pago registrado
  pero no se actualizó el saldo» (`:328`). Al anular, ni siquiera revisa el
  error de esa escritura (`:419-422`): la orden queda anulada y el pagado sin
  bajar.

La misma investigación encontró tres defectos más en el flujo. Siguen el
precedente de la 0467:

- **Código de orden repetido.** `next_payment_order_code` (0088:204-224) calcula
  `max+1` sin lock. Dos pagos simultáneos del mismo tenant, aunque sean en CxP
  distintas, sacan el mismo `OP-AAAA-NNNN`, y el segundo muere por
  `unique (tenant_id, payment_code)`.
- **Una CxP anulada revive.** `void_supplier_bill_with_audit_reason` (0294:200-227)
  sólo anula una CxP con `paid_amount = 0`, pero un pago que ya leyó la CxP antes
  de que se anulara escribe después `parcial` y el pagado. Pasa en los dos
  órdenes: con el pago en curso cuando llega la anulación, o con la anulación
  en curso cuando llega el pago. La CxP queda viva con una orden, y la app ya
  anuló su asiento de causación.
- **La anulación pierde el asiento del pago.** La app guarda el
  `journal_entry_id` de la orden con un update aparte, después de registrarla. Si
  la anulación lee la orden mientras ese update está en curso, lee el asiento
  vacío y no lo anula: el asiento del pago queda vivo para una orden anulada.

### Reproducción con dos sesiones reales

`supabase/tests/0468_pago_proveedor_carrera.test.sql` sigue el patrón de
`0467_cobro_factura_carrera.test.sql`:

- corre en la base `postgres` del contenedor de `sql-tests`;
- con dblink abre tres sesiones contra una base propia (`dtd_carrera_0468`): `s`
  prepara y observa; `a` (S1) corre la primera operación hasta su pausa, y `b`
  (S2) corre la segunda entera, en asíncrono;
- S2 termina o queda esperando a S1, según `pg_blocking_pids`, sin sleeps que
  calibrar.

El fixture es el del contrato 0468, con la 0088 real (no cascarones) y el cuerpo
de producción de `get_user_tenant_id`.

Los 9 escenarios corren dos veces en la misma corrida:

- **ANTES, sin la 0468.** S1 y S2 repiten, petición por petición y con el rol
  `authenticated`, lo que hacía la app, con sus chequeos de estado y de saldo
  (la tolerancia de 0,01 incluida). Cada escenario tiene que reproducir el daño:
  si un control no lo reproduce, el archivo falla.
- **DESPUÉS, con la 0468 aplicada encima.** Son las mismas carreras con las RPC:
  S2 tiene que esperar a S1 y recibir el rechazo esperado.

El invariante que se mide en cada CxP tiene cuatro partes:

- `paid_amount` es igual a la suma de las órdenes vigentes;
- `paid_amount ≤ total_amount`;
- el `status` es el que corresponde al pagado;
- una CxP que se anuló (evento D2 `bill_voided`) sigue `anulada` y sin órdenes
  vigentes.

En el escenario 9 se mide además que la anulación entregue el asiento que quedó
guardado. La tabla de resultados está en [Evidencia](#evidencia).

## Decisiones

### Del Director («Director notificación a workers», 2026-09-19)

- **Diseño.** Sigue el precedente de la 0467, que Sam aprobó para Cobranzas:
  RPC atómicas con la CxP `FOR UPDATE`, pago y anulación en una transacción,
  auditoría y los mismos criterios de saldo. La pantalla no se rediseña.
- **Orden de release: migrate-first.** La PR puede abrirse con la 0468 en
  `pendingBelowCutoff` y sus símbolos declarados en
  `supabase/pending-migration-symbol-declarations.json`, así que el gate de
  símbolos da AMARILLO. La 0468 no se aplica desde esta tarea, y el Director no
  integra hasta el OK nominal de Sam para la 0468.
- **Correcciones incluidas**, como en la 0467:
  - un lock consultivo por tenant para el código OP-, sin tocar
    `next_payment_order_code`;
  - la CxP anulada no revive;
  - rol accounting o admin en las dos RPC: es el candado del módulo Tesorería
    (`lib/studio/rbac.ts:119`), que hoy sólo aplica la server action.

### De Sam (2026-09-20, al autorizar la 0468): la regla de saldo en Tesorería

Implementé la regla estricta de Cobranzas, porque el Director pidió «los mismos
criterios de saldo». Pero Sam la había decidido para Cobranzas y no para
Tesorería, así que extenderla era una decisión suya, y tenía que tomarla antes de
aplicar la 0468, porque la regla queda dentro de la función.

**Sam la ratificó al autorizar la migración. Su respuesta, literal: «autorizo
0468, usa la regla estricta».** El código no cambió.

La pregunta que se le hizo: «Hoy Tesorería acepta un pago a proveedor hasta 0,01 por
encima del saldo de la CxP (`validatePaymentInput`, `lib/studio/treasury/types.ts:464`).
En Cobranzas elegiste la regla estricta (SDD-0488). ¿Qué regla aplico a los
pagos a proveedores?»

| Opción | Qué implica |
|---|---|
| **«Estricta, como Cobranzas (Recomendado)»**, la implementada y la elegida | Nada por encima de `total − pagado`. Se usan los mismos códigos que en Cobranzas y en la 0464: `PAYMENT_EXCEEDS_BALANCE` y `PAYMENT_BILL_PAID`. La pantalla ya valida así (`BillDrawer.tsx:396`, `amt <= balance + 1e-6`), de modo que el 0,01 sólo se alcanzaba con un request armado fuera de la UI. Ninguna CxP queda con pagado mayor que el total. |
| «Tolerancia de 0,01 sólo en Tesorería» | La RPC y `validatePaymentInput` aceptan `total − pagado + 0,01`. Una CxP puede quedar `pagada` con saldo −0,01. Antes de aplicar habría que cambiar la comparación en `register_supplier_payment_order` y en `validatePaymentInput`, e invertir el mutante «con la tolerancia de 0,01» del runner de PGlite y la prueba del centavo. |

No hay monedas cruzadas que justifiquen la tolerancia: la orden hereda la
moneda de la CxP y el monto se compara en esa moneda.

## Alcance

### Qué cambia

**Migración `0468_pago_proveedor_atomico.sql`.** Es aditiva: crea dos funciones
y no reemplaza ni altera nada existente.

| Función | Qué hace en UNA transacción |
|---|---|
| `register_supplier_payment_order(p_bill_id uuid, p_amount numeric, p_cash_account_id uuid, p_method text, p_paid_at date, p_reference text, p_notes text)` | Rol; CxP `FOR UPDATE`; reglas de estado y saldo; lock consultivo `(489, hashtext(tenant))`; `next_payment_order_code`; inserta la orden, que hereda proveedor, moneda y `fx_rate` de la CxP (`transferencia` y hoy por defecto); sube `paid_amount` y `status` |
| `void_supplier_payment_order(p_payment_id uuid, p_reason text)` | Rol; orden `FOR UPDATE`; su CxP `FOR UPDATE`; anula con `void_supplier_payment_with_audit_reason` (0294: motivo de 4 a 1000 y `dtd.audit_reason`); baja el pagado y recalcula el estado sin revivir una CxP `anulada`; devuelve el `journal_entry_id` que hay que anular |

Las dos son SECURITY INVOKER, con `search_path` vacío y owner `postgres`. Sólo
`authenticated` tiene EXECUTE: `anon`, `service_role` y `public` no. Es el
patrón D2 de la 0294 y de la 0467. Corren con la RLS y los GRANT de quien llama,
así que no amplían ningún privilegio. La auditoría D2 (0290) sigue en los
triggers, en la misma transacción. El motivo humano de la anulación queda
también en el evento de la CxP. Devuelven jsonb con lo que la app necesita para
el asiento, que sigue fuera y best-effort, como en SDD-0044.

**App.**

- `lib/studio/treasury/treasury-actions.ts` llama a las dos RPC y traduce sus
  rechazos. Nunca muestra el texto crudo de Postgres.
  - La lectura previa del pago queda sólo para el mensaje y el saldo del
    formulario; ya no lee la moneda aparte.
  - La anulación ya no lee la orden ni la CxP: anula el asiento que devuelve la
    RPC.
  - `voidBillFor` y `createBillFor` no cambian.
- `lib/studio/treasury/types.ts` aplica la regla estricta en
  `validatePaymentInput`.

**Pruebas.**

- `supabase/tests/0468_pago_proveedor_atomico.test.sql`: el contrato, 84
  aserciones en psql.
- `lib/studio/__tests__/pago-proveedor-atomico.migration.test.ts`: corre el
  contrato en PGlite con el control rojo y 8 mutantes.
- `supabase/tests/0468_pago_proveedor_carrera.test.sql`: la carrera real, 9
  escenarios × 2 fases.
- `lib/studio/treasury/__tests__/treasury-payments.test.ts` (nuevo): las dos
  actions con un stub de Supabase.
- `lib/studio/treasury/__tests__/treasury.test.ts`: la prueba del centavo.

**Espera.** La 0468 estuvo en `supabase/migrations-baseline.json ›
pendingBelowCutoff`, con las instrucciones para el operador, y sus dos llamadas
declaradas en `supabase/pending-migration-symbol-declarations.json`
(`sdd-0489-pago-proveedor-atomico`), hasta que se aplicó. Las dos entradas las
retira el commit posterior a la aplicación (ver [Release](#release)).

### Reglas

| Condición (con la fila bloqueada) | Código | errcode | Mensaje del Studio |
|---|---|---|---|
| Sin rol accounting/admin en el tenant, o sin una única membresía activa | `PAYMENT_FORBIDDEN` | 42501 | «Tu rol no puede registrar ni anular pagos a proveedores.» |
| Monto nulo, ≤ 0 o con más de 2 decimales; ids nulos | `PAYMENT_INPUT` | 22023 | «Revisa el monto y la cuenta del pago.» |
| CxP inexistente o de otro tenant | `PAYMENT_BILL_NOT_FOUND` | P0002 | «CxP no encontrada.» |
| Orden inexistente o de otro tenant | `PAYMENT_ORDER_NOT_FOUND` | P0002 | «Orden de pago no encontrada.» |
| CxP borrada o `anulada` | `PAYMENT_STATE` | 23514 | «Solo se pueden registrar pagos en CxP pendientes o parciales.» |
| CxP `pagada` | `PAYMENT_BILL_PAID` | 23514 | «La CxP ya está pagada: otro pago la saldó. Actualiza la página.» |
| Monto > `total − pagado` | `PAYMENT_EXCEEDS_BALANCE` | 23514 | «El monto supera el saldo vigente de la CxP: otro pago lo cambió. Actualiza la página.» |
| La orden ya está anulada | `PAYMENT_ORDER_VOIDED` | 23514 | «Esta orden ya está anulada.» |

Hay dos casos que no llevan código propio de la RPC:

- El motivo de anulación fuera de rango lo rechaza el wrapper de la 0294
  (22023). La app lo valida antes con `validateAuditReason`.
- Una cuenta de caja inexistente muere en la FK de la 0088 (23503), y la RPC
  entera se revierte.

En los dos, el Studio muestra el mensaje genérico de la acción.

### Estados

| Operación | Antes | Después |
|---|---|---|
| Pago | `pendiente`, `parcial` | `pagada` si pagado ≥ total; si no, `parcial` |
| Pago | `anulada`, `pagada`, borrada | rechazo; la app ya rechazaba `anulada` y `pagada` |
| Anulación de orden | `pendiente`, `parcial`, `pagada` | `pendiente` si el pagado queda en 0; si no, `parcial` (igual que la app) |
| Anulación de orden | `anulada` | **sin cambio**, como en la 0467: sólo baja el pagado. La app no tocaba la CxP |

Una CxP anulada con una orden viva sólo existe si la carrera vieja perdió una
suma. La 0294 anula únicamente con `paid_amount = 0`.

### Concurrencia

- **Orden de locks.** Al anular una orden: orden → CxP. Al pagar: CxP → lock
  consultivo del tenant. La anulación de la CxP (0294) es un UPDATE de la misma
  fila: espera al pago y después ya no anula, porque la CxP quedó con pagado. No
  hay ciclos.
- **Lock consultivo.** Se toma después de validar, así que un pago rechazado no
  serializa al tenant. Dura hasta el COMMIT, y por eso el `max+1` de
  `next_payment_order_code` ve la orden anterior.
- **El `FOR UPDATE` de la orden** serializa dos anulaciones. También hace que la
  anulación espere un update de `journal_entry_id` en curso y devuelva el asiento
  guardado (escenario 9). Sin él, la carrera pierde el asiento; sólo el
  centinela del contrato lo notaría.

### Qué no cambia

- No se tocan `next_payment_order_code`, los wrappers de la 0294 ni ninguna otra
  función, policy, ACL, trigger o fila. El contrato lo verifica contra un
  snapshot del catálogo.
- La anulación de la CxP (`voidBillFor`) sigue igual: su wrapper ya exige
  `paid_amount = 0` en el mismo UPDATE. Con la RPC, además, espera al pago en
  curso (escenarios 7 y 8).
- `createBillFor` y `next_bill_code` siguen igual (ver Fuera de alcance).
- Asientos contables: siguen fuera de la transacción y best-effort (SDD-0044).
- Pantallas: no cambian.

### Allowlist exacta

- `supabase/migrations/0468_pago_proveedor_atomico.sql`
- `supabase/tests/0468_pago_proveedor_atomico.test.sql`
- `supabase/tests/0468_pago_proveedor_carrera.test.sql`
- `supabase/migrations-baseline.json` (sólo la espera de 0468)
- `supabase/pending-migration-symbol-declarations.json` (sólo la declaración
  `sdd-0489-pago-proveedor-atomico`)
- `lib/studio/treasury/treasury-actions.ts`
- `lib/studio/treasury/types.ts` (sólo la regla de saldo de `validatePaymentInput`)
- `lib/studio/treasury/__tests__/treasury.test.ts` (sólo la prueba del centavo)
- `lib/studio/treasury/__tests__/treasury-payments.test.ts`
- `lib/studio/__tests__/pago-proveedor-atomico.migration.test.ts`
- `docs/specs/0489-carrera-pago-proveedor/spec.md` y `docs/specs/README.md` (regenerado)
- `.agents/handoffs/0489-carrera-pago-proveedor.md`

## Aceptación

1. Sin la 0468, cada uno de los 9 escenarios reproduce el daño en `postgres:17`
   con dos sesiones: pérdida de suma, sobrepago, código repetido, CxP que revive
   o asiento perdido.
2. Con la 0468, en los mismos escenarios, S2 esperó un lock: en el 6 el
   consultivo del tenant, y en los demás la fila. Salen el rechazo esperado y
   dos códigos distintos, y el invariante se cumple en toda CxP.
3. Cada mutante de la 0468 cae en sus escenarios. Son cuatro: sin cada uno de
   sus tres `FOR UPDATE` y sin el lock consultivo.
4. El contrato SQL pasa con la 0468 y falla sin ella (control rojo), en psql y en
   PGlite. Cubre reglas, efectos, herencia de moneda, auditoría D2 con motivo en
   la orden y en la CxP, ACL, CxP anulada, tenant ajeno, rol comercial y
   membresía doble.
5. En PGlite caen en su aserción 8 mutantes:
   - la tolerancia de 0,01;
   - la CxP que revive;
   - sin la regla de pagada;
   - sin la regla de anulada;
   - sin cada uno de los tres `FOR UPDATE`;
   - sin el lock consultivo.
6. La app ya no escribe `supplier_bills` ni `supplier_payments` al pagar o anular
   (fuera del `journal_entry_id` del asiento), y traduce todos los códigos. Las
   pruebas nuevas fallan contra el código anterior (control rojo).
7. `validatePaymentInput` rechaza un centavo sobre el saldo.
8. Quedan verdes `pnpm typecheck`, eslint de lo tocado, `docs:check`, `sdd:check`
   y `governance:check`. `check-pending-migration-symbols` dio
   `0 ROJO · 1 AMARILLO` mientras la 0468 esperaba, y quedó en
   `0 ROJO · 0 AMARILLO` al retirar la espera y la declaración.
9. Sam decide la regla de saldo de Tesorería antes de aplicar la 0468: eligió la
   estricta al autorizarla.

## Release

1. Sam decide la regla de saldo (ver
   [la decisión](#de-sam-2026-09-20-al-autorizar-la-0468-la-regla-de-saldo-en-tesorería)).
   Si hubiera elegido la tolerancia, se ajustaba la 0468 antes de pedir el OK.
2. Revisión del Director y OK nominal de Sam para la 0468, con la identidad del
   archivo que figura en el handoff.
3. Antes de aplicar, leer en producción, sólo catálogo, `md5(prosrc)` de tres
   funciones:
   - `next_payment_order_code(uuid)`;
   - `void_supplier_payment_with_audit_reason(uuid,text)`;
   - `get_user_tenant_id()`.

   El preflight exige los cuerpos de la 0088, la 0294 y la 0453 (exactos con
   CRLF→LF, o sin espacios), y aborta sin cambiar nada si difieren.

   Lectura de catálogo del 2026-09-19 a las 19:30 UTC:
   - las tres coinciden exacto con el repo (`0e481268…`, `f06331df…` y
     `5ff0c51c…`), con la seguridad y el tipo de retorno esperados;
   - no falta ni difiere ninguna de las 31 columnas del preflight;
   - las funciones nuevas no existen;
   - el ledger termina en la 0467 y la 0466.
4. Aplicar la 0468 sola, con `name` = `0468_pago_proveedor_atomico`.
5. Commit que retira la espera de `pendingBelowCutoff` y la declaración de
   símbolos. La cabecera del `.sql` no se toca: una migración aplicada no se
   edita.
6. CI verde, integración y smoke de Sam en Tesorería: registrar un pago parcial
   y otro que salde una CxP, y anular una orden de pago.

### Aplicación en producción (2026-09-19, 20:05 en Caracas)

La aplicó el Director con el OK nominal de Sam, que en la misma respuesta eligió
la regla: «autorizo 0468, usa la regla estricta». El Director transcribió el
archivo y lo comparó byte a byte con `cmp` antes de aplicarlo.

- **Preflight releído antes de aplicar.** Las tres dependencias con su md5
  exacto, las funciones nuevas inexistentes, 0 transacciones abiertas y 0 locks
  sobre `supplier_bills`, `supplier_payments` y `suppliers`.
- **Ledger.** `20260920000508 · 0468_pago_proveedor_atomico`, 1 sentencia, md5
  `83e8bc9873cbaf8c19329e895f4cbc06` y 18871 bytes: idéntico al archivo.
- **Postflight**, releído del catálogo de producción por el Worker:
  - `register_supplier_payment_order`: `md5(prosrc)` `65d6c9a18b58a0dabafd6de0b03af325`,
    3078 caracteres (3083 bytes);
  - `void_supplier_payment_order`: `79f53ed98b142d87495feccadc7da9cf`, 2385
    caracteres (2390 bytes).

  Son los mismos md5 medidos en PGlite y en `postgres:17`. Las dos son INVOKER y
  volátiles, con owner `postgres`, `search_path` vacío, comentario y EXECUTE sólo
  para `authenticated`: ni `anon` ni `service_role`. Las dependencias y las
  tablas quedaron sin cambios.
- **Advisors de seguridad.** 0 nuevos y 0 desaparecidos.

Pasos cumplidos: 1 a 5, con este commit, que retira la espera y la declaración
de símbolos y deja el gate en `0 ROJO · 0 AMARILLO`. La cabecera del `.sql` no se
toca. **Pendiente del release:** el paso 6, con CI verde, integración (despliega
a producción) y el **smoke de Sam** en Tesorería: registrar un pago parcial y
otro que salde una CxP, y anular una orden de pago.

**Rollback.** Antes de desplegar la app, basta con `drop function` de las dos
funciones; ninguna otra cosa cambió. Con la app desplegada, primero hay que
revertir la app.

## Gobernanza

| Política | Clasificación | Evidencia |
|---|---|---|
| SGE-00.04 / AUD-01 §1 (mutación y evento, una operación) | **cumplimiento** | La D2 corre en la misma transacción que la orden y el saldo. El contrato comprueba `payment_registered`, `bill_status_changed` y `payment_voided`, con el motivo también en el evento de la CxP. Antes, orden y CxP iban en requests separados. |
| SGE-00.05 (permisos y tenant en el servidor) | **cumplimiento** | Rol accounting/admin en la base, con pruebas negativas: rol comercial, sin membresía, membresía doble y tenant ajeno. |
| SGE-00.06 (prevenir antes de informar) | **cumplimiento** | Las mismas reglas antes de mutar, bajo lock. El mensaje dice qué pasó y qué hacer («Actualiza la página»). |
| SGE-00.11 / ERR-01 (lenguaje del error) | **cumplimiento** | Hay un mensaje por código y nunca se muestra el texto crudo; lo cubre una prueba. |
| MP-01 (permanencia) | **no aplica** | No hay borrado nuevo. Anular sigue siendo una marca con motivo (R3 de la 0294). |
| SGE-00.07 / BTN-01 (UI) | **no aplica** | No cambian pantallas ni botones. |
| Hueco de rol en `supplier_*` por PostgREST | **no conformidad preexistente** | Fuera de alcance (nº 1). |

## Evidencia

### Carrera real (`supabase/tests/0468_pago_proveedor_carrera.test.sql`)

Corrida del 2026-09-19 en `postgres:17`, con 38 aserciones. La tabla sale de una
copia fuera del repo que agrega un NOTICE por escenario. Cada cifra es
pagado/total de la CxP; «órd.» es la suma de las órdenes vigentes.

| # | Escenario (S1 → S2) | ANTES (app vieja) | DESPUÉS (0468) |
|---|---|---|---|
| 1 | pago 300 → pago 200 | 300/1000 con órd. 500: **se perdió 200** | 500/1000; S2 esperó |
| 2 | pago 600 → pago 600 | 600/1000 con órd. 1200: **pérdida y sobrepago** | 600/1000; S2 `PAYMENT_EXCEEDS_BALANCE` |
| 3 | anulación de 400 → pago 300 | 0/1000 `pendiente` con órd. 300: **se perdió el pago** | 300/1000 |
| 4 | pago 300 → anulación de 400 | 700/1000 con órd. 300: **se perdió la anulación** | 300/1000 |
| 5 | anulación de 400 → anulación de 300 | 300/1000 con órd. 0: **se perdió una anulación** | 0/1000 `pendiente` |
| 6 | pago → pago en otra CxP del tenant | S1 muere por `supplier_payments_tenant_id_payment_code_key` | OP-2026-0015 y OP-2026-0016; S2 esperó en el lock consultivo |
| 7 | pago 300 → anulación de la CxP | la CxP se anuló y **revivió** `parcial` 300/1000 con una orden | la anulación espera y sale «La CxP ya no admite anulación.»; `parcial` 300/1000 |
| 8 | anulación de la CxP → pago 300 | ídem: **revivió** `parcial` 300/1000 | el pago espera y sale `PAYMENT_STATE`; `anulada` 0/1000 |
| 9 | asiento del pago → anulación de la orden | la anulación entrega el asiento **vacío**: el guardado queda vivo | entrega el asiento guardado |

**Mutantes, fuera del repo.** Cada uno cae en DESPUÉS en sus escenarios, y el
control, la 0468 del repo, pasa:

- sin el `FOR UPDATE` de la CxP al pagar: 1, 2, 3 y 8;
- sin el de la CxP al anular: 4 y 5;
- sin el de la orden al anular: 9. Deja el asiento guardado y entrega uno
  vacío;
- sin el lock consultivo: 6. S2 muere por el código repetido.

En ninguna corrida quedó un control ANTES sin reproducir.

### Contrato y pruebas

- **Contrato**, `supabase/tests/0468_pago_proveedor_atomico.test.sql`, en
  `postgres:17`:
  - con la 0468: `TEST 0468 GREEN: 84 aserciones`;
  - sin ella (`-v apply_fix=false`): falla en la primera aserción,
    `existe public.register_supplier_payment_order(…)`.
- **PGlite**, `pago-proveedor-atomico.migration.test.ts`: 10 de 10. Son el
  contrato, el control rojo y 8 mutantes, cada uno en su aserción.
- **Pruebas unitarias de Tesorería:** 68 de 68 (`treasury.test.ts` y
  `treasury-payments.test.ts`). Contra el `treasury-actions.ts` y el `types.ts`
  de `d624ea45` fallan 9, las nuevas que dependen del cambio.
- **Locks de la 0468**, medidos en `postgres:17` sobre el fixture del contrato
  ya comprometido: ningún lock de relación fuera del catálogo; sólo catálogo y
  los objetos de las dos funciones nuevas.
- **Gate de símbolos:** `0 ROJO · 1 AMARILLO declarado(s)`.

### `pnpm verify` completo

Corrió en el turno de máquina del Director, sobre `6adbb662` (con main
`6c2413d1` incluida), de las 19:39 a las 19:54 UTC del 2026-09-19. Midió 16 de
17 pasos y ninguno falló.

- **PASÓ:**
  - harness, lint, rsc-boundary, typecheck y edge-functions;
  - `test`: 8120 pruebas en 622 archivos;
  - `docs:check`, numbering, feature-constants, `components:check` y
    `governance:check`;
  - `pending-migration-symbols`, con `0 ROJO · 1 AMARILLO`;
  - `sql-tests`: 218 contratos, entre ellos los dos de la 0468;
  - `schema-rebuild`: 446 migraciones desde cero, la 0468 incluida;
  - e2e: 167 verdes y 18 omitidas. Hubo 1 intermitente de la calculadora
    pública, ajena a Tesorería, que pasó al reintento;
  - build.
- **NO EJECUTADO:** `migrations-applied`, porque el worktree no tiene
  credenciales. El ledger se leyó directo en producción (ver Release).

La identidad del archivo y los comandos están en el handoff
`.agents/handoffs/0489-carrera-pago-proveedor.md`.

## Fuera de alcance detectado

1. La RLS de `suppliers`, `supplier_bills` y `supplier_payments` sólo filtra por
   tenant (0088:266-282, con 0230). Cualquier miembro del tenant, también el rol
   comercial, puede hacer INSERT, UPDATE o DELETE directo por PostgREST, incluido
   `paid_amount` y `status`, que no tiene CHECK. Los wrappers
   `void_supplier_*_with_audit_reason` (0294) tampoco exigen rol.
2. `next_bill_code` y `next_supplier_code` (0088) calculan `max+1` sin lock. Dos
   CxP o dos proveedores creados a la vez en el mismo tenant sacan el mismo
   código, y el segundo muere por el unique.
3. Los generadores de la 0088 hacen `lpad(v_max::text, 4, '0')`, que trunca desde
   el 10000. La orden 10000 de un año saldría como `OP-AAAA-1000` y chocaría con
   el unique.
4. El asiento del pago sigue fuera de la transacción (SDD-0044). Una anulación
   que llega entre el COMMIT de la RPC y el update de `journal_entry_id` no ve el
   asiento, y ese asiento queda vivo para una orden anulada. El `FOR UPDATE` de
   la orden sólo cubre el update en curso. Cobranzas tiene la misma ventana con
   la 0467.
