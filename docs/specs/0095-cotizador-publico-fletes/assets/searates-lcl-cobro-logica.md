# Cómo cobra SeaRates el LCL — referencia para la calculadora DTD

> **Para qué es esto:** guardamos la lógica con que SeaRates cotiza **LCL** (carga
> suelta) como **referencia informativa** para cuando trabajemos la **calculadora
> propia de DTD** (el LCL nuestro, hoy en `/calculadora`) y el eventual merge con el
> cotizador de fletes. **NO se usa hoy** — el cotizador de SeaRates (SDD-0095) quedó
> **solo FCL**. Decisión founder (2026-06-20).

## 1. Qué cambia LCL vs FCL
- **FCL** = alquilas el contenedor entero (le dices el tipo: HC40, etc.).
- **LCL** = tu carga **comparte** contenedor con otros → hay que **consolidarla**.
  Por eso SeaRates en LCL **no pide contenedor**, pide **volumen (CBM) + peso**.

## 2. Regla de cobro: W/M (peso o medida, el mayor)
- Se cobra **por CBM o por tonelada — el que pese más**.
- Conversión estándar: **1 CBM = 1.000 kg** (peso volumétrico).
- Rango típico China→destino: **~45–160 USD/CBM** puerto a puerto.
- El LCL por CBM puede costar **hasta el doble** que el FCL equivalente (mano de obra de consolidar).

## 3. La consolidación = un CFS (Container Freight Station) en el puerto
- La carga llega al **almacén CFS del consolidador en el puerto de origen** (Shanghai, Shenzhen…),
  donde la **paletizan, miden, etiquetan y agrupan** con otras cargas (1–3 días).
- En **destino** se **des-consolida** en otro CFS.
- Fees típicos: **~$12–40/CBM origen** (consolidación) + **~$15–40/CBM destino** (desconsolidación + on-carriage).

## 4. Cómo lo DESGLOSA SeaRates en su cotización (lo clave)
SeaRates modela el viaje como una secuencia de **puntos** (`pointType`: **PORT, PLACE, AIRPORT**)
unidos por **tramos**, y separa el costo en dos tipos de tarifa (textual de su doc):

| Campo (API) | Definición (textual SeaRates) | En LCL representa… |
|---|---|---|
| `pointTariff` | *"Array of tariffs specific to the current point"* | Lo que pasa **EN** el puerto: **consolidación/CFS**, handling de terminal, documentación. |
| `routeTariff` | *"tariffs specific to the transportation from the current point to the next point"* | El **flete marítimo** (tramo puerto→puerto), por CBM. |
| `lumpsumTariff` | *"the total price for multiple points"* | Cargo a tanto alzado. |
| `loads` | *"Detailed information about the requested container weight or volume"* | Tu **CBM/peso** (dispara el W/M). |
| `pointTotal` / `routeTotal` | *"Total of all pointTariff / routeTariff"* | Suma de **manejo** vs suma de **flete** → `totalPrice` = ambos. |

**La fórmula de SeaRates para LCL:**
> `pointTariff` origen (consolidación CFS + handling) **+** `routeTariff` (flete marítimo por CBM)
> **+** `pointTariff` destino (desconsolidación) — todo sobre el **W/M** de la carga.

La "consolidación en un almacén en el puerto" **es el `pointTariff` del punto de origen** (tipo PORT).
Por eso el LCL **siempre arranca en un PUERTO con CFS**.

## 5. Para la calculadora DTD (futuro)
Si replicamos esto, la tarifa LCL no es un solo número: es **manejo (consolidación) + flete +
desconsolidación**, sobre CBM (W/M). Hoy nuestra calculadora usa el modelo `$/CBB` propio
(ver memoria `project_calculadora_rediseno`); este desglose sirve para afinarla o para mostrar
el detalle tipo SeaRates cuando se decida.

## Fuentes
- [SeaRates · LCL shipping](https://www.searates.com/about/lcl-less-container-load-international-freight-shipment)
- [Get Rates API · campos de respuesta (docs)](https://docs.searates.com/reference/logistics/get-rates)
- [LCL CBM pricing guide](https://suaidglobal.com/insights/lcl-shipping-rates/)
- [LCL shipping process (FreightAmigo)](https://www.freightamigo.com/en/blog/logistics/less-than-container-load-lcl-shipping-your-essential-guide-for-2026/)
