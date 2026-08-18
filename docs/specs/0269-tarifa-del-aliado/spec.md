---
sdd: "0269"
title: "La tarifa del aliado: listas de precios por aliado, con descuento o tarifa propia"
status: in-progress
author: "Sam (founder) + Claude"
created: 2026-08-18
updated: 2026-08-18
supersedes: null
superseded_by: null
related: ["0008", "0011", "0055", "0164", "0255", "0258"]
confidencialidad: interno
---

# SDD-0269 — La tarifa del aliado

## 1. El problema

Desde SDD-0255 (migr 0362) el aliado **existe** en el ERP: tiene insignia propia,
jerarquía con sub-aliados, correlativo separado del de la casa y su ficha se
transforma al marcarlo. Lo que no existía era **la tarifa**.

La ficha de Dynasty Cargo mostraba:

> **Cobro:** Tarifa fija por CBM · *El monto se define aparte.*

Ese «aparte» no estaba en ningún lado. `rates` no tiene dimensión de cliente ni
de aliado —es un catálogo plano por servicio y ruta— así que la tarifa pactada
vivía, en el mejor de los casos, como texto libre en el campo «Acuerdo». Con esa
base:

- El cotizador sugería **siempre la tarifa de la casa**, así que un cliente de
  aliado se cotizaba a precio de calle y el vendedor tenía que corregir el
  número a mano en cada estimado — o no corregirlo.
- No había forma de saber, mirando el sistema, cuánto se le cobra a un aliado.
- Y no había nada que impidiera que la tarifa negociada con un aliado terminara
  publicada en la calculadora del sitio.

**Medido el 2026-08-18 en producción:** 2 aliados vivos (AG · Antonella
Guerrero y DC · Dynasty Cargo, los dos raíz), **0 clientes colgando de ellos**,
4 tarifas vivas, 17 estimados, 5 facturas. O sea: se construye **antes** de que
haya plata en juego, que es cuando sale barato.

## 2. La decisión

Una tarifa de aliado **es** una tarifa: mismas columnas, mismo vencimiento,
mismo importador CSV, mismo cron de aviso de vencimiento. Duplicarla en una
tabla `ally_rates` habría duplicado el módulo Tarifas entero.

Lo que se agrega es **una indirección**: la lista de precios.

```
price_books
├── «Tarifa DTD Cargo» · is_house   ← la de la casa: todo cliente directo,
│                                     y la ÚNICA que publica al sitio
├── «Tarifa Dynasty Cargo» → DC     ← descuento 12 % y/o tarifas propias
└── «Tarifa Antonella Guerrero» → AG
```

`rates` gana **una** columna (`price_book_id`) y quién usa cuál se decide en un
solo punto: `resolve_price_book(client_id)`.

### Las tres formas de pactar

| Forma | Cómo se guarda | Cuándo conviene |
|---|---|---|
| **Precio pactado** | `price_books.base_per_cbm` | ⭐ Cómo lo piensa el founder: *«con Dynasty tengo $690 el CBM»*. Un número, sin porcentaje y sin ruta. |
| **Descuento** | `price_books.discount_pct` | Cuando el acuerdo es relativo. Se mueve solo cuando la casa sube o baja el precio. |
| **Tarifa propia** | Filas de `rates` dentro de su lista | Cuando el precio cambia por ruta y hace falta el detalle. |

**Conviven, y el orden es explícito**, de lo más específico a lo más general:

1. **Tarifa propia** — una fila suya para esa ruta.
2. **Precio pactado** — el `base_per_cbm`.
3. **Descuento** — sobre la de la casa.
4. **La casa** — tal cual.

⚠️ **El precio pactado sólo entra donde el tramo se cobra POR CBM.** El FCL va
por contenedor, así que un $/CBM no tiene dónde aplicarse y ese tramo sigue con
el descuento o con la de la casa. La decisión NO se toma mirando el `service`
sino la **forma** de la tarifa de la casa (`per_cbm is not null`): el `service`
de la fila pública ya divergió una vez de lo que representaba (migr 0255).

La ficha del aliado **no describe** esto en prosa — lo **muestra como lista
ordenada** de lo que se le aplica y dónde. Con tres formas que conviven las
combinaciones son ocho, y un párrafo por combinación es imposible de mantener y
fácil de dejar mintiendo.

### La regla que se DICE en pantalla

El descuento se aplica a `per_cbm` y a `flat_rate`. **No** se aplica a
`min_charge`. El piso es un término comercial aparte —cuánto cuesta como mínimo
mover un envío— y no el precio; bajarlo en silencio sería regalarle a un aliado
un mínimo que nadie pactó. La ficha del aliado y la línea de sugerencia del
cotizador lo dicen con todas las letras. Una regla que no se ve es una trampa.

### La tarifa se pacta con el aliado RAÍZ

Decisión del founder, ya establecida en SDD-0255: FA no factura con DTD, a FA le
factura Dynasty Cargo. Por eso una lista sólo cuelga de un aliado raíz, y
`resolve_price_book()` sube por `parent_aliado_id` hasta la raíz antes de
buscar. **Un cliente de FA cotiza con la tarifa de DC.**

## 3. Lo que se construyó

### Base de datos — migr `0382_price_books.sql` y `0384_price_book_valor_pactado.sql`

- Tabla `price_books` con RLS por tenant.
- `rates.price_book_id`, **nullable con backfill y relleno automático**. No es
  `not null` a propósito: eso haría fallar todo `insert` de código ya desplegado
  que no conoce la columna — el mismo orden código↔migración que ya rompió
  producción una vez (ver `lib/studio/rate-queries.ts:19-28`). El trigger
  `rates_guard_price_book_t` rellena con la lista de la casa, así que NULL nunca
  queda guardado.
- `resolve_price_book(client_id)` — con derechos del **invocante**, no
  `security definer`: lee tres tablas que ya tienen RLS por tenant, así que un
  id ajeno devuelve NULL solo. Un definer acá sería regalar un oráculo.
- Cuatro candados: la pública sólo de la casa · una lista sólo en aliado raíz ·
  una sola lista de la casa por tenant · una sola lista por aliado.
- **0384** agrega `base_per_cbm` (nullable, `> 0`). Es una columna y no una fila
  de `rates` porque una fila exige servicio + origen + destino, y el acuerdo con
  un aliado **no tiene ruta**: es el precio de su carga, venga de donde venga.
  Pedirle al founder que invente un destino para guardar un número sería
  obligarlo a mentirle al catálogo — y ese destino inventado después competiría
  en el ILIKE con los de verdad.

### Aplicación

| Archivo | Qué hace |
|---|---|
| `lib/studio/price-books/price-book-types.ts` | `aplicarDescuento` (la regla del piso vive acá), validadores, formato |
| `lib/studio/price-books/price-book-queries.ts` | `resolveRateForClient` — el precio que le toca a ESTE cliente |
| `app/studio/(app)/clientes/_components/AliadoTarifaPanel.tsx` | La tarifa deja de ser prosa: se pacta desde la ficha |
| `app/studio/(app)/tarifas/**` | Selector de lista de precios; una tarifa nace en la lista que se esté viendo |
| `app/studio/(app)/cotizador/**` | El estimado sugiere el precio del cliente, y dice de dónde salió |

La línea de sugerencia del cotizador cambia de color (verde → azul) cuando el
precio no es el de la casa, y explica por qué: *«Tarifa Dynasty Cargo · 12 %
sobre la de la casa · el piso de $50 no lleva descuento»*. Sin eso, el vendedor
ve un número distinto al del catálogo y no sabe si es un error.

`quotes.rate_used_id` sigue apuntando a la **fila real** de `rates` que se usó —
la de la casa cuando el precio salió de un descuento. El importe ya descontado
va en `rate_per_cbm`. El estimado no pierde trazabilidad.

## 4. Verificación

### Contratos SQL — `supabase/tests/0382_price_books.test.sql`

11 contratos, escenario con dos tenants, DC raíz, FA colgando de DC, AG raíz sin
lista, y cuatro clientes (directo, de DC, de FA, de AG).

### Mutaciones corridas

Un contrato verde que sigue verde con la protección apagada es decorado. Cada
candado se rompió a propósito:

| # | Mutación | Resultado |
|---|---|---|
| M1 | La pública deja de ser sólo de la casa | rojo ✓ |
| M2 | Una lista puede colgar de un sub-aliado | rojo ✓ |
| M3 | `resolve_price_book` deja de subir hasta la raíz | rojo ✓ |
| M4 | Una tarifa nueva puede quedarse sin lista | rojo ✓ |
| M5 | Dos listas de la casa por tenant | rojo ✓ |
| M6 | Un aliado con lista propia pasa a colgar de otro | rojo ✓ |
| M7 | El backfill no mueve las tarifas que ya existían | rojo ✓ |

⚠️ **M6 salió verde en el primer intento y el error era de la mutación, no del
contrato:** renombrar un trigger no lo apaga — sigue colgado de la misma tabla
con la misma función. Se corrigió apagando la condición del cuerpo, que es el
candado real, y entonces sí se puso rojo. Queda escrito porque es la forma más
fácil de creerse una cobertura que no existe.

Del lado TypeScript, otras cuatro:

| # | Mutación | Resultado |
|---|---|---|
| M1 | El descuento también baja el piso | rojo ✓ |
| M2 | `rate_used_id` apunta a un id inventado | rojo ✓ |
| M3 | La tarifa propia pierde prioridad sobre el descuento | rojo ✓ |
| M4 | Un descuento de 0 % se acepta | rojo ✓ |

Y seis más sobre el precio pactado (migr 0384):

| # | Mutación | Resultado |
|---|---|---|
| M1 | El precio pactado pierde prioridad frente al descuento | rojo ✓ |
| M2 | El $/CBM pactado se aplica también donde se cobra por contenedor | rojo ✓ |
| M3 | El precio pactado también pisa el piso | rojo ✓ |
| M4 | La tarifa propia deja de mandar sobre el pactado | rojo ✓ |
| M5 | Un precio pactado de $0 se acepta | rojo ✓ |
| M6 | `rate_used_id` deja de apuntar a la tarifa real de la casa | rojo ✓ |

Más dos en SQL: el `check` de positivo apagado, y la columna naciendo con un
precio por default. Las dos rojas.

### Degradación medida

Las tres pantallas cargan la lista con `try/catch`: con la migr 0382 **sin
aplicar**, `/studio/tarifas`, la ficha del cliente y el cotizador se comportan
exactamente como antes de existir las listas. `next build` en verde contra una
base donde `price_books` todavía no existe.

## 5. Lo que NO entra

- **La cuenta del aliado** (qué le debe a DTD y por qué). Necesita atribución
  envío→aliado y un libro; es otro SDD y depende de una decisión de cobro que
  el founder todavía no tomó.
- **`invoices` no gana vínculo con el aliado.** Se factura al aliado como al
  cliente que es. Cambiar eso es parte de la cuenta, no de la tarifa.
- **Asignar una lista a un cliente suelto o a un segmento.** El modelo lo
  soporta (una lista sin `aliado_id` y sin `is_house` es legal) pero no hay
  pantalla: construir la dimensión antes de que exista el caso es cómo
  `advisor_id` lleva meses con UI completa y 100 % NULL.
- **Historial de precios pactados.** Hoy editar el descuento lo pisa. Las
  vigencias por fecha ya existen a nivel de `rates` (`valid_from`/`valid_until`);
  para el descuento harían falta filas con vigencia, y todavía no hace falta.

## 6. Lo que hay que decidir

1. **El número.** Ni el precio pactado ni el descuento de Dynasty Cargo y
   Antonella Guerrero los sabe el sistema. La pantalla está lista; falta el dato.
2. **Si el descuento debe tocar el piso.** Hoy no lo toca, y así está escrito en
   pantalla. Es reversible con una línea.
