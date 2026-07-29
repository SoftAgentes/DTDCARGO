---
sdd: "0172"
title: "Portal — Nueva compra como asistente de 3 pasos"
status: in-progress
author: "Sam (founder) + Claude Code"
created: 2026-07-28
updated: 2026-07-28
supersedes: null
superseded_by: null
related: ["0057", "0096", "0098", "0169", "0170", "0171"]
confidencialidad: interno
---

# SDD-0172 — Portal · Nueva compra = asistente de 3 pasos

## 1. Decisión aprobada

Cerrar la **brecha 3 de la Fase 7 del Revestido** (la más cara del mapa): reemplazar
el formulario largo de `/portal/compras/nueva` por el asistente de 3 pasos que
diseñó el Norte (`_norte/portal/app.jsx` · `PortalNuevaCompra`, L3305-3953).

Tercera tanda de la Fase 7, después de SDD-0170 (brechas 1 y 2) y SDD-0171
(ganancias baratas). Queda pendiente sólo la brecha 4 (`StatementLedger`).

**Dos decisiones del founder tomadas antes de construir (2026-07-28):**

1. **Se sigue el Norte en el momento del registro.** La compra se crea al terminar
   el paso 1; los pasos 2 y 3 son *post-registro*. Esto obliga a aflojar la
   validación de creación (§3.2) y a agregar una acción de completado (§3.3).
2. **Se entrega por partes detrás de un flag.** `NEW_PURCHASE_WIZARD_LIVE` nace
   apagado y el formulario actual sigue atendiendo clientes reales hasta que los
   tres pasos estén verificados en el navegador.

## 2. Problema

`app/portal/(app)/compras/nueva/NewPurchaseForm.tsx` es **un formulario largo de
440 líneas** con un submit único y una pantalla de éxito (`PurchaseDone`). El Norte
pide otra cosa:

- **Barra de 3 pasos** con encuadre de beneficio, no de trámite ("Controla tus
  proveedores" / "Sigue tus compras" / "Trazabilidad a tu logística").
- **Panel lateral sticky "Así queda tu orden a DTD — en vivo"**, que arma en
  castellano la orden mientras el cliente escribe.
- **Servicios extra** con stepper de HOLD (2-10 compras) y acople HOLD↔re-empaque.
- **Paso 3 de handoff al proveedor**: link del Packing List + preview de la factura
  y de las etiquetas con QR.

Hoy el cliente llena todo a ciegas y recién al final ve un código. El Norte le
muestra la orden armándose y lo saca con el link para su proveedor en la mano.

## 3. Alcance

### 3.1 Los 3 pasos (Norte, textual)

| Paso | Título del Norte | Qué vive ahí | Cuándo |
|---|---|---|---|
| 1 | **Controla tus proveedores** | Combobox de proveedor + ficha del proveedor nuevo · modalidad de envío · servicios extra | **Registra la compra** al final |
| 2 | **Sigue tus compras** | Descripción, cajas, valor, tracking, adjuntos — todos **opcionales** | Post-registro |
| 3 | **Trazabilidad a tu logística** | Link del Packing List para el proveedor + preview factura/etiquetas | Post-registro |

Los encabezados internos del Norte son "Paso 2: Documentación" y "Paso 3:
Confirmación"; la barra usa los títulos de beneficio de la tabla. Se respetan
ambos tal como están.

### 3.2 Aflojar la validación de creación — `lib/studio/prealertas/types.ts`

`validatePrealertaInput()` hoy exige `description` no vacía y `boxes >= 1`. En el
Norte esos campos viven en el paso 2 y están marcados "· opcional". Se cambia a:

- `description` → opcional en creación (queda `null` si viene vacía).
- `boxes` → default `1` si no viene; si viene, se sigue validando entero ≥ 1.
- `estValueUsd`, `trackingCn` → sin cambios (ya eran opcionales).

**Fuera del asistente nada cambia:** el ERP y `/portal/proveedores` siguen
mandando los campos completos, y las validaciones de formato (entero, no
negativo) se mantienen intactas. Lo que se afloja es la *obligatoriedad*, no el
*formato*.

### 3.3 Acción de completado — `updatePrealertaDetalleAction`

Nueva server action en `app/portal/(app)/proveedores/actions.ts` que adjunta a una
prealerta ya creada: `description`, `boxes`, `estValueUsd`, `trackingCn` y los
documentos (`doc_packing`, `doc_factura`, `doc_fotos`). Reglas:

- **Sólo el dueño**: la prealerta tiene que pertenecer al `markbox` de la sesión.
- **Sólo mientras esté `anunciada`**: una vez que la carga llegó a bodega, el
  detalle lo manda el operario, no el cliente.
- Reusa el mismo camino de subida de documentos que `createPrealertaAction`.

### 3.4 UI — qué se reusa y qué es nuevo

**Se reusa (no se reescribe):**

- `PrealertaAddonPicker` / `PrealertaServiceVideo` (SDD-0098) para los 5 servicios.
- `ShareProviderButton` + `/p/[token]` (SDD-0096) para el link al proveedor.
- `/portal/compras/[code]/etiquetas` para las etiquetas.
- `ShippingModeNotice`, `FieldLabel`, `FileField`.

**Nuevo:**

- `PurchaseWizardSteps` — la barra de 3 pasos.
- `PurchaseOrderLive` — el panel sticky "Así queda tu orden a DTD — en vivo".
- `lib/portal/purchase-order-lines.ts` — helper **puro** que traduce
  (servicios elegidos + `holdCount` + `holdTie`) → las líneas en castellano de la
  orden. Es la pieza testeable del panel en vivo.

### 3.5 Servicios extra · los 5 del Norte ya calzan con prod

Verificado en `prealerta_addons` (prod, 2026-07-28): de los 7 códigos, **5 están
`is_active = true`** y son exactamente los 5 del Norte —
`verificacion` · `inspeccion_recepcion` · `reempaque_unificar` ·
`etiquetado_pieza` · `hold_consolidar`. `compactar` y `cotizar_medir` están
apagados. **No se toca el catálogo.**

`hold_count` y el acople HOLD↔re-empaque **no existen como columnas**: viajan
dentro de las notas de la solicitud (`prealerta_service_requests.notes`), que es
donde el Norte los pone ("Retengan mi carga… hasta que lleguen N compras en
total"). Cero migraciones en esta spec.

### 3.6 Videos de los servicios · no existen, no bloquean

`video_url` es `null` en las 7 filas de prod y en los DEFAULTS de código.
`PrealertaServiceVideo` ya maneja el caso `null` con el placeholder
"próximamente" — el mismo estado que el Norte dibuja en `vid: 'soon'`. Los videos
se enchufan después con un `UPDATE` a `prealerta_addons.video_url`, **sin deploy y
sin tocar este código**.

## 4. Fuera de alcance

- **Migraciones de base de datos.** Ninguna.
- **El catálogo de servicios** (`prealerta_addons`): se consume, no se edita.
- **Grabar los videos** de los 5 servicios (§3.6).
- **Brecha 4 de la Fase 7** (`StatementLedger` / estado de cuenta).
- **La ficha extendida del proveedor nuevo del Norte** (¿qué vende? · ¿de dónde lo
  sacaste? · ¿ya le habías comprado? · método de comunicación). El Norte la pide en
  el paso 1 pero producción hoy sólo guarda nombre y WeChat; ampliar el modelo de
  proveedor es su propio trabajo. **Se deja anotado como deuda de la Fase 7.**

## 5. Verificación

- `node scripts/verify.mjs` en verde.
- Tests unitarios de `purchase-order-lines.ts` (líneas de HOLD 2 vs N, acople
  HOLD↔re-empaque, orden de las líneas) y de la validación aflojada de §3.2
  (descripción vacía crea; cajas ausente → 1; cajas `0` o `1.5` siguen fallando).
- Test de autorización de `updatePrealertaDetalleAction` (dueño ajeno → rechazo;
  prealerta ya no `anunciada` → rechazo).
- **Verificación visual medida, no mirada**: server levantado, portal en
  `data-portal-theme="dark"` (el default), contraste calculado con
  `getComputedStyle` + fórmula WCAG sobre los textos nuevos. Los tokens con nombre
  de color voltean en el portal oscuro — sobre relleno wine va
  `--color-on-accent`, nunca `text-white`.
- `/ui-check` antes del commit.

## 6. Bitácora

- **2026-07-28** — spec abierta. Decisiones 1 y 2 del founder tomadas antes de
  escribir código. Verificado contra prod: los 5 servicios activos calzan con el
  Norte y no hay videos cargados.
- **2026-07-28** — los 3 pasos construidos detrás del flag. `verify.mjs` verde.
  **Falta lo único que queda: prender `NEW_PURCHASE_WIZARD_LIVE`** cuando el
  founder lo pruebe con una cuenta demo.

  Lo que sólo apareció **midiendo en el navegador**, no en los 377 tests:
  1. dos clics rápidos en "+" del HOLD sumaban uno solo (closure viejo);
  2. con el acople puesto se podía destildar Re-Empaque y el panel lo seguía
     pidiendo;
  3. el re-empaque arrastrado podía no viajar en el form → la fila nunca le
     habría llegado a DTD;
  4. dos textos del preview de etiqueta a 4.24:1 (bajo AA).

  **Desvíos deliberados del Norte**, los dos por contraste:
  - la barra de pasos NO usa `opacity: .4` en los inactivos (ahí el texto no
    llega a AA); usa jerarquía por token, 9.03:1 medido;
  - el preview de la etiqueta **no dibuja un QR falso** (el Norte sí): un código
    que no resuelve invita a escanearlo. Va un recuadro rotulado "QR" y el CTA
    manda a la página de etiquetas reales.

  **Hallazgo preexistente reportado, NO tocado:** el badge "Próximamente" del
  envío aéreo (`ShippingModeNotice`, SDD-0098) mide **3.64:1**. Vive en 3
  pantallas más; arreglarlo es su propio trabajo.
