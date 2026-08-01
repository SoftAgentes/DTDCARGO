# Benito Transporte Express, C.A — proveedor n.º 1 del transporte nacional

**Estado:** 🟢 **negociación cerrada** · tarifario confirmado por escrito el
**31-jul-2026** · sembrado en el sistema el 1-ago-2026 (SDD-0237).

> Reemplaza a `benitez-rm.md`, que mezclaba tres razones sociales y cotizaba un
> **% ad valorem que está muerto**. Ese modelo no se volvió a considerar.

## Identidad

| Campo | Valor |
|---|---|
| Razón social | **BENITO TRANSPORTE EXPRESS, C.A** (*Transporte*, singular) |
| RIF | **J-50266334-7** |
| Quién firmó | **Mariotsy Mendoza**, Gerente General |
| Cuándo | 31-jul-2026, formulario de confirmación |
| Salidas desde | Valencia |

⚠️ El nombre correcto es **Transporte** en singular. En el material viejo aparece
como "Transportes Benítez" y "Transportes y Encomiendas R&M": son otros nombres
que circularon en la misma negociación y **no** son con quien se factura.

## La tarifa

**Un solo eje: el metro cúbico.** Murió el % ad valorem, murió el USD/kg, murió
el pie cúbico como unidad operativa y murió el recargo por kilómetro.

| Tramo | Costo (Benito) | Venta (DTD) | Diferencia |
|---|---:|---:|---:|
| **Centro** | $70,00 | **$105,94** | $35,94 |
| **Foráneo** | $80,00 | **$123,60** | $43,60 |
| **Remota** | $80,00 | **$176,57** | $96,57 |

**De dónde sale cada columna.** El costo es lo que confirmaron por escrito. La
venta es lo que ofrecieron en la **primera** negociación, cotizada en pie cúbico
($3,00 · $3,50 · $5,00) y convertida con `1 m³ = 35,3147 ft³`.

⚠️ **La venta NO se deriva del costo por un porcentaje.** El mercado cotiza
~$3/ft³ ≈ $105/CBM, así que el $70 puede ser un error de ellos. Vendiendo a la
tabla vieja, si mañana el costo sube a lo que cotiza el mercado, **DTD no
pierde**. Es un seguro, no un margen — y reemplaza la regla del 30% que se había
fijado antes. Cualquier intento de recalcular la venta como `costo × (1 + margen)`
rompe la decisión del founder (SDD-0236).

## Cobertura

**175 destinos** en la tabla firmada: **166 cubiertos** + **9 sin cobertura**.

| Tramo | Destinos | Zonas |
|---|---:|---|
| Centro | 46 | Carabobo · Yaracuy · Aragua · Miranda · Caracas · Vargas · Lara |
| Foráneo | 117 | Llano Occidente · Los Andes · Occidente · Oriente Costa · Oriente Llano |
| Remota | 3 | Margarita · Carúpano · Tucupita |

**Los 9 sin cobertura — nunca cotizarlos:** Cariaco · El Callao · El Manteco ·
El Dorado · KM 88 · Santa Elena de Uairén · El Pilar · Güiria · Cumanacoa.

Los **"NO" del tabulador viejo están vencidos**: Temblador, Caripito, Caripe y
Tucupita **sí** los cubren, cada 15 días.

## Condiciones confirmadas por escrito

- **NO hay mínimo por despacho** — *"no aplica al método de cobro utilizado"*.
- **NO se cobra nada aparte**: ni seguro, ni IVA, ni manejo, ni estiba, ni
  entrega a domicilio. El $70/$80 es el costo final.
- **Pago:** efectivo en dólares, se cancela **todos los viernes**.
- **Vigencia:** hasta nuevo aviso, con **1 semana de aviso previo** si sube.
- **«Varía según la consolidez de la carga»** significa que puede salir **MÁS**
  de una vez, no menos. Que no salga en la semana es *"un caso muy extremo, rara
  vez se presenta"* y avisan. Deja de ser un riesgo para prometerle tiempos al
  cliente en Oriente y Bolívar.
- **Prueba de entrega, las dos vías:** *"Tenemos un personal un poco arcaico, por
  los momentos lo podemos manejar con nota de despacho en físico y también por la
  aplicación para que se vayan adaptando."*

## Frecuencia de despacho

**15 destinos salen cada 15 días** y por eso la calculadora le avisa al cliente
que pueden tardar hasta una semana más: Camatagua · Guasdualito · Libertad ·
Sabaneta · El Nula · El Venado · Machiques · La Villa (Zulia) · Dabajuro ·
Pariaguán · Temblador · Caripito · Caripe · Guasipati · Tucupita.

> **Decisión del founder (1-ago-2026):** manda el **formulario firmado** sobre el
> PDF de despachos quincenales. El PDF lista 22 destinos y omite cuatro que el
> formulario sí marca como quincenales; ante la discrepancia gana el documento
> que Mariotsy firmó.

## Cómo entró al sistema

- **Modelo de datos:** SDD-0236 · migración `0330_freight_carriers_tariffs.sql`
  (aplicada a prod el 1-ago-2026).
- **Siembra del tarifario:** SDD-0237 · migración
  `0332_seed_tarifario_benito.sql`.
- **Dónde se edita sin deploy:** `/studio/admin` › Calculadora pública ›
  **Transportistas**.
- **Qué ve la web pública:** sólo `city_slug · precio de VENTA · mínimo ·
  frecuencia · tránsito`, vía la RPC anon `public_carrier_tariffs()`. **Nunca**
  el costo, ni el nombre del transportista, ni su RIF, ni lo que ofrecieron los
  demás proveedores.

### Ajustes de nombre al sembrar

| En el formulario de Benito | En el sistema | Por qué |
|---|---|---|
| Catia | `caracas` | Es Caracas con otro nombre (founder) |
| La Villa (×2) | `la-villa-aragua` · `la-villa-zulia` | Dos ciudades distintas con precios distintos |
| Estado "Panamericana" | Zulia (5) · Trujillo (1) | Es un eje vial, no un estado |
| — | `naguanagua` · `san-diego` · `barquisimeto` | No tienen fila propia; el founder las dio por cubiertas |

## La zona sin costo (decisión de DTD, no de Benito)

En **8 ciudades el cliente paga $0 de entrega**: Valencia · Naguanagua ·
San Diego · Guacara · Maracay · Caracas · Barquisimeto · Acarigua.

**No es un descuento ni una tarifa en cero.** DTD sí le paga ese tramo a Benito;
lo asume como **adquisición de clientes**. Por eso la tarifa real de esas
ciudades sigue registrada en `carrier_tariffs` —el ERP no puede perder de vista
lo que cuesta— y lo que pone el cobro en cero de cara al cliente es
`calculator_cities.casco`.

> Founder, 1-ago-2026, sobre Barquisimeto: *"Barquisimeto queda en cero.
> Barquisimeto no lo cobramos."*

## Huecos y pendientes con Benito

- ✅ **Respaldo documental guardado** (1-ago-2026) en
  [`assets/`](assets/README.md): el **formulario de confirmación firmado por
  Mariotsy Mendoza** y la **tabla de 178 destinos** de la que salió la migración
  `0332`. ⚠️ El xlsx lleva el COSTO ($70/$80 por CBM) — está en git porque el
  repositorio es privado; las reglas que se derivan de eso están en el README de
  `assets/`. Siguen sin guardarse el TABULADOR y el CRONOGRAMA DE DESPACHO
  originales en PDF (ante discrepancia manda el formulario firmado, así que no
  bloquean nada).
- **El descuento por pagar en divisas.** En la reunión dijeron que existe; nunca
  lo cuantificaron y en el formulario no lo mencionaron. El founder lo quiere
  convertir en abono para el cliente.
- **El Excel del contenedor** que el founder prometió: un contenedor real
  separado por cliente, con totales de cajas, peso y CBM, y una columna libre
  para que ellos pongan el precio.
- **Comprobante de entrega.** Va impreso, uno por cliente, en carpeta. Lleva
  **"Entregar a"**, no "Cliente", porque quien recibe muchas veces no es el
  titular. Las cajas llevan solo el código, nunca el nombre. **No existe en el
  ERP** todavía.
- **Acceso de choferes a la PWA con código de 4 dígitos** (no nombre ni correo),
  una sola cuenta compartida para los choferes de Benito.
- **Sin confirmar con Mariotsy:** que Barquisimeto, Caracas, Naguanagua y San
  Diego estén cubiertas (el founder las dio por buenas), y el mapa de "ciudad
  cercana" de los 9 sin cobertura.
