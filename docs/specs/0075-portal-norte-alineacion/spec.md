---
sdd: "0075"
title: "Portal del cliente — alineación con el Norte (estimado, soporte, cotización)"
status: in-progress
author: "founder"
created: 2026-06-13
updated: 2026-07-16
supersedes: null
superseded_by: null
related: ["0042", "0047", "0051", "0054", "0056", "0061", "0067"]
confidencialidad: interno
---

# DTD-0075 — Portal del cliente: alineación con el Norte

> **📌 Estado (2026-07-16):** **Slice A y Slice C de §1 están construidos** (Build Manual ·
> lane `feat/portal-0075`). Decisiones del founder, las 3 como recomendaba la spec:
> estimado = **vista derivada** (no estado nuevo · cero migración), aceptación
> **duplicada** en el detalle del envío (no movida · `/portal/facturas/[code]/aceptar`
> intacta), pestaña Estimados **conservada** como captación web.
>
> - **A** — `getPendingAcceptanceForShipment` (`lib/portal/portal-legal-queries.ts`) +
>   el `PendingAcceptanceCard` reusado arriba del stepper en `/portal/envios/[code]`.
> - **C** — `attachShipmentCodes` (`lib/portal/portal-queries.ts`) + `ConvertedNote`:
>   "Convertido en el envío S-…" ahora enlaza. Se aplicó también a Cotizaciones (mismo
>   callejón sin salida, misma query).
> - **B** (re-aceptación por medida real) — **PENDIENTE**: es la única parte con
>   migración y toca dinero (la factura no se emite hasta aceptar la diferencia).
>
> ⚠️ **Rollout gateado:** `SHIPMENT_ACCEPTANCE_CTA_LIVE = false` (`lib/portal/demo.ts`).
> `NORTE_PORTAL_LIVE` ya está en `true` → sin ese segundo flip el CTA saldría vivo para
> todos los clientes. Mientras está en `false` sólo lo ve la cuenta demo `DTD-1004`.
> **Lo prende el founder.** Al prenderlo, la spec pasa a `done` si B queda fuera de alcance.

> **📌 Estado (2026-07-01):** de los 3 frentes, **§2 (soporte con casos)** se cerró vía
> **SDD-0102 Reclamos** (LIVE) y **§3 (cotización desde el portal)** ya está en prod
> (`/portal/cotizaciones` + `/nueva` + "Avanzar a cotización"). **Solo queda §1**
> (estimado cosido dentro del ciclo del envío + aceptación de T&C **fundida en el detalle
> del envío**, hoy vive aparte en `/portal/facturas/[code]/aceptar`). Esta spec se **reduce
> a §1**; su prioridad y la del resto del portal viven en `INVENTARIO-PORTAL.md` (raíz).

> Cierra los 3 gaps de **arquitectura** entre el portal de producción (`app/portal/`)
> y el Norte (`docs/design/studio/_norte/portal/app.jsx`): estimado cosido al envío,
> soporte con casos, y cotización desde el portal. Los gaps de **pantalla** ya se
> cerraron por separado (Referidos = cara cliente de SDD-0051).

## Contexto

Auditoría 2026-06-13 del portal contra el Norte: el portal cubre ~85 % del Norte. Las
secciones core existen y funcionan (Inicio, Mis envíos, Compras, Facturas, Documentos,
Mensajes, aceptación legal) y **Referidos** se agregó como cara cliente de SDD-0051. Lo
que falta NO son pantallas sino **modelo/flujo** — por eso esta spec, en vez de
improvisar sobre lo que ya funciona.

Las tres diferencias:

1. **Estimado fragmentado.** Hoy en producción son tres piezas sueltas:
   - pestaña `/portal/estimados` (SDD-0061): cálculos de la calculadora web vinculados al
     cliente (captación, `quotes.source='web'`);
   - aceptación legal bajo `/portal/facturas/[code]/aceptar` (SDD-0054/0067): T&C +
     Operador con evidencia inmutable (IP/hash) + re-aceptación por versión de documento;
   - envíos con los estados de tracking público (`lib/shared/shipment-public.ts`:
     `draft → … → delivered`), **sin** estado `estimado`/`recibido CN`.

   El Norte cose todo en **un solo ciclo dentro del envío**:
   `estimado → aceptar (T&C+Operador) → orden → recibido CN → medido → re-aceptar si la
   medida real cambió → factura`. La aceptación vive en el **detalle del envío**, con el
   caso "tu carga llegó y se midió, acepta la medida real" (Norte
   `PortalShipmentDetail` / `PortalAcceptModal`).

2. **Soporte sin casos.** `/portal/mensajes` (SDD-0056) = chat con el asesor (inbound a
   Conversaciones del Studio). El Norte tiene **"Soporte"** = chat + **casos/reclamos**
   estructurados (faltante, daño, demora, facturación, otro) con estado
   `recibido → en-revisión → resuelto` (Norte `PortalSoporte`).

3. **Sin cotización desde el portal.** El dashboard tiene "Nueva cotización"
   deshabilitado (`PortalDashboard.tsx`, "Próximamente"). El Norte deja al cliente pedir
   una cotización formal que el asesor convierte — alimenta el ciclo del estimado (§1).

## Alcance

Tres frentes **independientes**; cada uno puede promoverse a su propio SDD al aprobarse.
Esta spec los propone y deja las **decisiones abiertas** para el founder. **No incluye
código.** Prioridad sugerida: §1 (responde la pregunta original) ≥ §3 (alimenta §1) > §2.

### §1 — Estimado cosido al ciclo del envío

**Estado actual:** la aceptación legal ya existe y es robusta (más que el mock del
Norte), pero vive bajo Facturas y el envío no tiene estado `estimado`.

**Target Norte:** el cliente ve, en el detalle del envío, el estado del ciclo y el botón
"Aceptar estimado" / "Aceptar estimado · medida real" cuando corresponde.

**Propuesta (slices):**
- **A.** Exponer el ciclo en el detalle del envío SIN romper la aceptación actual:
  derivar un "paso de aceptación" desde la orden/factura pendiente ya ligada al envío
  (reusa `getPendingAcceptanceInvoice`), y mostrar el CTA de aceptación en
  `/portal/envios/[code]` además de en Facturas. Cero migración si es vista derivada.
- **B.** Re-aceptación por **medida real**: cuando la medida CN (volumen/peso) difiere de
  la estimada, marcar el envío como "medido · falta tu aceptación" y pedir re-aceptación
  (la factura no se emite hasta aceptar la diferencia). Esto sí puede requerir un flag /
  snapshot de "medida estimada vs real".
- **C.** Reconciliar la pestaña `/portal/estimados`: mantenerla como captación web
  (recomendado) y enlazar "este estimado se convirtió en el envío X" cuando aplica
  (`quotes.converted_to_shipment_id` ya existe).

**Decisiones abiertas (founder):**
- ¿El "estimado" es un **estado nuevo de `shipments`** o una **vista derivada** del
  par envío↔orden-pendiente? (Recomendado: derivada — evita migrar el enum de estados,
  que es compartido con el tracking público.)
- ¿La aceptación se **mueve** al detalle del envío o se **duplica el acceso** desde ahí?
  (Recomendado: duplicar acceso; no romper `/portal/facturas/[code]/aceptar`.)
- ¿Se conserva la pestaña Estimados? (Recomendado: sí.)

### §2 — Soporte con casos/reclamos

**Estado actual:** solo chat (`/portal/mensajes`).

**Target Norte:** además del chat, casos tipados con estado y trazabilidad.

**Propuesta:**
- Tabla nueva `support_cases` (tenant + client_markbox + tipo + asunto + estado +
  envío opcional) con RLS de portal por markbox (espejo de la de shipments/invoices) y
  cara Studio para gestionarlos. Hilo de mensajes reusando el modelo de Conversaciones
  (SDD-0056) por caso.
- Migración nueva (numerar al construir; revoke execute … from public, anon en cualquier
  RPC). El portal: subir "Mensajes" a "Soporte" con tab Chat | Casos, o sección aparte.

**Decisiones abiertas:** ¿casos = entidad nueva, o se modela sobre Conversaciones
existente con un `kind='caso'` + tipo? ¿SLA/notificaciones al asesor?

### §3 — Nueva cotización desde el portal

**Estado actual:** botón deshabilitado en el dashboard.

**Target Norte:** el cliente arma una solicitud de cotización (servicio + origen/destino +
medidas/fotos) que entra al Studio y el asesor convierte en estimado formal.

**Propuesta:** reusar el modelo `quotes` (SDD-0061) con `source='portal'`; un form en el
portal que crea el quote en estado `draft`/`solicitado` ligado al markbox; el asesor lo
trabaja y lo devuelve (aparece en `/portal/estimados`). Conecta con §1 (el estimado
aceptado arranca el ciclo del envío).

**Decisiones abiertas:** ¿la cotización del portal usa la misma calculadora pública
(precio al instante) o es "pedido de cotización" que el asesor responde? (El Norte
inclina a lo segundo para carga no estándar.)

## Diseño (referencia Norte)

`docs/design/studio/_norte/portal/app.jsx` (v2.5):
- §1 — `PortalShipmentDetail` + `PortalAcceptModal` + `PortalAcuseModal` (~L556–900);
  estados `estimado`/`recibido CN` y caso "medida real".
- §2 — `PortalSoporte` (~L983–1120) + `NewReclamoForm` (tipos + steps).
- §3 — flujo de cotización en `PortalHome` / "Nueva cotización".

Marca: capa sistema del portal (Sora/Nunito vía `.portal-sys`), tokens `var(--*)`, ver
[`BRAND.md`](../../../BRAND.md) y `_norte/CLAUDE.md`.

## No-objetivos

- No re-arquitecturar la aceptación legal (SDD-0054/0067 está bien).
- No tocar el enum de estados del tracking público (compartido público↔ERP) salvo
  decisión explícita en §1.
- No incluye el "próximo arribo real" del dashboard (vessel/ETA de Naviera): eso es
  **Naviera Slice C** (ya diferido en SDD-0047), no parte de esta spec.

## Adjuntos

Ninguno por ahora. Mockups de referencia → el Norte citado arriba por texto-código.
