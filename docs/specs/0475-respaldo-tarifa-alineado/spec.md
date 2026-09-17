---
sdd: "0475"
title: "El respaldo del calculador vuelve a espejar el ERP ($800 → $850)"
status: done
author: "Claude Code (hallazgo) + Director + founder"
created: 2026-09-17
updated: 2026-09-17
supersedes: null
superseded_by: null
related: ["0474", "0164", "0336"]
confidencialidad: interno
---

# DTD-0475 — El respaldo del calculador cotizaba 5,88% por debajo

> `CONFIG.tarifaBaseCBM` llevaba 13 días en $800 mientras el ERP cobraba $850.
> No es una decisión: la migración que subió la tarifa avisaba que había que
> subir también la constante, y nadie lo hizo. Ante una caída de Supabase el
> sitio habría cotizado por debajo del precio real, sin error visible.

## Contexto

El calculador público (`/tarifas`, `/cotizador`, el FAB del portal y ahora la
guía de Alibaba) lee la tarifa de la RPC `public_cbm_rate()`. Esa RPC filtra por
`valid_until >= current_date`: **el día que la vigencia vence, no devuelve nada**
y el sitio cae a `CONFIG.tarifaBaseCBM` en
[`lib/calculadora.ts`](../../../lib/calculadora.ts) — sin log, sin error y sin
avisarle a nadie. El respaldo sólo es inocuo mientras coincida con el ERP.

`supabase/migrations/0336_rate_ddp_850_septiembre_2026.sql` subió la tarifa
pública a **$850** con `pg_cron` el **2026-09-04**, y su cabecera lo dejó escrito
(líneas 20-23):

> ⚠️ EL RESPALDO DEL CÓDIGO QUEDA DESALINEADO EL 4-SEP. `CONFIG.tarifaBaseCBM`
> en lib/calculadora.ts sigue en 800 a propósito (hoy es el valor correcto).
> **El 4-sep hay que subirlo a 850 en un deploy**, o una caída de Supabase
> [cotiza por debajo].

No se hizo. Entre el 2026-09-04 y el 2026-09-17 el ERP cobró $850 y el respaldo
decía $800: **5,88% por debajo** ante cualquier caída, en silencio (50/850 — el
6,25% es 50/800, o sea cuánto hay que SUBIR, que no es lo mismo).

**No es la primera vez.** El mismo patrón le había pasado a `pesoIncluidoKg`: el
ERP tenía 1.000 kg desde el 2026-07-06 y el código seguía en 500, así que una
caída habría cobrado excedente al doble de clientes. Se corrigió el 2026-08-05.
Dos constantes, el mismo modo de fallo, en dos meses.

### Cómo se encontró

Salió de lado, revisando SDD-0474 (la guía de Alibaba lee la tarifa del ERP por
un endpoint nuevo). En el primer informe se reportó como *«desalineado a
propósito, es una decisión con dueño»* — **lectura incompleta**: la cabecera de
la 0336 dice «a propósito **(hoy es el valor correcto)**» y sigue con la orden de
subirlo el 4-sep. El Director (sesión `dtdcargo-18`) leyó la migración entera,
levantó el segundo aviso y lo verificó contra producción.

## Alcance

Una constante y su comentario, más un test que ancle los **cuatro** valores espejo. **No**
se toca la tarifa del ERP, ni la RPC, ni la lógica de cálculo, ni la vigencia.

## Diseño

### El valor

`CONFIG.tarifaBaseCBM: 800` → **`850`**. Verificado contra producción el
2026-09-17: `public_cbm_rate` devuelve
`{ per_cbm: 850, min_charge: 50, valid_until: "2026-11-29" }` (tras la corrección
de la fila; ver más abajo).

El comentario pasa a contar lo que pasó —con fechas y con el precedente de
`pesoIncluidoKg`— en vez de describir sólo el mecanismo. Un comentario que
explica el mecanismo no evitó el fallo dos veces; uno que cuenta que **ya falló**
tiene más posibilidades.

Se suma el aviso de la vigencia: al vencer la fila, la RPC devuelve null y el
sitio cotiza con esta constante — que será correcta sólo mientras la tarifa siga
siendo $850.

### La red

[`__tests__/calculadora-respaldo-alineado.test.ts`](../../../__tests__/calculadora-respaldo-alineado.test.ts)
ancla `tarifaBaseCBM`, `pesoIncluidoKg` y `minimoFacturable`.

No puede comparar contra la DB —el CI corre sin credenciales, y por eso el paso
`migrations-applied` de `verify` sale SKIP—, así que ancla los números con su
procedencia al lado.

**Corrección de lo que se reportó primero.** Se dijo que los tests usaban
`CONFIG.tarifaBaseCBM` como referencia y que por eso mover el número «no rompía
nada». **Es falso**: subir la constante puso **20 aserciones en rojo** en
`calculadora.test.ts` y `calculadora-minimo-en-cajas.test.ts`, que están escritas
con literales y su aritmética a la vista (`// 0.3 × 850`). Esa red existía.

Entonces la pregunta real es otra: **¿cómo se coló la desalineación, si había
tests?** Porque los tests protegen contra un cambio accidental del código, no
contra que el ERP cambie y el código se quede quieto. Nadie tocó la constante —
ése es el modo de fallo, y ningún test del repo lo ve sin acceso a la DB.

Lo que este archivo aporta, entonces, no es «la red que faltaba» sino **dejar
escrito cuál es el valor del ERP y de dónde salió**, para que una revisión futura
tenga contra qué contrastar. Los 20 valores derivados se actualizaron literal por
literal, con la aritmética recalculada en cada comentario.

El cuerpo del test dice qué hacer si sale rojo: comprobar el ERP y alinear el
código con eso, no cambiar el número esperado a ciegas.

## Lo que esto NO arregla

**La alerta de vencimiento SÍ existe y está activa** — `app/api/cron/rate-expiry-alert`
(SDD-0164, migr 0257), programada en `vercel.json`, avisa por Telegram y email
cuando una tarifa pública está por vencer o venció. El comentario de `CONFIG` la
llamaba «pendiente»; queda corregido.

Pero **cubre el vencimiento, no el cambio de precio**. El 4 de septiembre no
venció nada: cambió el precio, y de eso no avisa nadie. Ésa es la grieta que
queda abierta, y ningún test del repo puede cerrarla sin acceso a la DB: haría
falta comparar el respaldo contra el ERP en cada corrida.

### Por qué NO hay test de vigencia

Se llegó a escribir uno. El founder lo descartó con otro criterio (2026-09-17):

> «Aunque la tarifa se venza o esté vencida, se mantiene el precio anterior. Lo
> que vamos a leer aquí es la base de datos. Ya el tema de si se actualiza o no
> se actualiza es un tema del back-end, no tuyo.»

El vencimiento no debe ser un evento que rompa nada, así que un test que bloquea
el CI por una fecha va en contra. Queda la decisión escrita en el propio archivo,
con su cita, para que nadie lo reescriba sin saber que ya se descartó.

**Pero su frase describe algo que hoy el sistema no hace.** La RPC filtra por
`valid_until is null or valid_until >= current_date`: al vencer devuelve null, y
el sitio no cae «al precio anterior de la base» sino a `CONFIG.tarifaBaseCBM`.
Que hoy el resultado sea correcto lo produce este mismo PR —respaldo y tarifa
valen igual—, no el diseño. Para que sea cierto por diseño, la lectura no puede
depender de la vigencia: eso es **backend**, y queda fuera de este alcance.

### El susto del 5 de octubre, y por qué ya no es el argumento

La fila tenía cargado `valid_until = 2026-10-04` cuando la tarifa valía hasta el
**2026-11-29**: cortaba casi dos meses antes de tiempo. El 5 de octubre la RPC
habría dejado de responder con la tarifa vigente y el sitio habría cotizado con
el respaldo — $800 sin este PR, es decir **5,88% por debajo durante dos meses**.

**Esa grieta se cerró en el dato el 2026-09-17**: el Director corrigió
`valid_until` a `2026-11-29` en producción, con autorización del founder,
preflight y postflight. Verificado de forma independiente contra
`dtdcargo.com/api/public/cbm-rate`, que devuelve `valid_until: "2026-11-29"`.

Así que **este PR ya no es la red que evita cobrar de menos en octubre**. Lo que
justifica el cambio es lo de siempre y sigue en pie: **si Supabase se cae hoy, el
sitio cotiza 5,88% por debajo**, y el respaldo tiene que espejar al ERP.

## Nota sobre `pesoIncluidoKg`

El test lo ancla en **1.000**, que es el valor vigente del ERP y lo que este
respaldo tiene que espejar para no mover el precio ante una caída.

No confundir con la regla que se le **promete** al cliente en material público,
que son **500 kg/m³** porque los 1.000 son una excepción temporal (founder
2026-09-17, ver SDD-0474). Son dos cosas distintas a propósito: acá manda lo que
se factura; allá, lo que se promete. Si la excepción se retira, hay que bajar
**los dos**: el ERP y esta constante.
