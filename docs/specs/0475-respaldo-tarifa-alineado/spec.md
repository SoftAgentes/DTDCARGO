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

# DTD-0475 — El respaldo del calculador cotizaba 6,25% por debajo

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
decía $800: **6,25% por debajo** ante cualquier caída, en silencio.

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

Una constante y su comentario, más un test que ancle los tres valores espejo. **No**
se toca la tarifa del ERP, ni la RPC, ni la lógica de cálculo, ni la vigencia.

## Diseño

### El valor

`CONFIG.tarifaBaseCBM: 800` → **`850`**. Verificado contra producción el
2026-09-17: `public_cbm_rate` devuelve
`{ per_cbm: 850, min_charge: 50, valid_until: "2026-10-04" }`.

El comentario pasa a contar lo que pasó —con fechas y con el precedente de
`pesoIncluidoKg`— en vez de describir sólo el mecanismo. Un comentario que
explica el mecanismo no evitó el fallo dos veces; uno que cuenta que **ya falló**
tiene más posibilidades.

Se suma el aviso de la vigencia: la fila de $850 **vence el 2026-10-04**. A
partir del 5-oct la RPC devuelve null y el sitio cotizará con este 850, que será
correcto sólo si la tarifa sigue siendo 850.

### La red

[`__tests__/calculadora-respaldo-alineado.test.ts`](../../../__tests__/calculadora-respaldo-alineado.test.ts)
ancla `tarifaBaseCBM`, `pesoIncluidoKg` y `minimoFacturable`.

No puede comparar contra la DB —el CI corre sin credenciales, y por eso el paso
`migrations-applied` de `verify` sale SKIP—, así que hace lo único útil desde
ahí: **convierte un cambio silencioso en uno deliberado**. Hasta ahora los tests
usaban `CONFIG.tarifaBaseCBM` como referencia (`expect(cot.precioBase).toBe(1 *
CONFIG.tarifaBaseCBM)`), de modo que mover el número **no rompía nada** — que es
exactamente cómo se coló la desalineación las dos veces. Con este archivo,
cambiarlo obliga a pasar por acá y decir por qué.

El cuerpo del test dice qué hacer si sale rojo: comprobar el ERP y alinear el
código con eso, no cambiar el número esperado a ciegas.

## Lo que esto NO arregla

El respaldo sigue dependiendo de que alguien se acuerde. El arreglo de fondo
—**una alerta en el ERP cuando una tarifa pública esté por vencer**— es
**SDD-0164** y sigue pendiente; el propio comentario de `calculadora.ts` ya lo
citaba antes de este cambio. Mientras eso no exista, el modo de fallo está vivo:
este PR corrige la instancia, no la causa.

**Y hay una fecha en el calendario:** el 2026-10-04 vence la vigencia. Si nadie
renueva desde `/studio/tarifas`, el 5-oct el sitio pasa a cotizar con el respaldo
sin avisar. Esta vez coincidirá; la próxima depende otra vez de que alguien
mire.

## Nota sobre `pesoIncluidoKg`

El test lo ancla en **1.000**, que es el valor vigente del ERP y lo que este
respaldo tiene que espejar para no mover el precio ante una caída.

No confundir con la regla que se le **promete** al cliente en material público,
que son **500 kg/m³** porque los 1.000 son una excepción temporal (founder
2026-09-17, ver SDD-0474). Son dos cosas distintas a propósito: acá manda lo que
se factura; allá, lo que se promete. Si la excepción se retira, hay que bajar
**los dos**: el ERP y esta constante.
