---
sdd: "0290"
title: "El cotizador FCL vuelve con tarifas propias — se desengancha de SeaRates"
status: in-progress
author: "Claude Code (ventana searates-aviso) + founder"
created: 2026-08-24
updated: 2026-08-24
supersedes: null
superseded_by: null
related: ["0291", "0095", "0092", "0164"]
confidencialidad: interna
---

# SDD-0290 — El cotizador FCL vuelve, con tarifas propias

> SeaRates cerró (SDD-0291) y `/fcl` se quedó mudo. Buscando reemplazo apareció que
> **el camino para publicar las tarifas FCL PROPIAS ya estaba construido entero y
> estaba huérfano.** Esta spec lo enchufa.

## 1. Lo que ya existía (medido el 2026-08-24)

| Pieza | Estado antes |
|---|---|
| `rates` con `service='fcl_directo'` | ✅ **2 filas vivas con `flat_rate`** en prod |
| RPC `public_fcl_rates()` (migr 0159, reescrita en 0256) | ✅ viva, `security definer`, **grant a anon** |
| `getPublicFclRoutes()` · `lib/public/rates-queries.ts` | ✅ código vivo |
| `lib/calc/fcl.ts` + su test | ✅ vivos |
| `components/FclCalculator.tsx` | 🔴 **cero importadores — huérfano** |
| Cron `rate-expiry-alert` (SDD-0164) | ✅ ya vigila el vencimiento de tarifas públicas |

Estaba apagado por dos bloqueos, ninguno de fondo:

1. **Nadie montaba el componente.** Su destino era `/calculadora-fcl`, que hace
   **301 a `/fcl`** — y `/fcl` montaba `CotizadorFletes`, el de SeaRates. La ruta
   del proveedor le ganó el lugar a la propia y ésta quedó colgando.
2. **Las 2 tarifas están `is_public = false`**, así que la RPC devuelve vacío.

## 2. Por qué la tarifa propia le gana al proveedor en ESTA ruta

Es el precio que DTD **puede sostener de verdad**, con tránsito y vigencia, en vez
de un índice de mercado. Sin cuota, sin suscripción y sin riesgo de que el
proveedor cierre — que es exactamente lo que acaba de pasar. El techo es la
**cobertura**: son 2 rutas, no 20, y ampliarla es cargar tarifas en
`/studio/tarifas`, no integrar a nadie.

## 3. El cambio

- **`/fcl` y `/fcl/embed`** montan `<FclCalculator routes={…} />` alimentado por
  `getPublicFclRoutes()`. Páginas `async` + **`revalidate = 300`**, el mismo ISR de
  `/tarifas`: publicar o cambiar una tarifa se refleja en minutos sin rebuild.
  El embed usa el MISMO ISR a propósito — si divergiera, el cliente vería dos
  precios distintos según por dónde entre.
- **Copy corregido.** La página prometía *"elige tu ciudad o puerto de origen"* y
  ofrecía 40'HC: eso describía el cotizador de SeaRates. El calculador propio elige
  **ruta publicada + cantidad de contenedores**. Dejar el copy viejo sería
  prometerle al cliente algo que la herramienta no hace.
- **Cron `searates-refresh` desprogramado** de `vercel.json`. No es cosmético: con
  `/fcl` ya desenganchado, cada lunes iba a llamar a una API muerta **y disparar el
  aviso de SDD-0291** por un proveedor que nadie usa. Eso es una falsa alarma
  semanal garantizada. El código del cron y del aviso **queda intacto**: sirve tal
  cual para el proveedor que lo reemplace.
- **`CotizadorFletes` marcado como RETIRADO** con un comentario que explica por qué
  no se borra: es la implementación de referencia para enchufar un proveedor nuevo.

## 4. El bloqueo que NO es técnico

Con `is_public = false` en las 2 tarifas, `/fcl` muestra el **estado vacío** del
calculador: *"Cotizamos tu contenedor completo… escríbenos"* con salida a WhatsApp.
**Es correcto y no es una pantalla rota** — pero tampoco muestra precio.

Publicar esas tarifas es **decisión comercial del founder**, no del agente: es
publicar tus precios. Se hace desde **`/studio/tarifas`** con el flag `is_public`,
sin tocar SQL. Las 2 rutas cargadas, vigentes hasta el **2026-12-31**:
`Guangzhou → La Guaira` (35 d) · `Shenzhen → Puerto Cabello` (38 d).

## 5. Pruebas

- `lib/calc/__tests__/fcl.test.ts` — el motor puro ya estaba cubierto; sin cambios.
- **`e2e/smoke.spec.ts` corregido.** El test de `/fcl` afirmaba
  `expect(page.locator("form")).toBeVisible()`, y **`FclCalculator` no usa
  `<form>`** — son selects sueltos en un div. Ese `<form>` era del cotizador viejo:
  el test estaba atado a la implementación, no al comportamiento.
  Ahora afirma el invariante que vale en los **dos** estados (con tarifas y sin
  ellas): título, la palabra "contenedor", y **una salida a WhatsApp visible**.
  No afirma que haya un precio, porque CI no controla qué está publicado en la base
  — afirmarlo sería un test que pasa o falla según el estado comercial.

## 6. Pendientes

- 🟡 **Publicar las 2 tarifas** (`is_public`) — decisión del founder.
- 🟡 **Ampliar la grilla**: 2 rutas cubren 2 de los 20 pares que cacheaba SeaRates.
  Se amplía cargando tarifas, no integrando proveedores.
- 🟢 **`ocean_rates`, `/api/public/ocean-rate` y `CotizadorFletes`** quedan sin
  consumidores pero **vivos a propósito**, como andamiaje del próximo proveedor.
  Si al 2026-12 no hay ninguno, se borran juntos.
- ⚠️ `checkSeaRates` en `/studio/debug` va a marcar **rojo** ("0 tarifas vivas").
  Es **verdad** —SeaRates está muerta—, no una falsa alarma. Se retira cuando se
  decida el reemplazo, junto con el resto del carril.
