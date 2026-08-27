---
sdd: "0312"
title: "Contratos para la lógica de negocio que corría sin red"
status: done
author: "founder"
created: 2026-08-26
updated: 2026-08-26
supersedes: null
superseded_by: null
related: ["0024", "0028", "0029", "0036", "0045", "0051", "0054", "0059", "0069", "0072", "0096", "0101", "0109", "0111", "0310", "0311"]
confidencialidad: interno
---

# DTD-0312 — Contratos para la lógica que corría sin red

> Diecinueve migraciones que deciden cuánto se le cobra a un cliente, si su
> aceptación legal vale, si un despacho puede retroceder, cuánta plata se le
> rinde a la Operadora, cuánto se le paga al socio en China, cuánto se le paga a
> alguien que se va, a qué proveedor se le sigue comprando, **quién puede borrar
> la única foto de lo que llegó**, qué puede tocar un operario desde el
> teléfono, qué se declara en aduana, si se le paga un siniestro, a quién se le
> acredita un referido, quién puede escribir en el expediente de otro y quién
> puede quemarle el correlativo a otra empresa, y si el expediente de un bug
> dice la verdad de lo que se hizo con él. Ninguna tenía contrato.

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

## Los dieciséis que se cubrieron

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

### 7 · `0115` — la reconciliación del estado de cuenta del socio

Slice B1 de la misma 0114: se importa el estado de cuenta que manda el socio y
se decide qué línea corresponde a qué cargo del ERP. **Es el paso previo a
pagarle.** Una línea atada al cargo equivocado no da error: da un pago mal
conciliado y, del otro lado, un neto que no cuadra sin que nadie sepa por qué.

Ocho contratos. El que más vale es el **4**, y no es de esta migración: la 0115
**le pone a `supplier_credit_notes` el trigger cross-tenant que la 0114 nunca le
puso**. Una nota de crédito contra el cargo de otro tenant le baja el neto a esa
empresa — plata que se deja de pagar del lado de allá, sin que nada avise. Por
eso el contrato **carga las dos migraciones**: con sólo la 0114 el hueco sigue
abierto y con sólo la 0115 no compila.

Y el **7**, una asimetría deliberada que se prueba en los dos sentidos: borrar
el estado de cuenta **sí** borra sus líneas (cascade), pero borrar un cargo del
ERP **no** — deja la línea sin match (`set null`). La línea es evidencia de lo
que el socio facturó y no se pierde porque del lado del ERP se corrija algo.

### 8 · `0070` + `0072` — lo que el operario puede hacer desde el teléfono

`operario_action` se reescribió entera **seis veces** (0066 → 0067 → 0068 →
0069 → 0070 → 0072). La 0070 agregó `edit_receipt`; la 0072 la recreó completa
para arreglar un bug de runtime. **Producción corre la de 0072** — verificado
contra `pg_get_functiondef`, no supuesto. El contrato carga las dos en orden,
que además demuestra cuál gana.

Ocho contratos. Los dos que valen el trabajo:

🔴 **Editar la recepción SIN mandar items no borra los items.** El
`delete from warehouse_receipt_items` sólo corre si el payload los trae. Si
corriera siempre, un operario corrigiendo el conteo de cajas se llevaría por
delante la mercancía declarada — que es lo que después viaja en la aduana.

🔴 **Pero `items: []` sí los vacía.** La diferencia entre «ausente» y «vacío»
decide si sobrevive la declaración. No es un accidente: es la única forma que
tiene el operario de borrar una lista mal cargada. Queda fijada para que nadie
la cambie sin darse cuenta de cuál de las dos está tocando.

Y el resto: sólo su recepción (salvo supervisor) · sólo en
`pendiente_consolidacion` · nunca la de otro tenant · operario inactivo o de la
región equivocada rechazado · en `scan_box`, un receipt sellado no admite más
escaneos, una caja ajena no entra, y una ya escaneada no se re-escanea.

#### 🔴 Y una medición que cambió lo que este contrato debía afirmar

El bug que arregló la 0072: las ramas escribían `entity_type =
'warehouse_receipt'` (genérico) y el CHECK de `entity_audit_log` sólo admitía
cinco valores. Reventaba con **23514 en runtime** — invisible a typecheck y a
build, o sea en la mano del operario, en Yiwu, sin nadie mirando.

**Ese CHECK ya no existe.** Al medirlo contra producción, `entity_audit_log`
fue endurecido después y `entity_type` pasó a ser una **FK contra el catálogo
`audit_entity_types`** (45 tipos). Un contrato que hubiera reproducido el CHECK
de la migración habría salido verde probando una protección que la base ya no
tiene.

El stub modela la FK. El fix de la 0072 sigue siendo load-bearing: el catálogo
trae los tres tipos correctos y **no** trae el genérico. Sólo cambió el número
del error (23503 en vez de 23514), no la consecuencia.

### 9 · `0012` — el guard de tenant en las RPC

Los siete generadores de correlativo (`next_markbox`, `next_quote_code`, …) son
**security definer**: corren con los privilegios del dueño y se saltan RLS por
diseño, porque tienen que barrer la tabla entera para calcular el siguiente
número. Eso los vuelve la superficie más golosa del schema — si no validan de
quién es el tenant que reciben, cualquier usuario autenticado le quema el
correlativo a otra empresa, o le lee cuántos clientes tiene, con una llamada.

Fue el **FINDING-001 (CRITICAL)** de la auditoría RLS del 2026-05-24.
`assert_tenant_match` lo cerró, y no tenía contrato.

#### 🔴 Lo que de verdad se protege: la lógica de tres valores

El guard parece que podría ser una línea:

```sql
if p_tenant_id <> v_caller_tenant then raise; end if;
```

Y **estaría roto**. En SQL, `NULL <> 'algo'` no es TRUE: es **NULL**. Un `if`
con condición NULL no dispara. Esa versión «obvia» **deja pasar al llamador sin
sesión** — que no es el caso raro, es el atacante.

Por eso el guard tiene dos `is null` explícitos antes de comparar, y por eso la
mutación central de este contrato es exactamente ésa: reemplazar el guard por su
versión de una línea. Sale rojo en el contrato 1.

Siete contratos: sin tenant en el argumento rechaza · sin sesión rechaza ·
tenants distintos rechazan con 42501 · el caso legítimo pasa · **los siete
correlativos llaman al guard** —se prueban los siete, porque basta que a uno le
falte el `perform` para que quede abierto mientras el resto sigue cerrado— ·
`anon` no ejecuta ninguno · y todas son security definer **con `search_path`
fijado**, que sin eso quien controle el search_path antepone un esquema propio y
hace que la función corra SU tabla con los privilegios del dueño (ADVISOR-A).

### 10 · `0098` — el programa de referidos

Un referido es la promesa de pagarle a un cliente por traer a otro. Si el
vínculo se corrompe no hay error en pantalla: hay un crédito que se le acredita
a quien no fue, o que no se le acredita a nadie. Y quien reclama es el cliente
que trajo al otro.

Seis contratos. El que vale documentar es el **4**, porque fija un diseño que se
lee como un descuido y no lo es: **el referido sobrevive al borrado del cliente
referidor**. La FK es `on delete set null` y `referrer_markbox` es NOT NULL y
denormalizado, así que borrar al cliente suelta el vínculo pero no borra el
referido ni pierde de quién era. Con un `cascade` se irían con él todos los
referidos que trajo — y con ellos, la prueba de que los trajo.

Y el **1**: las dos puntas (referidor y referido) se validan por separado en el
trigger, así que un contrato que mirara sólo una dejaría la otra abierta. Se
prueban las dos, y la mutación lo confirma punta por punta.

### 11 · `0152` + `0153` — los reclamos del cliente

Un reclamo es un cliente diciendo que su carga llegó dañada, incompleta o tarde,
y un monto en dólares al lado. Es el registro que decide si se paga un siniestro.
La 0153 es aditiva sobre la 0152 y agrega toda la superficie del **portal**, que
es la que un cliente puede tocar desde afuera — por eso el contrato carga las
dos.

Seis contratos. Los que importan:

🔴 **El cliente del portal lee lo suyo y no escribe.** Se prueba con RLS puesta y
rol `authenticated`: ve un solo reclamo de los dos del tenant, no puede crear uno
con monto propio, y su UPDATE no cambia nada. Es la única defensa que vive en la
base contra un cliente que se forje un siniestro.

🔴 **La puerta de servicio es sólo para `service_role`.**
`next_claim_code_service` existe SIN `assert_tenant_match` porque el cliente del
portal no está en `user_tenants` y su hermana fallaría. Justamente por eso no
puede quedar al alcance de nadie más: leería el correlativo de cualquier tenant.

🔴 **Los hitos se sellan una vez.** `evaluated_at` al entrar a evaluación y no se
re-sella; `resolved_at` en los **tres** terminales y **no** en `aprobado` —
aprobar no es cerrar. Las tres filas de la seed demo de la 0152 sirven de
comprobación extra: pasaron por el trigger de verdad al aplicarse la migración,
no las inventó el contrato.

#### 🔴 Lo que este contrato NO puede probar, y queda dicho

La 0153 documenta que el INSERT del cliente **no va por RLS a propósito**: la
action del portal usa el admin client y controla los campos sensibles
(`amount_usd = 0`, `insured = false`, `status = 'reportado'`, `source =
'portal'`) para que el cliente no forje un monto ni se marque como asegurado.

**Ese control vive en la aplicación, no en la base.** Ningún contrato SQL lo
alcanza. Está escrito en la cabecera del archivo para que nadie lea el verde como
si cubriera esa mitad.

### 12 · `0147` — el packing list que manda el proveedor

El proveedor chino abre `/p/{token}` —anónimo, sin cuenta— y manda el packing
list: qué hay en cada caja, cuánto pesa, cuánto vale. **Es el papel con el que
después se declara en aduana.** Puede grabar tres veces mientras corrige, así
que la tabla es append-only con versionado: el equipo ve la última y el
historial queda entero.

Ocho contratos. Dos que valen documentar:

🔴 **`version_no` es monotónico y cuenta también las borradas.** El `max()` de la
RPC no filtra por `deleted_at` a propósito: si filtrara, borrar la v2 haría que
el próximo envío volviera a ser v2 y la cadena tendría dos «versión 2» distintas.
El historial dejaría de ser una cadena justo cuando alguien pregunta qué declaró
el proveedor.

🔴 **La RPC es sólo `service_role`.** El proveedor es anónimo: su capability es
el token, y quien lo valida es el route server-side. Si `anon` o `authenticated`
alcanzaran la RPC, cualquiera inyectaría un packing list en la orden de
cualquiera — sin token y sin rastro. La tabla, además, no tiene ninguna policy
para `anon`: el proveedor nunca la toca.

#### La séptima variante: dos protecciones del mismo hecho

«Una sola versión vigente por orden» está sostenida por **dos** piezas: el índice
único parcial y el `update is_current = false` de la RPC. Romper el índice dejaba
el contrato en verde, porque con la RPC intacta el comportamiento sigue bien.

No era decoración — era que el escenario sólo entraba por la RPC. Se agregó un
**INSERT directo**, que es lo que haría un cliente PostgREST saltándose la RPC, y
es lo único que pone al índice a prueba solo.

### 13 · `0179` — el finiquito de egreso

Lo que se le paga a una persona cuando deja de trabajar acá, calculado según la
causa de terminación que manda la LOTTT. **Es plata que sale hacia alguien, con
su nombre adentro.**

Ocho contratos. Los dos que más pesan:

🔴 **RLS por tenant Y por ROL.** Es PII de egreso más dinero, así que la policy
no alcanza con el tenant: exige `nomina_can_access()`. Se prueba con RLS puesta y
**dos usuarios del mismo tenant** — el contador ve sus finiquitos, y el
operativo no ve ni uno, ni un renglón del desglose, ni puede crear uno. El gate
de rol de la app es la segunda capa, no la única.

🔴 **Un solo finiquito vivo por empleado**, y anular sí libera. Un segundo
finiquito no anulado es pagarle dos veces la misma liquidación; y un finiquito
mal calculado tiene que poder rehacerse.

Y el guard de fechas, que parece trivial y no lo es: **el egreso nunca antes del
ingreso**. La antigüedad sale de esa resta — invertida, las prestaciones salen
absurdas y nadie lo ve hasta el pago.

### 14 · `0236` — el scorecard de proveedores

El rating A/B/C/D decide a qué proveedor chino se le sigue comprando. Se deriva
en vivo de señales atómicas (¿llegó a tiempo? ¿conforme?) y de los reclamos —
nunca es una columna que alguien teclea. Eso lo hace auditable, y también lo
vuelve frágil de una forma silenciosa: si la fórmula y la letra se separan, la
pantalla muestra una letra que no corresponde al número y nadie tiene cómo
notarlo.

Siete contratos. Los tres que valen:

🔴 **Un proveedor sin historia no es malo: es desconocido.** Con cero órdenes el
grade es NULL («Sin datos»), no «D». Si saliera D, se le dejaría de comprar a un
proveedor nuevo por no tener pasado.

🔴 **`security_invoker = on` en la vista.** Sin eso, la vista corre con los
permisos de su dueño y se salta la RLS de las tablas de abajo: un tenant vería
el scorecard del otro, con los nombres de sus proveedores y su desempeño. Se
prueba con RLS puesta y rol `authenticated`.

🔴 **La letra nunca contradice al número.** Además de los tres casos elegidos a
mano (100/A · 92/A · 48/D), hay una afirmación que barre **todo** lo que la
vista devuelva y exige que el grade coincida con los umbrales del Norte.

### 15 · `0022` + `0183` — las fotos de la recepción en Yiwu

Son las fotos que el operario le toma a la mercancía cuando entra a la bodega.
Es la **única prueba** de qué llegó y en qué estado: cuando el cliente reclama
que faltaba una caja o que venía golpeada, lo que se mira es esto. Y son fotos
de la carga de un cliente — quién las ve importa tanto como quién las borra.

Diez contratos. Los tres que pesan:

🔴 **`unlink_receipt_photo` no borra la foto de otra empresa.** Es la que
destruye evidencia. Borra por id filtrando por el tenant del operario; si ese
filtro se cae, un operario borra la prueba de un reclamo ajeno y la RPC **ni
siquiera falla** — devuelve el path y el server action borra el objeto del
bucket detrás.

🔴 **Las dos RPC son sólo de `service_role`.** Son `security definer` y reciben
el `p_operario_id` **como parámetro**: no lo derivan de la sesión. Quien las
pueda ejecutar elige de qué operario hacerse pasar, y una de ellas borra. La
0183 las re-declara con un `revoke` más corto que el de la 0022 (omite
`authenticated`), así que el contrato mide el **estado final**, no la intención.

🔴 **El bucket es privado y la lectura va acotada por el PATH.** Acá no hay
columna `tenant_id` que gobierne: lo único que separa las fotos de una empresa
de las de la otra es el primer segmento de un string. Se prueba con la RLS de
`storage.objects` encendida —que la trae Supabase, no esta migración—; sin
encenderla, las policies existirían sin gobernar nada y el contrato pasaría
siempre.

Y la que aporta la 0183: **el reintento offline no duplica la foto ni devuelve
null.** La cola reintenta cuando se pierde la RESPUESTA, no la subida; con null
el teléfono lo lee como fallo y reintenta esa foto para siempre.

⚠️ **Hallazgo que queda anotado y no se puede contratar acá:** el
`on conflict (id) do update` del bucket reajusta el tamaño y los mime types,
pero **no toca `public`**. Si alguien abre el bucket a mano desde el panel,
re-correr la migración no lo vuelve a cerrar. El contrato sólo puede probar que
una aplicación limpia lo crea privado.

### 16 · `0028` + `0039` — el Bug Reporter

Once contratos y veinticuatro mutaciones, pero lo más útil de este archivo lo
dijo el primer intento de correrlo.

🔴 **La 0028 nació muerta, y un contrato lo habría gritado el día uno.** Su
`bug_advance_state` arma el renglón del timeline con un
`case when … then 'admin' else 'user' end`, que Postgres resuelve como `text`,
contra una columna del enum `bug_author_type` — y en un INSERT no hay cast
implícito de `text` a enum. **Ninguna transición de estado funcionaba.** Estuvo
así once números. Lo que la encontró no fue una prueba: fue el founder dándole
a «Tomar bug» en el drawer el 2026-05-26. La cierra la 0039 con un cast
explícito, y el contrato carga las dos porque lo que corre es la de abajo.

Es el argumento de esta spec entera en un caso: no hizo falta una regresión
sutil ni un guard que se cae con el tiempo. Se publicó una RPC que **nunca**
funcionó, y el repo estuvo verde igual.

De los once, los tres que más pesan:

🔴 **La máquina de estados no deja saltar.** `nuevo → resuelto` de un tirón no
existe: hay que triar, y ese paso es el que deja quién lo tomó. Se prueban los
saltos prohibidos **y los permitidos** — una máquina que no deja avanzar
tampoco sirve, y sin ese medio contrato los prohibidos pasarían por la razón
equivocada. (Pasó: al cargar sólo la 0028, ninguna transición avanzaba y los
tres saltos prohibidos salían «bien».)

🔴 **Sólo un admin mueve estados, con UNA excepción exacta:** el reportador
puede mover SU bug de `espera` a `triaje` al responder. Se prueba que esa
excepción no se estira — ni desde otro estado, ni hacia otro estado, ni sobre
el bug de otro, ni para un compañero que no reportó.

🔴 **Nada se borra, y el folio es único PORQUE no se puede borrar.**
`next_bug_folio` es `max() + 1`: si `authenticated` pudiera borrar el último
bug, el siguiente reusaría su número y dos expedientes distintos compartirían
folio en la memoria de la gente. Las dos piezas se sostienen entre sí y el
contrato las ata.

#### ⚠️ Dos huecos medidos que el contrato **no** cierra

No se contratan a propósito: una afirmación que diga que están cerrados saldría
roja, y una que diga que están abiertos dejaría el problema clavado. Quedan
acá para que se decidan.

🔴 **La máquina de estados tiene una segunda puerta.** El comentario de la
migración dice que «las transiciones de estado pasan por RPC», pero nada lo
obliga: hay `grant update on bug_reports to authenticated` más la policy
`bug_reports_admin_update`. Medido contra el mismo Postgres: un admin corre
`update bug_reports set state = 'resuelto'` y el bug pasa de `nuevo` a
`resuelto` **de un salto, sin renglón de timeline y sin `resolved_at`**; y de
`resuelto` vuelve a `nuevo`, saltándose el guard terminal. No es una fuga —es
dentro de su propia empresa y sólo un admin—: es el expediente que deja de ser
fiel a lo que pasó. Cerrarlo es un trigger que rechace el UPDATE de `state`
fuera de la RPC.

`anon` puede EJECUTAR `next_bug_folio`. Las otras dos RPC llevan su
`revoke … from public, anon`; ésta no, y en Postgres las funciones nacen con
EXECUTE para PUBLIC. El guard interno la salva —sin `auth.uid()` no hay
membresía y levanta «No autorizado»— pero es la única capa.

Y una tercera, que no es de seguridad: las excepciones de las dos RPC están
escritas en **voseo** («Necesitás estar autenticado», «No pertenecés al tenant
del bug»). Es texto que puede llegar a la pantalla y rompe la regla de
español venezolano del repo.

## Verificación

**156 contratos SQL** en verde (eran 121). Cada guard validado por mutación:

| Migración | Contratos | Mutaciones probadas | Detectadas |
|---|---|---|---|
| 0128 sales_order_invoicing_hardening | 9 | 5 | 5 |
| 0102 capa_legal | 7 | 7 | 7 |
| 0024 dispatch_core | 6 | 5 | 5 |
| 0123 rendiciones | 7 | 8 | 8 |
| 0093 comments_hardening | 6 | 7 | 7 |
| 0114 financiero_china | 8 | 10 | 10 |
| 0115 partner_statements | 8 | 10 | 10 |
| 0070+0072 operario_action | 8 | 8 | 8 |
| 0012 rls_perf_and_rpc_guards | 7 | 7 | 7 |
| 0098 fidelizacion_referidos | 6 | 8 | 8 |
| 0152+0153 client_claims | 6 | 11 | 11 |
| 0147 supplier_packing_uploads | 8 | 9 | 9 |
| 0179 nomina_settlements | 8 | 12 | 12 |
| 0236 supplier_scorecard | 7 | 13 | 13 |
| 0022+0183 receipt_photos | 10 | 17 | 17 |
| 0028+0039 bug_reporter | 11 | 24 | 24 |

**161 mutaciones, 161 detectadas.**

Dos precisiones sobre qué reporta cada mutación, porque «detectada» no siempre
quiere decir «la detectó el contrato que la nombra»:

- En `0123`, quitar el guard de la transición lo atrapa el **contrato 5** («una
  rendición ANULADA volvió a emitida»), no el 2. El 2 sí puede caerse: con los
  **dos** guards del UPDATE apagados grita, verificado aparte. Ningún contrato
  de este archivo es decoración.
- En `0093`, los contratos **1 y 2 comparten guard**. Cualquier mutación que
  rompa el 2 rompe también el 1, que corre primero y es el que reporta.

Y dos contratos que **salían verdes con su protección arrancada**, detectados
por la mutación y reescritos:

- 🔴 En `0114`, «no se borra un proveedor con movimientos». El proveedor está
  protegido **por partida doble**: sus cargos lo sujetan y a sus cargos los
  sujetan las notas de crédito. Al soltar su FK el borrado seguía bloqueado, así
  que el contrato medía la protección de al lado. Reescrito con un proveedor que
  sólo tiene cuenta corriente.
- 🔴 En `0115`, el CHECK del vocabulario de conciliación. El fixture usaba el
  estado de cuenta de **otro tenant**, así que la fila la rechazaba el trigger
  cross-tenant y no el CHECK. En Postgres los BEFORE triggers corren **antes**
  que los CHECK y ambos levantan `check_violation`: son indistinguibles desde el
  `exception when`. Para probar un CHECK no puede haber nada más que pueda
  rechazar esa fila.

- 🔴 En `0070`/`0072`, «un operario inactivo no puede operar». El inactivo
  editaba la recepción de OTRO, así que lo frenaba el guard de «sólo tu
  recepción». Reescrito con una recepción propia.
- 🔴 Y en el mismo archivo, «no se re-escanea una caja». La afirmación comparaba
  timestamps, pero **`now()` en Postgres es la hora de la TRANSACCIÓN, no del
  reloj**: un re-escaneo escribía el mismo valor y el contrato pasaba con el
  guard arrancado. Se antedata la marca antes de intentar el segundo escaneo.

- 🔴 En `0098`, «el correlativo no se comparte entre tenants». Cada tenant
  tenía **un solo** código, así que filtrar o no filtrar daba el mismo número:
  los dos iban por el 0002. El fixture no distinguía las dos hipótesis. Se
  desempata dejando los contadores en números distintos.

- 🔴 En `0152`, «`evaluated_at` no se re-sella». El escenario antedataba la
  marca con un UPDATE… que **también pasa por el trigger**, así que la propia
  mutación que se quería detectar deshacía el antedatado al vuelo y el contrato
  salía verde. Se arma el escenario con el trigger **apagado**
  (`disable trigger`) y se lo vuelve a encender antes de medir.

- 🔴 En `0147`, «una sola versión vigente». Está sostenida por **dos** piezas —
  el índice único parcial y el `update is_current = false` de la RPC— y el
  escenario entraba sólo por la RPC. Se agregó un **INSERT directo**, que es lo
  que haría un cliente PostgREST saltándose la RPC, y es lo único que pone al
  índice a prueba solo.

- 🔴 En `0179`, «el egreso nunca antes del ingreso». El empleado ya tenía un
  finiquito vivo, así que el insert de prueba lo rechazaba **el índice de "uno
  solo vivo"** y no el guard de fechas: verde con ese guard arrancado. Se inserta
  como `anulado`, donde el índice no aplica y la única puerta que queda es la que
  se quiere probar.

- 🔴 En `0236` la mutación falló por partida doble, y ninguna fue del contrato.
  Primero **el arnés dio 13 de 13 «sin detectar»**: Docker se había caído, el
  runner hacía SKIP y devolvía **exit 0**, y mi detector leía ese 0 como «la
  mutación no se detectó». Trece contratos declarados decorados sin que ninguno
  lo estuviera. El arnés ahora exige **evidencia positiva de que la corrida
  midió algo** (`contrato(s) de SQL` presente y `SKIP` ausente) y aborta en vez
  de concluir. Y después quedó una **mutación que no mutaba**: quitarle el
  `where` al índice parcial no cambia nada, porque Postgres trata los NULL como
  distintos en un índice único; la que sí muta es `nulls not distinct`.

- 🔴 En `0022` la mutación más importante —**la 0183 revertida entera**— salió
  roja **por la razón equivocada**: mi reemplazo dejó un `do nothing` huérfano y
  el archivo ni siquiera compilaba. Un arnés que sólo mira el color habría
  contado eso como «detectada» sin que el contrato llegara a correr nunca. Es el
  espejo exacto de la mutación que no muta: ésta muta **de más**. Quitando la
  cláusula entera cae donde tiene que caer, en el contrato 8 y con su propia
  afirmación.

- 🔴 En `0028`, «no se pide el folio de una empresa ajena» salía **verde con el
  guard arrancado porque mi propio `raise` caía en mi propio `exception when`**:
  un `raise exception` de plpgsql sale con sqlstate **P0001**, el mismo que
  levanta la RPC, y mi handler lo tragaba como si fuera el rechazo esperado. Es
  la segunda vez esta spec que un contrato se cumple con algo que escribí yo
  —después de la de `0024`, que afirmaba sobre el texto del error— y la lección
  es la misma en otra forma: **el intento se aísla adentro, la afirmación va
  afuera.**
- ⚠️ Y en el mismo archivo, una mutación que era roja **por la razón
  equivocada**: al quitar el INSERT del timeline dejé colgando su `values`, la
  función no compiló, nada avanzó y lo atrapó el contrato 1. Rojo honesto que no
  probaba una sola línea del contrato 5. Se quita el statement entero.

**La regla que sale de las ocho:** si mutas *una sola* protección y el contrato
sigue verde, no es que la mutación falló — es que **hay otra pieza sosteniendo
el caso, el fixture no distingue las dos hipótesis, el guard mutado deshace el
escenario que lo iba a atrapar, o el escenario no entra por donde vive el guard
que se quiere probar**. En ninguno de los cuatro casos ese contrato mide lo que
dice medir.

**Y una regla aparte para el arnés, que falló dos veces (`0236` y `0022`):** el
color no es la medición. Un runner que se **saltó** la prueba sale 0 igual que
un verde, y un archivo que **no compila** sale ≠0 igual que un contrato que
atrapó la regresión. Antes de leer un resultado hay que exigir evidencia
positiva de que la prueba **corrió** y de que falló **por lo que se esperaba** —
el nombre del contrato en la salida, no sólo el exit code.

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

- **Que las otras 131 estén bien.** Se cubrieron 19 migraciones de 150 en 16 archivos de contrato. La lista rankeada
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

⚠️ **Corrección: la cabeza NO está cubierta, y el error fue de lectura mía.**
Al volver a mirar el ranking en vez de la línea que yo mismo había escrito la
vuelta anterior, aparece **`0028_bug_reporter` con 31 puntos** —
`rechaza (guard)×10`, `máquina de estados×7`, `permisos/rol×4`— sentada entre
`0102` (34) y las fotos (30). **Se saltó**: ninguna vuelta la nombró, y esta
spec llegó a afirmar que la cabeza quedaba cerrada. No queda: es la siguiente.

Y en el mismo movimiento se cae el otro dato que venía arrastrándose:
**`0090_comments` puntúa 17, no 30.** La vuelta anterior lo puso a la cabeza
por memoria, no por medición. Sigue sin contrato —la inmutabilidad de
`comments`, no la de las menciones; la 0093 sólo cubre lo suyo— pero está muy
por debajo de lo que decía.

`0028` ya quedó cubierta en esta misma vuelta, apenas se la volvió a medir.
Orden real de acá en adelante:

| Puntos | Migración | Por qué |
|---|---|---|
| 29 | `0097_documentos_hub` | dinero×3, aislamiento×5 |
| 29 | `0165_fiscal_books` | dinero×5, inmutabilidad×5, 9 guards |
| 29 | `0167_bank_reconciliation` | dinero×4, aislamiento×7 |
| 28 | `0021_operario_admin_rpcs` · `0214_bitacora` | aislamiento + guards |
| 17 | `0090_comments` | inmutabilidad×4, dinero×1 |

**La lección no es del ranking, es del método:** una lista rankeada sólo sirve
si se vuelve a leer. Yo la leí una vez, escribí «siguiente: X» en la spec, y
después seguí esa frase durante cuatro vueltas en lugar del archivo. Es la misma
falla que persigo en los contratos —confiar en lo que quedó escrito antes que en
lo medido— aplicada a mi propia bitácora.
