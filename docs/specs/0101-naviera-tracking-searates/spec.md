---
sdd: "0101"
title: "Naviera Tier 1: tracking real del embarque (deep-link SeaRates + cadena interna + API medido)"
status: draft
author: "Claude (DTD)"
created: 2026-06-21
updated: 2026-06-21
supersedes: null
superseded_by: null
related: ["0047", "0042", "0092", "0059"]
confidencialidad: interna
---

# SDD-0101 — Naviera Tier 1: tracking real del embarque

## 1. Resumen en una línea

El portal del cliente muestra ETA **estimada por heurística** y no muestra buque/
contenedor/ETD/ETA reales (degradación documentada en `docs/architecture/portal-norte-erp-gaps.md`
§1). Toda la data naviera real **ya existe** en el ERP (SDD-0047: `sailings`/`bookings`/
`consolidations`); falta **resolverla y mostrarla**, más un puente a **SeaRates** para
posición/ETA en vivo — usado con cuidado porque la cuenta SeaRates tiene un tope
**duro de 100 llamadas/mes**.

## 2. Contexto y problema

- **El Norte muestra** (portal): buque + viaje + contenedor, ETD/ETA reales, progreso real, mapa.
- **Hoy degrada a**: `estimatePortalEta` (heurística por servicio sobre `createdAt`) +
  `computeProgress` (derivado del status). Sin buque/contenedor/BL.
- **La data real YA existe** (SDD-0047, migr 0096). Cadena:

  ```
  shipment
    ← consolidation_items.shipment_id
    → consolidations (ref DTD-CONSOL-NNNN, status, booking_id, sailing_id, container_type)
    → bookings       (carrier_id, sailing_id, bl_number, container_type, mode FCL/LCL)
    → sailings       (vessel, voyage, pol, pod, etd, eta, cutoff)
    → carriers       (name, scac)
  ```

  Como **LCL es el 95% de la carga real** y la LCL pasa por consolidaciones, resolver
  esta cadena cubre el 95% de los envíos **sin tocar el esquema ni gastar cuota**.

- **SeaRates**: el repo ya integra el producto de **fletes** (SDD-0092, GraphQL
  `rates.searates.com`, envs `SEARATES_*`, cuota **100/mes** compartida, vence 2026-07-17).
  El **tracking** de SeaRates es **otro producto** (Container Tracking). Por la cuota,
  el modo por defecto NO es el API: es un **deep-link** a la web de SeaRates que el
  operador abre en Chrome (mapa/buque/ETA en vivo, **0 llamadas**). El API se reserva
  para cuando hace falta el dato estructurado, con tope.

### Aislamiento de carriles (anti-cruce)

Hay lanes en vuelo tocando el SeaRates de **fletes** (`feat/searates-cron-cap`,
`feat/searates-mas-puertos` → `lib/studio/searates/ocean-rates-*`, `searates-api.ts`).
Este SDD vive en archivos **nuevos** (`lib/studio/naviera-tracking/`) y **NO edita**
los de fletes. La auth/envs SeaRates se **reusan read-only** (mismo `getPlatformToken`).

## 3. Objetivo y no-objetivos

**Objetivo:** reemplazar la degradación del portal/público con data naviera real,
priorizando lo **gratis** (cadena interna + deep-link) sobre lo **medido** (API).

**No-objetivos (V1):** scraping de BL PDF, bin-packing (Slice C de SDD-0047, sigue
diferido); mapa embebido propio (el deep-link abre el mapa de SeaRates); EDI/AIS directo.

## 4. Slices

### Slice A — cadena interna + deep-link (CERO cuota, CERO credenciales)
1. **Resolver** la cadena (`shipment → … → sailing/carrier`) en un snapshot naviero
   (`vessel/voyage/carrier/container_ref/bl/pol/pod/etd/eta/naviera-status`).
2. **Deep-link** a la web de SeaRates por nº de contenedor (o BL + SCAC) → el operador
   y el cliente lo abren en Chrome. Función pura, sin API.
3. **ERP**: en el módulo Naviera / detalle del embarque, mostrar el snapshot + el
   botón "Ver en SeaRates" + capturar el nº de contenedor.
4. **Portal**: héroe "Próximo arribo" y detalle del envío muestran ETD/ETA/buque/
   contenedor reales cuando el envío está consolidado; **fallback a la heurística**
   cuando todavía no (honesto).
5. **Migración 0154**: `container_no` en `consolidations` y `bookings` (nullable) +
   índice. Nada más (el resto se resuelve por join). *(Renumerada 0152→0154 por
   colisión con feat/reclamos-cliente, 2026-06-21.)*

### Slice B — SeaRates Container Tracking API (MEDIDO, con tope)
1. Cliente `lib/studio/naviera-tracking/tracking-api.ts` (reusa `getPlatformToken`),
   contra el endpoint de tracking (contrato a confirmar en vivo, como se hizo con rates).
2. Tabla cache `tracking_snapshots` (container_no/bl, vessel, lat/lng, eta_real,
   milestones[], fetched_at, source) — se sirve del cache, NO se llama en cada vista.
3. **Quota guard duro**: contador mensual persistido + tope configurable (default ~20/sem
   como el cron de fletes); al tope → solo deep-link. Botón "Actualizar desde SeaRates"
   en el ERP (manual, 1 llamada), nunca automático por pageview.
4. Migración aparte (≥0153).

### Slice C — tracking público (`/track/[code]`)
Extender el RPC `public_track` (SDD-0059) para exponer el snapshot naviero al tracking
público anónimo. Migración aparte (altera el RPC). Decisión de alcance de Sam.

## 5. Datos (migración 0154, Slice A)

- `consolidations.container_no text` — nº físico del contenedor (ej `COSU1234567`).
- `bookings.container_no text` — para FCL/booking directo.
- Índices parciales por `(tenant_id, container_no)` where not null.
- Sin RLS nueva: heredan la de sus tablas (por tenant, SDD-0047). Sin funciones nuevas
  en esta migración → sin `revoke execute`. (Slice B sí define funciones → ahí aplica.)

## 6. Resolución y aislamiento (portal/público)

El cliente del portal **no es miembro de `user_tenants`** → no tiene RLS sobre
`sailings`/`consolidations`. La resolución va por **admin client** scopeado al envío
**propio** del cliente (mismo patrón que `getPortalAdvisor`, SDD del asesor). Público
(Slice C) va por el RPC SECURITY DEFINER ya existente.

## 7. UI

- **ERP** (`/studio/naviera` o detalle de embarque): snapshot naviero + input
  `container_no` + botón "Ver en SeaRates" (deep-link). Tokens del Studio.
- **Portal** (`/portal` héroe + `/portal/envios/[code]`): buque/contenedor/ETD/ETA
  reales con fallback honesto. Clases brand, dark-default.
- Pantalla nueva / cambio visual → pasa por `ui-ux-designer` antes del commit.

## 8. Criterios de aceptación (Slice A)

- [ ] Un envío consolidado con sailing muestra ETD/ETA/buque reales en el portal (no la heurística).
- [ ] Un envío sin consolidar cae a la heurística (sin romper).
- [ ] El deep-link abre la web de SeaRates con el contenedor/BL correcto (0 llamadas API).
- [ ] El ERP permite capturar `container_no`.
- [ ] `node scripts/verify.mjs` verde + `pnpm build` verde. Tests de la resolución + el deep-link (puro).

## 9. Pendiente de Sam / coordinación

- Confirmar el **endpoint/contrato del Container Tracking API** de SeaRates (Slice B) y
  el **modelo de cuota** (tope mensual aceptable sobre las 100/mes compartidas con fletes).
- Decidir si Slice C (tracking público) entra ahora o después.
- Merge a main + deploy + aplicar migración 0154 a prod (gate de coordinación).
