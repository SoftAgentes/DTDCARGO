---
sdd: "0312"
title: "Contratos para la lógica de negocio que corría sin red"
status: done
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0024", "0045", "0054", "0059", "0069", "0072", "0310", "0311"]
confidencialidad: interno
---

# DTD-0312 — Contratos para la lógica que corría sin red

> Seis migraciones que deciden cuánto se le cobra a un cliente, si su
> aceptación legal vale, si un despacho puede retroceder, cuánta plata se le
> rinde a la Operadora, cuánto se le debe al socio en China y quién puede
> escribir en el expediente de otro. Ninguna tenía contrato.

## Primero, el número honesto

En el barrido de SDD-0310 reporté **«54 migraciones con lógica de negocio sin
contrato»**. Al volver a medirlo con el filtro escrito y a la vista, el número
es otro:

| Medida | Resultado |
|---|---|
| Migraciones que definen función o trigger de negocio | **240** |
| …con contrato (propio o cargado por otro vía `\ir`) | 90 |
| …**sin contrato** | **150** |

El 54 salió de un filtro más estrecho que nunca dejé escrito, así que no era
reproducible. **150 es el número con el filtro que sí está en el repo**
—descarta plomería (`touch_updated_at`, `set_updated_at`) y las migraciones de
reparación de historial— y cuenta como cubierta la migración que otro contrato
carga con `\ir`, no sólo la que tiene un archivo con su número.

150 no se cubren en una noche. Lo que se puede hacer es **ordenar por daño** y
atacar la cabeza.

## Cómo se ordenó

No por cuánta lógica tiene cada migración, sino por qué se pierde si esa lógica
se rompe: borra datos (10) · toca dinero (9) · inmutabilidad (8) · aislamiento
entre tenants (8) · rechaza con excepción (7) · correlativo único (6) · máquina
de estados (5) · permisos (5).

Cabeza de la lista: `0123_rendiciones` (43) · `0024_dispatch_core` (40) ·
`0128_sales_order_invoicing_hardening` (40) · `0093_comments_hardening` (37) ·
`0114_financiero_china` (35) · `0102_capa_legal` (34). Se cubrieron las seis.

## Los seis que se cubrieron

### 1 · `0128` — el núcleo transaccional de la auto-facturación

`sales_order_claim_and_invoice` decide **cuánto se le cobra a un cliente** y
emite la factura. Es de las migraciones con más lógica de dinero del repo y no
tenía una sola prueba.

Nueve contratos. El que más importa es **el denominador congelado**: el
prorrateo divide el total de la OV entre las cajas, y si ese universo se
recalcula en cada recepción, dar de baja una caja hace que otra pase a valer el
doble. El escenario lo demuestra con números: la misma caja de 2 sobre 10 debe
facturar $200 y no $400, aunque después se den de baja 5 cajas.

También: nunca re-factura la misma caja · la última absorbe el resto exacto y la
suma nunca se pasa del total · `total == base + iva` al centavo (si no cuadra,
el asiento contable aborta y la factura queda emitida sin contabilizar) · una
caja no se cuelga de la OV de otro tenant · un **borrador** no cuenta como
facturado (si contara, la caja siguiente se facturaría de menos y nadie lo
notaría) · los gates duros rechazan antes de emitir nada.

### 2 · `0102` — la prueba legal de que el cliente aceptó

`legal_acceptances` es la única evidencia de que un cliente aceptó las
condiciones. Sin certificado de un PSC acreditado por SUSCERTE, esa aceptación
se valora por sana crítica (art. 17 LMDFE): **vale lo que valga la integridad
del registro**. Una fila editable no prueba nada — y el día que se necesita es
el día de un reclamo.

Siete contratos: append-only de verdad (ni UPDATE ni DELETE, aunque los grants
existan) · `hash` NOT NULL, porque el gate AUT-04 lo recomputa y compara · **la
idempotencia es por hash, no por `idempotency_key`** — la migración avisa que
dos NULL no colisionan en Postgres, así que el escenario usa dos filas con esa
clave en NULL a propósito: si la protección fuera la otra, el contrato pasaría
sin probar nada · el cliente tiene que ser del mismo tenant · **un solo
documento vigente por (tenant, key)**, porque con dos, «las condiciones que el
cliente aceptó» son ambiguas · el correlativo `AC-YYYY-NNNN` no se comparte
entre tenants.

### 3 · `0024` — la máquina de estados del despacho

La última milla en Venezuela. Retroceder un estado no es prolijidad: una orden
que vuelve de `entregada` a `en_ruta` deja **una entrega firmada colgando de un
viaje en curso**.

Seis contratos: los terminales no se mueven · de `entregada` sólo se va a
`cerrada` · no se retrocede · la base sella las horas **y respeta la que le
pasen** · el camino legítimo completo pasa · editar un campo que no es el status
pasa libre aunque la orden esté cerrada.

El cuarto merece su párrafo. El `is null` del trigger no es cosmético: el
camionero sin señal registra la salida a las 08:00 y sincroniza a las 11:00. Si
el trigger pisara con `now()`, la orden diría que salió a las 11:00 — **tres
horas de viaje borradas del registro que después se usa para responderle a un
cliente**.

### 4 · `0123` — la rendición quincenal a la Operadora

El documento con el que se liquida plata: recaudado de terceros menos servicios
locales facturados. Sus tres totales quedan congelados al emitir, a propósito —
es un corte de quincena. Si se pueden reescribir después, no hay corte: hay una
cifra que dice lo que diga quien la tocó último.

Siete contratos. El que de verdad importa es el **3**: anular **y** reescribir
un total en la MISMA sentencia. Un guard que sólo validara la transición
`emitida → anulada` lo dejaría pasar — la transición es legítima y el monto
viaja de contrabando. La migración lo cubre con un segundo bloque que compara
campo por campo, y ese bloque no tenía prueba.

Y el par **4 + 5**, que es lo más bonito de esta migración: un recibo entra en
**una sola** rendición activa (si entra en dos, la misma plata se rinde dos
veces) **y** al anular queda libre. La protección es un índice único parcial y
el escape es un trigger de sincronía — dos piezas distintas, y hacen falta las
dos: sin el sync, el recibo queda preso y una rendición anulada no se rehace
nunca.

### 5 · `0093` — el hardening de comentarios

Nació de una revisión adversarial: la action validaba bien, pero un cliente
autenticado puede saltársela y escribir directo por PostgREST. Ésa es toda la
razón de que estos guards vivan en la base — y por eso mismo los tests de la app
no los prueban: hay que escribir en la tabla como lo haría el atacante.

Seis contratos: no se comenta sobre una entidad de otro tenant ni sobre una
inexistente · un `entity_type` desconocido cae en **fail-closed** (la rama
`else` del CASE, la que se olvida el día que se agrega una tabla comentable) ·
no se menciona a alguien de otro tenant **ni a un usuario deshabilitado** · de
una mención sólo se toca `read_at` · y `read_at` sí se escribe.

⚠️ **El guard de menciones no lanza excepción: revierte en silencio.** Reasigna
`new.* := old.*` y devuelve la fila, así que el UPDATE dice que tocó una fila y
no cambió nada. Un contrato que esperara un error saldría ROJO con la protección
puesta; uno que esperara éxito saldría VERDE sin ella. Por eso se afirma sobre
el valor guardado.

### 6 · `0114` — la cuenta corriente con el Socio Logístico China

Cargos, notas de crédito, conversiones de divisa y el cruce de reclamos. El
saldo neto **no se persiste** —se deriva en `lib`, justamente para no
driftear—, así que **la integridad de estas filas ES el saldo**. Una fila
colgada del proveedor equivocado no da error en ningún lado: da un número
distinto.

Ocho contratos. El más útil no es el más obvio: el guard cross-tenant es **una
función genérica compartida por tres triggers**, así que basta con que a una
tabla le falte su `create trigger` para que quede sin puerta mientras todo lo
demás sigue verde. El contrato lo prueba en **las tres**, y la mutación lo
confirma: borrando el trigger de `partner_ledger_entries` o el de
`supplier_claim_offsets`, se pone rojo.

También: proveedor dado de baja rechazado (`deleted_at is null`) · la
referencia NULL sí pasa, porque el contenedor es opcional · no se borra un
cargo con notas de crédito vivas ni un proveedor con movimientos · el CHECK de
moneda **admite RMB** —que no está en el enum `invoice_currency`, y ése es
justamente el motivo de que estas tablas usen `text` con CHECK propio— y
rechaza lo inventado.

## Verificación

**127 contratos SQL** en verde (eran 121). Cada guard validado por mutación:

| Migración | Contratos | Mutaciones probadas | Detectadas |
|---|---|---|---|
| 0128 sales_order_invoicing_hardening | 9 | 5 | 5 |
| 0102 capa_legal | 7 | 7 | 7 |
| 0024 dispatch_core | 6 | 5 | 5 |
| 0123 rendiciones | 7 | 8 | 8 |
| 0093 comments_hardening | 6 | 7 | 7 |
| 0114 financiero_china | 8 | 10 | 10 |

**42 mutaciones, 42 detectadas.**

Dos precisiones sobre qué reporta cada mutación, porque «detectada» no siempre
quiere decir «la detectó el contrato que la nombra»:

- En `0123`, quitar el guard de la transición lo atrapa el **contrato 5** («una
  rendición ANULADA volvió a emitida»), no el 2. El 2 sí puede caerse: con los
  **dos** guards del UPDATE apagados grita, verificado aparte. Ningún contrato
  de este archivo es decoración.
- En `0093`, los contratos **1 y 2 comparten guard**. Cualquier mutación que
  rompa el 2 rompe también el 1, que corre primero y es el que reporta.

Gate completo `node scripts/verify.mjs`.

## 🔴 Tres de seis contratos del despacho nacieron decorados

La primera versión de `0024` afirmaba mirando el **texto de la excepción**
(`position('terminal' in sqlerrm)`). Con el guard arrancado salía **verde**,
porque mi propio mensaje de fallo —*«se resucitó una orden terminal»*— contenía
la palabra que el handler buscaba: el `raise` de la prueba caía en su propio
`exception when`.

Otro salía verde porque el escenario no llegaba a ejercitar la línea mutada, y
un tercero porque el detector del arnés buscaba un carácter Unicode equivocado
(ése era el arnés, no el contrato: verificado a mano, el archivo sí se ponía
rojo).

La reescritura mira **el estado de la fila después del intento**, no cómo falló:
`intentar()` se traga cualquier error y devuelve el status real. Así no importa
si el guard rechaza con excepción, con un no-op silencioso o de ninguna forma —
lo que se afirma es dónde terminó la fila.

**Un contrato no puede depender de cómo está redactado su propio fallo.** Es la
tercera variante del mismo error esta sesión, después de las dos de SDD-0311
donde el contrato se cumplía con mi propio comentario.

## Lo que esta spec NO puede afirmar

- **Que las otras 144 estén bien.** Se cubrieron 6 de 150. La lista rankeada
  queda medida y reproducible, no resuelta.
- **Que estos guards funcionen con datos reales.** Los contratos corren sobre un
  Postgres desechable con stubs de fidelidad mínima: fieles en los tipos
  `numeric` (la mitad de los contratos de 0128 son sobre centavos) y
  deliberadamente pobres en todo lo que la migración no mira.
- **Que la lógica sea la correcta.** Un contrato fija el comportamiento actual
  contra regresiones; no dice que la regla de negocio sea la que el founder
  quiere. Lo de 0128 en particular —el prorrateo, el redondeo de la última
  factura— merece una lectura suya.

## Siguiente por daño

`0115_partner_statements` (29, dinero×21 y aislamiento×17 — es el Slice B de
la misma 0114) · `0070`/`0072` (38, borran datos) · `0128`… ya está ·
`0090_comments` — la inmutabilidad de `comments` (no la de las menciones)
sigue sin contrato: la 0093 sólo cubre lo suyo.
