---
sdd: "0627"
title: "Seguimiento estimado: ETA desde el zarpe y avisos por hito"
status: in-progress
author: "Claude"
created: 2026-11-13
updated: 2026-11-13
supersedes: null
superseded_by: null
related: ["0047", "0101", "0132", "0156", "0514", "0530", "0543"]
confidencialidad: interno
---

# SDD-0627 — Seguimiento estimado: ETA desde el zarpe y avisos por hito

> Cuando el envío zarpa, el Portal estima la fecha de cada etapa que falta (llegada a puerto,
> aduana, bodega en Venezuela, entrega) con los días de tránsito del zarpe, y las muestra en el
> stepper rotuladas «Est.». Los avisos al cliente por hito (`carga_en_camino` al zarpar y las
> reglas ancladas en ETA con la ETA estimada) quedan escritos y **apagados** detrás de
> `AVISOS_POR_HITO_LIVE`, con un ensayo en seco que sólo cuenta destinatarios. **Sin migración.**

## Pedido de Sam

Decisión de Sam del 2026-11-13, literal: «cuando salga el envío, estimamos los tiempos y sobre eso
le vamos avisando al cliente». Fase F3b del Subdirector «Portal del cliente». El rastreo en vivo de
la naviera no es prioridad (el reemplazo de SeaRates lo lleva otra sesión).

## Diagnóstico: lo que ya existía

Medido sobre `main` = `11f90a32e`.

- **Zarpe con fecha.** La 0477 (SDD-0530) pasa el contenedor a «zarpado» y, en la misma
  transacción, avanza sus envíos a `shipped` e inserta su `shipment_events`. El primer evento
  `shipped` de un envío es la fecha del zarpe. Que la 0477 esté aplicada en producción: no medido
  (no se leyó producción).
- **Días de tránsito por ruta.** `sailings.transit_days int` (0096), con `pol`, `pod`, `etd` y
  `eta`, por zarpe. Es lo que sirve: está atado al contenedor (`consolidations.sailing_id`).
  `carrier_tariffs.transit_days` (0330) es texto libre de tarifas terrestres («24 a 72 horas») y
  `rates.transit_days` (0005) es de cotización: ninguno se ata al contenedor. No hacen falta.
- **Lectura en el Portal.** `getShipmentNaviera` (SDD-0101) ya camina envío → contenedor → zarpe con
  el cliente admin, scopeado al envío propio. Leía `pod`, `etd` y `eta`, no `transit_days`.
- **Stepper.** `PortalShipmentDetailNorte` pinta la fecha real de cada etapa (SDD-0132) y una
  «Entrega estimada» por heurística sobre la fecha de creación (`estimatePortalEta`).
- **Motor de avisos.** `client_notification_rules` con ancla `event`, `eta` o `etd` (SDD-0156).
  `resolveShipmentEta` resuelve la ETA en tres fuentes (SeaRates, `sailings.eta`, recibo VE).
  `carga_en_camino` está en el catálogo con `gancho: "pendiente"` y su copy (SDD-0543).

Conclusión: **no hace falta tabla nueva ni migración.**

## Decisiones

1. **Ancla = fecha real del zarpe.** El primer evento `shipped` del envío. Si el envío está
   embarcado sin ese evento (lote cargado por SQL), el `etd` del zarpe. Sin ninguna de las dos, no
   se estima. **Antes del zarpe no se estima nada** (es el pedido de Sam).
2. **Días de mar, en este orden:** `sailings.transit_days` (1–120) → `eta − etd` del mismo zarpe
   (1–120) → default por puerto de descarga (`LGU` 67) → default general 67. Los 67 días son el punto
   medio del rastreo real de DTD a La Guaira (CMA CGM, 59–75 días de la carga a la ETA). Un zarpe
   atrasado corre la ETA: se suma a la fecha real, no al ETD.
3. **Llegada a puerto, con la precedencia de `resolve-shipment-eta`** (revisión independiente, M2):
   fecha real de aduana → ETA conocida (SeaRates `pod_eta`, luego `sailings.eta`: la misma que
   muestra la tarjeta Naviera) → zarpe + días de mar, como último recurso. Así el Portal y los
   avisos no dan dos llegadas distintas.
4. **Etapas después del puerto:** aduana el día del arribo; bodega VE +10; reparto +12; última milla
   +13; entregado +14. Si la aduana ya tiene fecha real, el resto se ancla ahí. Terrestre: entrega a
   3 días del despacho, sin aduana. Son constantes de oficina en
   `lib/portal/seguimiento-estimado.ts`, para calibrar con la operación.
5. **Fechas vencidas** (M1): la página pasa «hoy»; una etapa cuya fecha estimada ya pasó sin
   ocurrir no muestra la fecha vencida sino «Por confirmar», y la entrega dice «Pendiente de
   confirmar». Se compara por día de Caracas; las fechas se muestran en `America/Caracas` (B2).
6. **Terrestre** (M3): sin puerto ni días de mar; la nota habla del despacho, sin «zarpe» ni
   «puerto».
7. **En el Portal, siempre rotulado.** Sólo las etapas que faltan llevan fecha estimada, como
   «Est. 12 dic» con `aria-label` «Fecha estimada: …». Una nota dice «Fechas estimadas», desde dónde
   se calcularon y la llegada estimada a puerto. No promete avisos (la bandera está apagada y
   `TRACKING_EN_CONSTRUCCION` sigue encendido). «Entrega estimada» usa la estimación desde el zarpe
   cuando existe y la heurística de siempre antes.
8. **Avisos apagados detrás de `AVISOS_POR_HITO_LIVE = false`**, en su propio módulo
   `avisos-por-hito-flag.ts` para no cerrar el ciclo `schedule-client-notifications` →
   `resolve-shipment-eta` → `avisos-por-hito` (B1); declarada en `scripts/feature-constants.json`. Encendida:
   - al marcar «zarpado» (`avanzarContenedor`, sólo con `outcome = transitioned`), un
     `carga_en_camino` por cliente y contenedor, anclado al envío de código menor del cliente
     (SDD-0543: «un aviso por cliente, no por envío»). Canal según la regla del tenant;
   - `resolveShipmentEta` suma una cuarta fuente, la ETA estimada, detrás de las tres reales, para
     las reglas ancladas en `eta` (por ejemplo «va llegando»).

   Apagada, ninguno de los dos lee ni escribe nada. El catálogo conserva `gancho: "pendiente"`
   mientras la bandera siga en false.
9. **Ensayo en seco** (`ensayarAvisosZarpe`, acción de Naviera): con la bandera apagada, cuenta
   envíos vivos, destinatarios (uno por cliente), envíos sin Shipping Mark y lo que haría la regla
   del tenant. No inserta en la agenda, no llama al drain, no envía. Devuelve sólo números. Exige
   edición de Naviera y que el contenedor sea del tenant de la sesión.

10. **La vista estimada va sin bandera** (decisión del DG, 2026-11-13): fusionar no publica la web
    y Sam la ve primero en prueba. Los avisos siguen apagados.

## Gobernanza

| Política | Resultado |
|---|---|
| SGE-00.01 | cumplimiento: el stepper conserva su función; suma una fecha rotulada |
| SGE-00.03 | cumplimiento: los avisos (irreversibles al salir) nacen apagados; encenderlos es decisión de Sam |
| SGE-00.05 | cumplimiento: pruebas negativas del ensayo (otro tenant, sin permiso, id vacío) |
| SGE-00.06 | cumplimiento: el ensayo dice a cuántos llegaría antes de encender |
| SGE-00.11 | cumplimiento: la nota dice que la fecha es estimada y de dónde sale |
| SGE-00.12 | no aplica: no hay IA |
| AUD-01 | no aplica: el ensayo sólo lee; el zarpe ya audita en la 0477 |
| MP-01 | no aplica: nada se borra ni se mueve |
| A11Y-01 | cumplimiento: «Est.» se lee completo («Fecha estimada: …») |
| VIS-01 | cumplimiento: tokens existentes (`text-grey-500`, `text-grey-700`), sin color nuevo |
| CMP-01 | no aplica: sin componente nuevo; cambia `PortalShipmentDetailNorte` |

## Alcance — allowlist exacta

| Archivo | Cambio |
|---|---|
| `lib/portal/seguimiento-estimado.ts` (nuevo) | estimador puro |
| `lib/portal/__tests__/seguimiento-estimado.test.ts` (nuevo) | puro |
| `lib/studio/naviera-tracking/types.ts` | `transitDays?` opcional en `NavieraSnapshot` |
| `lib/studio/naviera-tracking/queries.ts` | `getShipmentNaviera` lee `sailings.transit_days` |
| `app/portal/(app)/envios/[code]/page.tsx` | calcula `estimado` y lo pasa |
| `app/portal/(app)/envios/[code]/_components/PortalShipmentDetailNorte.tsx` | «Est.» en el stepper, nota y entrega estimada |
| `app/portal/(app)/envios/[code]/_components/__tests__/PortalShipmentDetailEstimado.test.tsx` (nuevo) | jsdom |
| `app/portal/(app)/envios/[code]/__tests__/eta-puerto-consistente.test.tsx` (nuevo) | jsdom de la página real: una sola llegada a puerto en nota y tarjeta |
| `lib/studio/notifications/avisos-por-hito.ts` (nuevo) | plan, ensayo y programación |
| `lib/studio/notifications/avisos-por-hito-flag.ts` (nuevo) | `AVISOS_POR_HITO_LIVE` |
| `lib/studio/notifications/__tests__/avisos-por-hito.test.ts` (nuevo) | puro y doble |
| `lib/studio/notifications/resolve-shipment-eta.ts` | cuarta fuente, con bandera |
| `lib/studio/notifications/__tests__/resolve-shipment-eta.test.ts` | casos de la cuarta fuente |
| `app/studio/(app)/naviera/actions.ts` | gancho del zarpe y `ensayarAvisosZarpe` |
| `app/studio/(app)/naviera/__tests__/ensayo-avisos-zarpe.test.ts` (nuevo) | acción real con el doble que filtra |
| `scripts/feature-constants.json` | declara `AVISOS_POR_HITO_LIVE = false` |
| `lib/studio/rbac-actions-guard.test.ts` | inventario de acciones 466 → 467 (`ensayarAvisosZarpe`, con `moduleEditDenial`) |
| Esta spec, `docs/specs/README.md` y `.agents/handoffs/0627-seguimiento-estimado.md` | documentación |

**No se tocan:** los archivos del T3 del Rebrand (`app/portal/claridad.css`, `app/portal/layout.tsx`,
`PortalFormField.tsx`, `PortalHubTabs.tsx`, `claridad-portal-contract.test.ts`), `app/globals.css`,
`infra/ops/portal-historial/`, `scripts/consolidados/`, `TRACKING_EN_CONSTRUCCION`, migraciones.

## Aceptación

1. Un envío zarpado con `transit_days` muestra «Est.» en cada etapa que falta, con la fecha de zarpe
   + días; las cumplidas no llevan «Est.». Prueba pura y jsdom.
2. Antes del zarpe no aparece ningún «Est.» ni la nota. Prueba pura y jsdom.
3. Un zarpe atrasado corre la ETA; una aduana con fecha real re-ancla el resto. Prueba pura.
4. `AVISOS_POR_HITO_LIVE` es `false`; apagada, el zarpe no lee ni agenda `carga_en_camino` y la ETA
   estimada no ancla reglas. Prueba de la bandera, de `resolveShipmentEta` y de la acción de zarpe
   existente (sólo `status:shipped`).
5. Encendida (inyectada en la prueba), un `carga_en_camino` por cliente, anclado al envío de código
   menor; un envío eliminado no recibe aviso; si no se pueden leer los envíos vivos, no se avisa.
6. El ensayo en seco cuenta sin insertar, sin actualizar y sin llamar al motor; no devuelve Shipping
   Marks ni nombres; respeta tenant y permiso.
7. `pnpm verify` en verde, o cada comprobación registrada con su resultado en el handoff.

## Riesgos y límites

- **Un solo puerto calibrado.** Los destinos reales son La Guaira, Maracaibo (63–71 días) y
  Barranquilla, Colombia (46–49). Sólo La Guaira tiene código en `ports`; un zarpe a Maracaibo o
  Barranquilla sin `transit_days` ni ETA cae al default de La Guaira (67): Barranquilla quedaría
  ~20 días larga. Cargar `transit_days` en el zarpe lo evita. Ampliar el catálogo de puertos queda
  fuera de esta SDD.
- **Con una ETA conocida, el zarpe no la corre.** Si hay ETA de SeaRates vigente o del itinerario,
  la llegada a puerto es esa fecha: un zarpe atrasado ya no la mueve (sólo mueve la estimada, que es
  el último recurso). SeaRates cuenta sólo si su última consulta salió bien (`fetch_status = ok`),
  la misma regla en la tarjeta Naviera, la nota y los avisos.
- **Ancla «zarpe», no «carga».** La oficina registra la fecha de CARGA. El ancla es el evento
  `shipped` que la 0477 inserta cuando se marca «zarpado»: si se marca el día de la carga, coincide
  con los rangos medidos (que van de la carga a la ETA); si se marca días después, la ETA se corre
  esos días.
- Las constantes de aduana y reparto son de partida: la estimación puede quedar corta o larga hasta
  calibrarlas con la operación. La pantalla lo dice («Pueden moverse»).
- Las fechas estimadas no tienen bandera: decisión del DG (fusionar no publica la web; Sam la ve
  primero en prueba).
- El ensayo cuenta con la regla por defecto del tenant; un override por cliente puede cambiar el
  canal de ese cliente y no se cuenta aparte.
- Encender `AVISOS_POR_HITO_LIVE` necesita una regla activa para `carga_en_camino` en el tenant
  (hoy no se sabe si existe en producción: no se leyó) y el OK nominal de Sam.

## Datos personales

Revisé `.claude/skills/revisar-datos-ve/SKILL.md`. No se capturan datos nuevos ni se crean columnas.

- El estimador recibe fechas y códigos de puerto; ningún dato personal.
- El ensayo lee Shipping Mark y nombre (ya en `shipments`) para agrupar por cliente y devuelve sólo
  conteos: una prueba exige que la salida no contenga Shipping Marks, nombres ni códigos.
- Encendido, el aviso usa el mismo camino y la misma finalidad que los avisos de Tracking.

Resultado: **CORRECTO** en minimización. **NO VERIFICABLE** el contenido de las reglas en producción.

## Fuera de alcance

- Encender `AVISOS_POR_HITO_LIVE` o apagar `TRACKING_EN_CONSTRUCCION`.
- Botón del ensayo en la pantalla de Naviera (hoy es una acción de servidor sin UI).
- Fechas estimadas en la lista de envíos y en la portada.
- Rastreo vivo de la naviera.
